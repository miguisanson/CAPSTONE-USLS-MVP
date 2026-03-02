import { AuditActionType, DocumentStatus, RoleName } from "@prisma/client";
import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { z } from "zod";
import {
  canDownloadDocument,
  canReadStudent,
  canUploadDocument,
  logAccessDenied,
} from "../../auth/policy";
import { env } from "../../config/env";
import { logAudit, logTimelineEvent } from "../../lib/audit";
import { prisma } from "../../lib/prisma";
import { authorize } from "../../middleware/authorize";
import { asyncHandler } from "../../utils/async-handler";
import { HttpError } from "../../utils/http-error";

const uploadDirectory = path.resolve(process.cwd(), env.UPLOAD_DIR);
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDirectory),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const uploader = multer({ storage });

const createDocumentSchema = z.object({
  milestoneDefinitionId: z.number().int().positive().optional().nullable(),
  checklistItem: z.string().min(2),
});

const createCommentSchema = z.object({
  note: z.string().min(1),
  versionId: z.number().int().positive().optional().nullable(),
});

const resolveCommentSchema = z.object({
  resolved: z.boolean(),
});

export const documentsRouter = Router();

documentsRouter.get(
  "/documents/my",
  authorize(RoleName.STUDENT),
  asyncHandler(async (req, res) => {
    const student = await prisma.student.findFirst({
      where: { userAccountId: req.user!.id },
      select: { id: true },
    });

    if (!student) {
      throw new HttpError(404, "No student profile is linked to this account.");
    }

    const docs = await prisma.documentRecord.findMany({
      where: { studentId: student.id },
      include: {
        milestoneDefinition: true,
        versions: {
          orderBy: { versionNumber: "desc" },
        },
        revisionNotes: {
          include: {
            author: { select: { id: true, fullName: true } },
            version: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json(docs);
  })
);

documentsRouter.get(
  "/students/:studentId/documents",
  asyncHandler(async (req, res) => {
    const studentId = Number(req.params.studentId);
    if (!Number.isFinite(studentId)) throw new HttpError(400, "Invalid student ID.");

    const allowed = await canReadStudent(req.user!, studentId);
    if (!allowed) {
      await logAccessDenied(req, "Document list access denied by student relationship check.", {
        studentId,
      });
      throw new HttpError(403, "You are not authorized to access this student's documents.");
    }

    const docs = await prisma.documentRecord.findMany({
      where: { studentId },
      include: {
        milestoneDefinition: true,
        versions: {
          orderBy: { versionNumber: "desc" },
        },
        revisionNotes: {
          include: {
            author: { select: { id: true, fullName: true } },
            version: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json(docs);
  })
);

documentsRouter.post(
  "/students/:studentId/documents",
  authorize(
    RoleName.ADMIN,
    RoleName.GRADUATE_SCHOOL_STAFF,
    RoleName.ACADEMIC_COORDINATOR,
    RoleName.RESEARCH_COORDINATOR,
    RoleName.ADVISER
  ),
  asyncHandler(async (req, res) => {
    const studentId = Number(req.params.studentId);
    if (!Number.isFinite(studentId)) throw new HttpError(400, "Invalid student ID.");

    const parsed = createDocumentSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid document payload.");

    const allowed = await canReadStudent(req.user!, studentId);
    if (!allowed) {
      await logAccessDenied(req, "Document checklist creation denied by student relationship check.", {
        studentId,
      });
      throw new HttpError(403, "You are not authorized to create checklist records for this student.");
    }

    const record = await prisma.documentRecord.create({
      data: {
        studentId,
        milestoneDefinitionId: parsed.data.milestoneDefinitionId ?? null,
        checklistItem: parsed.data.checklistItem,
        status: DocumentStatus.PENDING,
      },
    });

    await logTimelineEvent({
      studentId,
      eventType: "DOCUMENT_CHECKLIST_CREATED",
      title: parsed.data.checklistItem,
      relatedEntityType: "DocumentRecord",
      relatedEntityId: record.id,
      performedById: req.user!.id,
    });

    await logAudit({
      actorUserId: req.user!.id,
      actionType: AuditActionType.CREATE,
      entityType: "DocumentRecord",
      entityId: String(record.id),
      description: "Document checklist item created.",
      metadata: parsed.data,
      req,
    });

    res.status(201).json(record);
  })
);

documentsRouter.post(
  "/documents/:id/versions",
  authorize(
    RoleName.ADMIN,
    RoleName.GRADUATE_SCHOOL_STAFF,
    RoleName.ACADEMIC_COORDINATOR,
    RoleName.RESEARCH_COORDINATOR,
    RoleName.ADVISER,
    RoleName.STUDENT
  ),
  uploader.single("file"),
  asyncHandler(async (req, res) => {
    const documentId = Number(req.params.id);
    if (!Number.isFinite(documentId)) throw new HttpError(400, "Invalid document ID.");
    if (!req.file) throw new HttpError(400, "No file uploaded.");

    const document = await prisma.documentRecord.findUnique({
      where: { id: documentId },
      include: { student: true },
    });

    if (!document) throw new HttpError(404, "Document record not found.");

    const canUpload = await canUploadDocument(req.user!, document.studentId, document.checklistItem);
    if (!canUpload) {
      await logAccessDenied(req, "Document upload blocked by row-level/document policy.", {
        documentId,
        studentId: document.studentId,
        checklistItem: document.checklistItem,
      });
      throw new HttpError(403, "You are not authorized to upload this document.");
    }

    const latestVersion = await prisma.documentVersion.findFirst({
      where: { documentRecordId: documentId },
      orderBy: { versionNumber: "desc" },
    });
    const nextVersion = (latestVersion?.versionNumber ?? 0) + 1;

    const created = await prisma.$transaction(async (tx) => {
      await tx.documentVersion.updateMany({
        where: { documentRecordId: documentId },
        data: { isCurrent: false },
      });

      const version = await tx.documentVersion.create({
        data: {
          documentRecordId: documentId,
          versionNumber: nextVersion,
          fileName: req.file!.originalname,
          filePath: req.file!.filename,
          mimeType: req.file!.mimetype,
          sizeBytes: req.file!.size,
          uploadedById: req.user!.id,
          isCurrent: true,
        },
      });

      await tx.documentRecord.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.SUBMITTED,
        },
      });

      return version;
    });

    await logTimelineEvent({
      studentId: document.studentId,
      eventType: "DOCUMENT_VERSION_UPLOADED",
      title: `${document.checklistItem} v${nextVersion}`,
      relatedEntityType: "DocumentVersion",
      relatedEntityId: created.id,
      performedById: req.user!.id,
    });

    await logAudit({
      actorUserId: req.user!.id,
      actionType: AuditActionType.UPLOAD,
      entityType: "DocumentVersion",
      entityId: String(created.id),
      description: "Document version uploaded.",
      metadata: {
        documentId,
        version: nextVersion,
        fileName: req.file.originalname,
      },
      req,
    });

    res.status(201).json(created);
  })
);

documentsRouter.get(
  "/documents/versions/:id/download",
  asyncHandler(async (req, res) => {
    const versionId = Number(req.params.id);
    if (!Number.isFinite(versionId)) throw new HttpError(400, "Invalid document version ID.");

    const allowed = await canDownloadDocument(req.user!, versionId);
    if (!allowed) {
      await logAccessDenied(req, "Document download denied by relationship checks.", {
        versionId,
      });
      throw new HttpError(403, "You are not authorized to download this file.");
    }

    const version = await prisma.documentVersion.findUnique({
      where: { id: versionId },
      include: {
        documentRecord: {
          select: {
            studentId: true,
            checklistItem: true,
          },
        },
      },
    });

    if (!version) throw new HttpError(404, "Document version not found.");

    const absolutePath = path.resolve(uploadDirectory, version.filePath);
    if (!absolutePath.startsWith(uploadDirectory)) {
      await logAccessDenied(req, "Document path traversal blocked.", {
        versionId,
      });
      throw new HttpError(403, "Invalid document path.");
    }

    if (!fs.existsSync(absolutePath)) {
      throw new HttpError(404, "File is missing on server.");
    }

    await logAudit({
      actorUserId: req.user!.id,
      actionType: AuditActionType.UPDATE,
      entityType: "DocumentVersion",
      entityId: String(version.id),
      description: "Document version downloaded.",
      metadata: {
        versionId: version.id,
        studentId: version.documentRecord.studentId,
        checklistItem: version.documentRecord.checklistItem,
      },
      req,
    });

    res.download(absolutePath, version.fileName);
  })
);

documentsRouter.post(
  "/documents/:id/comments",
  authorize(
    RoleName.ADMIN,
    RoleName.GRADUATE_SCHOOL_STAFF,
    RoleName.ACADEMIC_COORDINATOR,
    RoleName.RESEARCH_COORDINATOR,
    RoleName.ADVISER,
    RoleName.PANEL_MEMBER
  ),
  asyncHandler(async (req, res) => {
    const documentId = Number(req.params.id);
    if (!Number.isFinite(documentId)) throw new HttpError(400, "Invalid document ID.");

    const parsed = createCommentSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid comment payload.");

    const document = await prisma.documentRecord.findUnique({
      where: { id: documentId },
    });
    if (!document) throw new HttpError(404, "Document record not found.");

    const allowed = await canReadStudent(req.user!, document.studentId);
    if (!allowed) {
      await logAccessDenied(req, "Revision note creation denied by student relationship checks.", {
        documentId,
        studentId: document.studentId,
      });
      throw new HttpError(403, "You are not authorized to comment on this document.");
    }

    const created = await prisma.$transaction(async (tx) => {
      const note = await tx.revisionNote.create({
        data: {
          documentRecordId: documentId,
          versionId: parsed.data.versionId ?? null,
          authorId: req.user!.id,
          note: parsed.data.note,
        },
      });

      await tx.documentRecord.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.NEEDS_REVISION,
          outstandingRevisionCount: {
            increment: 1,
          },
        },
      });

      return note;
    });

    await logTimelineEvent({
      studentId: document.studentId,
      eventType: "REVISION_NOTE_CREATED",
      title: "Revision requested",
      details: parsed.data.note,
      relatedEntityType: "RevisionNote",
      relatedEntityId: created.id,
      performedById: req.user!.id,
    });

    await logAudit({
      actorUserId: req.user!.id,
      actionType: AuditActionType.CREATE,
      entityType: "RevisionNote",
      entityId: String(created.id),
      description: "Revision note added to document.",
      metadata: parsed.data,
      req,
    });

    res.status(201).json(created);
  })
);

documentsRouter.patch(
  "/comments/:id/resolve",
  authorize(
    RoleName.ADMIN,
    RoleName.GRADUATE_SCHOOL_STAFF,
    RoleName.ACADEMIC_COORDINATOR,
    RoleName.RESEARCH_COORDINATOR,
    RoleName.ADVISER,
    RoleName.STUDENT
  ),
  asyncHandler(async (req, res) => {
    const commentId = Number(req.params.id);
    if (!Number.isFinite(commentId)) throw new HttpError(400, "Invalid comment ID.");

    const parsed = resolveCommentSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid payload.");

    const comment = await prisma.revisionNote.findUnique({
      where: { id: commentId },
      include: { documentRecord: true },
    });
    if (!comment) throw new HttpError(404, "Revision note not found.");

    const allowed = await canReadStudent(req.user!, comment.documentRecord.studentId);
    if (!allowed) {
      await logAccessDenied(req, "Revision note resolution denied by student relationship checks.", {
        commentId,
        studentId: comment.documentRecord.studentId,
      });
      throw new HttpError(403, "You are not authorized to resolve this revision note.");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const note = await tx.revisionNote.update({
        where: { id: commentId },
        data: {
          isResolved: parsed.data.resolved,
          resolvedAt: parsed.data.resolved ? new Date() : null,
        },
      });

      await tx.documentRecord.update({
        where: { id: comment.documentRecordId },
        data: {
          outstandingRevisionCount: parsed.data.resolved
            ? { decrement: 1 }
            : { increment: 1 },
        },
      });

      return note;
    });

    await logAudit({
      actorUserId: req.user!.id,
      actionType: AuditActionType.UPDATE,
      entityType: "RevisionNote",
      entityId: String(updated.id),
      description: parsed.data.resolved ? "Revision note resolved." : "Revision note reopened.",
      req,
    });

    res.json(updated);
  })
);

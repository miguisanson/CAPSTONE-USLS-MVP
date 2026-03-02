import { AuditActionType, RoleName, ScheduleStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { logAudit, logTimelineEvent } from "../../lib/audit";
import { prisma } from "../../lib/prisma";
import { authorize } from "../../middleware/authorize";
import { asyncHandler } from "../../utils/async-handler";
import { HttpError } from "../../utils/http-error";
import { getPagination } from "../../utils/pagination";
import { buildStudentScopeWhere } from "../../utils/scope";

const createRequestSchema = z.object({
  studentId: z.number().int().positive(),
  preferredDate: z.coerce.date().optional().nullable(),
  reason: z.string().optional().nullable(),
});

const createAvailabilitySchema = z.object({
  scheduleRequestId: z.number().int().positive(),
  availableFrom: z.coerce.date(),
  availableTo: z.coerce.date(),
  notes: z.string().optional().nullable(),
});

const createScheduleEventSchema = z.object({
  scheduleRequestId: z.number().int().positive(),
  eventStatus: z.nativeEnum(ScheduleStatus),
  scheduledAt: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const schedulingRouter = Router();

schedulingRouter.get(
  "/requests",
  asyncHandler(async (req, res) => {
    const { skip, take, page, pageSize } = getPagination(req);
    const status = req.query.status ? (String(req.query.status) as ScheduleStatus) : undefined;
    const studentScope = buildStudentScopeWhere(req.user!);

    const where = {
      student: studentScope,
      status: status ?? undefined,
    };

    const [items, total] = await Promise.all([
      prisma.scheduleRequest.findMany({
        where,
        include: {
          student: {
            include: {
              program: true,
            },
          },
          requestedBy: { select: { id: true, fullName: true } },
          availabilities: {
            include: {
              user: { select: { id: true, fullName: true } },
            },
            orderBy: { availableFrom: "asc" },
          },
          scheduleEvents: {
            include: { decidedBy: { select: { id: true, fullName: true } } },
            orderBy: { createdAt: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.scheduleRequest.count({ where }),
    ]);

    res.json({ items, page, pageSize, total });
  })
);

schedulingRouter.post(
  "/requests",
  authorize(
    RoleName.ADMIN,
    RoleName.GRADUATE_SCHOOL_STAFF,
    RoleName.ACADEMIC_COORDINATOR,
    RoleName.RESEARCH_COORDINATOR,
    RoleName.ADVISER,
    RoleName.STUDENT
  ),
  asyncHandler(async (req, res) => {
    const parsed = createRequestSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid schedule request payload.");

    const student = await prisma.student.findFirst({
      where: {
        AND: [buildStudentScopeWhere(req.user!), { id: parsed.data.studentId }],
      },
      select: { id: true },
    });
    if (!student) throw new HttpError(404, "Student not found or not accessible.");

    const created = await prisma.scheduleRequest.create({
      data: {
        studentId: parsed.data.studentId,
        requestedById: req.user!.id,
        preferredDate: parsed.data.preferredDate ?? null,
        reason: parsed.data.reason ?? null,
        status: ScheduleStatus.REQUESTED,
      },
    });

    await logTimelineEvent({
      studentId: parsed.data.studentId,
      eventType: "DEFENSE_REQUESTED",
      title: "Defense scheduling requested",
      details: parsed.data.reason ?? undefined,
      relatedEntityType: "ScheduleRequest",
      relatedEntityId: created.id,
      performedById: req.user!.id,
    });

    await logAudit({
      actorUserId: req.user!.id,
      actionType: AuditActionType.CREATE,
      entityType: "ScheduleRequest",
      entityId: String(created.id),
      description: "Defense scheduling request created.",
      metadata: parsed.data,
      req,
    });

    res.status(201).json(created);
  })
);

schedulingRouter.post(
  "/availability",
  authorize(
    RoleName.ADMIN,
    RoleName.GRADUATE_SCHOOL_STAFF,
    RoleName.ACADEMIC_COORDINATOR,
    RoleName.RESEARCH_COORDINATOR,
    RoleName.ADVISER,
    RoleName.PANEL_MEMBER,
    RoleName.STUDENT
  ),
  asyncHandler(async (req, res) => {
    const parsed = createAvailabilitySchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid availability payload.");

    if (parsed.data.availableTo <= parsed.data.availableFrom) {
      throw new HttpError(400, "Availability end time must be after start time.");
    }

    const scheduleRequest = await prisma.scheduleRequest.findUnique({
      where: { id: parsed.data.scheduleRequestId },
      include: { student: true },
    });
    if (!scheduleRequest) throw new HttpError(404, "Schedule request not found.");

    const access = await prisma.student.findFirst({
      where: { AND: [buildStudentScopeWhere(req.user!), { id: scheduleRequest.studentId }] },
      select: { id: true },
    });
    if (!access) throw new HttpError(403, "Student scope denied.");

    const created = await prisma.availability.create({
      data: {
        scheduleRequestId: parsed.data.scheduleRequestId,
        userId: req.user!.id,
        availableFrom: parsed.data.availableFrom,
        availableTo: parsed.data.availableTo,
        notes: parsed.data.notes ?? null,
      },
    });

    await logTimelineEvent({
      studentId: scheduleRequest.studentId,
      eventType: "AVAILABILITY_SUBMITTED",
      title: "Scheduling availability submitted",
      details: parsed.data.notes ?? undefined,
      relatedEntityType: "Availability",
      relatedEntityId: created.id,
      performedById: req.user!.id,
    });

    await logAudit({
      actorUserId: req.user!.id,
      actionType: AuditActionType.SUBMISSION,
      entityType: "Availability",
      entityId: String(created.id),
      description: "Availability submitted for defense scheduling.",
      metadata: parsed.data,
      req,
    });

    res.status(201).json(created);
  })
);

schedulingRouter.post(
  "/events",
  authorize(
    RoleName.ADMIN,
    RoleName.GRADUATE_SCHOOL_STAFF,
    RoleName.ACADEMIC_COORDINATOR,
    RoleName.RESEARCH_COORDINATOR
  ),
  asyncHandler(async (req, res) => {
    const parsed = createScheduleEventSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid schedule event payload.");

    const scheduleRequest = await prisma.scheduleRequest.findUnique({
      where: { id: parsed.data.scheduleRequestId },
      include: { student: true },
    });
    if (!scheduleRequest) throw new HttpError(404, "Schedule request not found.");

    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.scheduleEvent.create({
        data: {
          scheduleRequestId: parsed.data.scheduleRequestId,
          eventStatus: parsed.data.eventStatus,
          scheduledAt: parsed.data.scheduledAt ?? null,
          notes: parsed.data.notes ?? null,
          decidedById: req.user!.id,
        },
      });

      await tx.scheduleRequest.update({
        where: { id: parsed.data.scheduleRequestId },
        data: {
          status: parsed.data.eventStatus,
        },
      });

      return created;
    });

    await logTimelineEvent({
      studentId: scheduleRequest.studentId,
      eventType: "SCHEDULE_EVENT",
      title: `Defense schedule ${parsed.data.eventStatus.toLowerCase()}`,
      details: parsed.data.notes ?? undefined,
      relatedEntityType: "ScheduleEvent",
      relatedEntityId: event.id,
      performedById: req.user!.id,
    });

    await logAudit({
      actorUserId: req.user!.id,
      actionType: AuditActionType.STATUS_TRANSITION,
      entityType: "ScheduleRequest",
      entityId: String(parsed.data.scheduleRequestId),
      description: `Schedule request updated to ${parsed.data.eventStatus}.`,
      metadata: parsed.data,
      req,
    });

    res.status(201).json(event);
  })
);


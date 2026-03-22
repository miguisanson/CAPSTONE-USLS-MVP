import { AuditActionType, LifecycleStage, MilestoneStatus, RoleName, TaskStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import {
  canReadStudent,
  canUpdateStudentLifecycle,
  logAccessDenied,
} from "../../auth/policy";
import { logAudit, logTimelineEvent } from "../../lib/audit";
import { prisma } from "../../lib/prisma";
import { authorize } from "../../middleware/authorize";
import { asyncHandler } from "../../utils/async-handler";
import { buildRecommendation, computePriorityScore } from "../../utils/decision-support";
import { HttpError } from "../../utils/http-error";
import { getPagination } from "../../utils/pagination";
import { buildStudentScopeWhere } from "../../utils/scope";

const updateStageSchema = z.object({
  stage: z.nativeEnum(LifecycleStage),
  notes: z.string().optional(),
  riskFlag: z.boolean().optional(),
});

const updateMilestoneSchema = z.object({
  status: z.nativeEnum(MilestoneStatus),
  dueAt: z.coerce.date().optional().nullable(),
  completedAt: z.coerce.date().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const loadStudentProfile = async (studentId: number) => {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      program: true,
      adviser: { select: { id: true, fullName: true, email: true } },
      researchCoordinator: { select: { id: true, fullName: true, email: true } },
      panelAssignments: {
        include: { panelMember: { select: { id: true, fullName: true, email: true } } },
      },
      panelAssignmentsV2: {
        include: { panelUser: { select: { id: true, fullName: true, email: true } } },
      },
      adviserAssignments: {
        include: { adviserUser: { select: { id: true, fullName: true, email: true } } },
      },
      lifecycleHistory: {
        orderBy: { enteredAt: "desc" },
      },
      milestoneStatuses: {
        include: { milestoneDefinition: true },
        orderBy: { updatedAt: "desc" },
      },
      tasks: {
        where: { status: { not: "COMPLETED" } },
        include: { milestoneDefinition: true, assignedTo: { select: { id: true, fullName: true } } },
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      },
      documents: {
        include: {
          versions: {
            orderBy: { versionNumber: "desc" },
            take: 1,
          },
          revisionNotes: {
            where: { isResolved: false },
            orderBy: { createdAt: "desc" },
          },
        },
      },
      scheduleRequests: {
        include: {
          availabilities: true,
          scheduleEvents: { orderBy: { createdAt: "desc" } },
        },
        orderBy: { createdAt: "desc" },
      },
      alerts: {
        where: { status: { not: "CLOSED" } },
        include: { interventions: true },
        orderBy: { triggeredAt: "desc" },
      },
      timelineEvents: {
        orderBy: { occurredAt: "desc" },
        take: 100,
      },
    },
  });

  if (!student) return null;

  const enrichedTasks = student.tasks.map((task) => {
    const priorityScore = computePriorityScore({
      dueAt: task.dueAt,
      stage: student.currentStage,
      milestoneCriticality: task.milestoneDefinition?.criticality,
      taskStatus: task.status,
    });
    const recommendation = buildRecommendation({
      dueAt: task.dueAt,
      nextActionOwnerRole: task.nextActionOwnerRole,
    });
    return {
      ...task,
      priorityScore,
      recommendedAction: recommendation.recommendedAction,
      escalationPrompt: recommendation.escalationPrompt,
    };
  });

  return {
    ...student,
    tasks: enrichedTasks,
  };
};

export const studentsRouter = Router();

studentsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (req.user!.roles.includes(RoleName.STUDENT)) {
      await logAccessDenied(req, "Student attempted to list all/scoped students.");
      throw new HttpError(403, "Students are only allowed to read their own profile.");
    }

    const { skip, take, page, pageSize } = getPagination(req);
    const stage = req.query.stage ? (String(req.query.stage) as LifecycleStage) : undefined;
    const ownerRole = req.query.ownerRole ? (String(req.query.ownerRole) as RoleName) : undefined;
    const program = req.query.program ? String(req.query.program) : undefined;
    const riskFlag =
      req.query.riskFlag === undefined ? undefined : String(req.query.riskFlag).toLowerCase() === "true";
    const q = String(req.query.q ?? "").trim();

    const scope = buildStudentScopeWhere(req.user!);
    const where = {
      AND: [
        scope,
        stage ? { currentStage: stage } : {},
        program
          ? {
              OR: [{ program: { name: { contains: program } } }, { program: { code: { contains: program } } }],
            }
          : {},
        riskFlag === undefined ? {} : { riskFlag },
        ownerRole
          ? {
              tasks: {
                some: {
                  status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.OVERDUE] },
                  nextActionOwnerRole: ownerRole,
                },
              },
            }
          : {},
        q
          ? {
              OR: [
                { firstName: { contains: q } },
                { lastName: { contains: q } },
                { studentNumber: { contains: q } },
                { email: { contains: q } },
              ],
            }
          : {},
      ],
    };

    const [items, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: {
          program: true,
          adviser: { select: { id: true, fullName: true } },
          researchCoordinator: { select: { id: true, fullName: true } },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take,
      }),
      prisma.student.count({ where }),
    ]);

    const studentIds = items.map((item) => item.id);
    const [openTaskCounts, nextOwnerByStudent, openAlertCounts, pendingMilestoneCounts, latestTimelineByStudent] =
      await Promise.all([
        prisma.task.groupBy({
          by: ["studentId"],
          where: {
            studentId: { in: studentIds },
            status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.OVERDUE] },
          },
          _count: { _all: true },
        }),
        prisma.task.findMany({
          where: {
            studentId: { in: studentIds },
            status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.OVERDUE] },
          },
          orderBy: [{ priorityScore: "desc" }, { dueAt: "asc" }, { createdAt: "asc" }],
          distinct: ["studentId"],
          select: {
            studentId: true,
            nextActionOwnerRole: true,
            status: true,
          },
        }),
        prisma.alert.groupBy({
          by: ["studentId"],
          where: {
            studentId: { in: studentIds },
            status: { in: ["OPEN", "ACKNOWLEDGED"] },
          },
          _count: { _all: true },
        }),
        prisma.studentMilestoneStatus.groupBy({
          by: ["studentId"],
          where: {
            studentId: { in: studentIds },
            status: { in: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"] },
          },
          _count: { _all: true },
        }),
        prisma.timelineEvent.findMany({
          where: { studentId: { in: studentIds } },
          orderBy: [{ occurredAt: "desc" }],
          distinct: ["studentId"],
          select: { studentId: true, occurredAt: true },
        }),
      ]);

    const taskCountMap = new Map<number, number>(
      openTaskCounts
        .filter((item) => item.studentId !== null)
        .map((item) => [item.studentId as number, item._count._all])
    );
    const nextOwnerMap = new Map<number, { nextActionOwnerRole: RoleName | null; status: string }>(
      nextOwnerByStudent
        .filter((item) => item.studentId !== null)
        .map((item) => [item.studentId as number, { nextActionOwnerRole: item.nextActionOwnerRole, status: item.status }])
    );
    const alertCountMap = new Map<number, number>(
      openAlertCounts
        .filter((item) => item.studentId !== null)
        .map((item) => [item.studentId as number, item._count._all])
    );
    const pendingMilestoneMap = new Map<number, number>(
      pendingMilestoneCounts
        .filter((item) => item.studentId !== null)
        .map((item) => [item.studentId as number, item._count._all])
    );
    const lastActivityMap = new Map<number, Date>(
      latestTimelineByStudent
        .filter((item) => item.studentId !== null)
        .map((item) => [item.studentId as number, item.occurredAt])
    );

    const enrichedItems = items.map((item) => {
      const nextOwner = nextOwnerMap.get(item.id);
      return {
        ...item,
        openTaskCount: taskCountMap.get(item.id) ?? 0,
        openAlertCount: alertCountMap.get(item.id) ?? 0,
        pendingMilestoneCount: pendingMilestoneMap.get(item.id) ?? 0,
        nextActionOwnerRole: nextOwner?.nextActionOwnerRole ?? null,
        latestTaskStatus: (nextOwner?.status as "PENDING" | "IN_PROGRESS" | "OVERDUE" | "COMPLETED" | undefined) ?? null,
        lastActivityAt: lastActivityMap.get(item.id)?.toISOString() ?? null,
      };
    });

    res.json({
      items: enrichedItems,
      page,
      pageSize,
      total,
    });
  })
);

studentsRouter.get(
  "/me",
  authorize(RoleName.STUDENT),
  asyncHandler(async (req, res) => {
    const mine = await prisma.student.findFirst({
      where: { userAccountId: req.user!.id },
      select: { id: true },
    });
    if (!mine) {
      throw new HttpError(404, "No student profile is linked to this account.");
    }

    const student = await loadStudentProfile(mine.id);
    if (!student) {
      throw new HttpError(404, "Student profile not found.");
    }
    res.json(student);
  })
);

studentsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const studentId = Number(req.params.id);
    if (!Number.isFinite(studentId)) {
      throw new HttpError(400, "Invalid student ID.");
    }

    const allowed = await canReadStudent(req.user!, studentId);
    if (!allowed) {
      await logAccessDenied(req, "Student profile access denied by row-level policy.", {
        studentId,
      });
      throw new HttpError(403, "You are not authorized to access this student record.");
    }

    const student = await loadStudentProfile(studentId);
    if (!student) {
      throw new HttpError(404, "Student not found.");
    }

    res.json(student);
  })
);

studentsRouter.patch(
  "/:id/stage",
  authorize(
    RoleName.ADMIN,
    RoleName.GRADUATE_SCHOOL_STAFF,
    RoleName.ACADEMIC_COORDINATOR,
    RoleName.RESEARCH_COORDINATOR,
    RoleName.ADVISER
  ),
  asyncHandler(async (req, res) => {
    const studentId = Number(req.params.id);
    if (!Number.isFinite(studentId)) {
      throw new HttpError(400, "Invalid student ID.");
    }

    const parsed = updateStageSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "Invalid stage update payload.");
    }

    const allowed = await canUpdateStudentLifecycle(req.user!, studentId);
    if (!allowed) {
      await logAccessDenied(req, "Lifecycle stage update blocked by policy.", {
        studentId,
      });
      throw new HttpError(403, "You are not authorized to update lifecycle stage for this student.");
    }

    const existing = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, riskFlag: true },
    });

    if (!existing) {
      throw new HttpError(404, "Student not found.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id: studentId },
        data: {
          currentStage: parsed.data.stage,
          riskFlag: parsed.data.riskFlag ?? existing.riskFlag,
        },
      });

      await tx.studentLifecycle.updateMany({
        where: {
          studentId,
          exitedAt: null,
        },
        data: {
          exitedAt: new Date(),
        },
      });

      await tx.studentLifecycle.create({
        data: {
          studentId,
          stage: parsed.data.stage,
          enteredAt: new Date(),
          notes: parsed.data.notes,
          changedById: req.user!.id,
        },
      });
    });

    await logTimelineEvent({
      studentId,
      eventType: "STAGE_TRANSITION",
      title: `Stage changed to ${parsed.data.stage}`,
      details: parsed.data.notes,
      relatedEntityType: "Student",
      relatedEntityId: studentId,
      performedById: req.user!.id,
    });

    await logAudit({
      actorUserId: req.user!.id,
      actionType: AuditActionType.STATUS_TRANSITION,
      entityType: "Student",
      entityId: String(studentId),
      description: "Student lifecycle stage updated.",
      metadata: parsed.data,
      req,
    });

    res.json({ message: "Student stage updated." });
  })
);

studentsRouter.patch(
  "/:id/milestones/:milestoneId",
  authorize(
    RoleName.ADMIN,
    RoleName.GRADUATE_SCHOOL_STAFF,
    RoleName.ACADEMIC_COORDINATOR,
    RoleName.RESEARCH_COORDINATOR,
    RoleName.ADVISER
  ),
  asyncHandler(async (req, res) => {
    const studentId = Number(req.params.id);
    const milestoneDefinitionId = Number(req.params.milestoneId);
    if (!Number.isFinite(studentId) || !Number.isFinite(milestoneDefinitionId)) {
      throw new HttpError(400, "Invalid route parameters.");
    }

    const parsed = updateMilestoneSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "Invalid milestone update payload.");
    }

    const allowed = await canReadStudent(req.user!, studentId);
    if (!allowed) {
      await logAccessDenied(req, "Milestone update denied by row-level policy.", {
        studentId,
        milestoneDefinitionId,
      });
      throw new HttpError(403, "You are not authorized to update milestones for this student.");
    }

    const updated = await prisma.studentMilestoneStatus.upsert({
      where: {
        studentId_milestoneDefinitionId: {
          studentId,
          milestoneDefinitionId,
        },
      },
      update: {
        status: parsed.data.status,
        dueAt: parsed.data.dueAt,
        completedAt: parsed.data.completedAt,
        notes: parsed.data.notes ?? null,
        updatedById: req.user!.id,
      },
      create: {
        studentId,
        milestoneDefinitionId,
        status: parsed.data.status,
        dueAt: parsed.data.dueAt,
        completedAt: parsed.data.completedAt,
        notes: parsed.data.notes ?? null,
        updatedById: req.user!.id,
      },
      include: {
        milestoneDefinition: true,
      },
    });

    await logTimelineEvent({
      studentId,
      eventType: "MILESTONE_UPDATE",
      title: `${updated.milestoneDefinition.name} marked ${updated.status}`,
      details: parsed.data.notes ?? undefined,
      relatedEntityType: "StudentMilestoneStatus",
      relatedEntityId: updated.id,
      performedById: req.user!.id,
    });

    await logAudit({
      actorUserId: req.user!.id,
      actionType: AuditActionType.UPDATE,
      entityType: "StudentMilestoneStatus",
      entityId: String(updated.id),
      description: "Student milestone status updated.",
      metadata: parsed.data,
      req,
    });

    res.json(updated);
  })
);

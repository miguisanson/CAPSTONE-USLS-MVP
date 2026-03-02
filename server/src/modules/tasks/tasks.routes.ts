import { AuditActionType, RoleName, TaskDecision, TaskStatus } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { logAudit, logTimelineEvent } from "../../lib/audit";
import { prisma } from "../../lib/prisma";
import { authorize } from "../../middleware/authorize";
import { asyncHandler } from "../../utils/async-handler";
import { buildRecommendation, computePriorityScore } from "../../utils/decision-support";
import { HttpError } from "../../utils/http-error";
import { getPagination } from "../../utils/pagination";
import { buildStudentScopeWhere, buildTaskScopeWhere } from "../../utils/scope";

const createTaskSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional().nullable(),
  studentId: z.number().int().positive().optional().nullable(),
  milestoneDefinitionId: z.number().int().positive().optional().nullable(),
  assignedToId: z.number().int().positive().optional().nullable(),
  assignedRole: z.nativeEnum(RoleName).optional().nullable(),
  nextActionOwnerRole: z.nativeEnum(RoleName).optional().nullable(),
  dueAt: z.coerce.date().optional().nullable(),
});

const decisionSchema = z.object({
  decision: z.nativeEnum(TaskDecision),
  rationale: z.string().optional().nullable(),
});

const queueStatusSchema = z.enum(["PENDING", "IN_PROGRESS", "OVERDUE", "COMPLETED"]).optional();

const enrichTask = async (taskId: number): Promise<unknown> => {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      student: true,
      milestoneDefinition: true,
      assignedTo: { select: { id: true, fullName: true, email: true } },
    },
  });

  if (!task) return null;

  const escalationThreshold = await prisma.alertThreshold.findUnique({
    where: { key: "TASK_ESCALATION_DAYS" },
  });

  const priorityScore = computePriorityScore({
    dueAt: task.dueAt,
    stage: task.student?.currentStage,
    milestoneCriticality: task.milestoneDefinition?.criticality,
    taskStatus: task.status,
  });

  const rec = buildRecommendation({
    dueAt: task.dueAt,
    nextActionOwnerRole: task.nextActionOwnerRole,
    escalationThresholdDays: escalationThreshold?.thresholdDays,
  });

  await prisma.task.update({
    where: { id: task.id },
    data: {
      priorityScore,
      recommendedAction: rec.recommendedAction,
      escalationPrompt: rec.escalationPrompt,
      status:
        task.status !== TaskStatus.COMPLETED &&
        task.dueAt &&
        new Date(task.dueAt) < new Date() &&
        task.status !== TaskStatus.OVERDUE
          ? TaskStatus.OVERDUE
          : task.status,
    },
  });

  return {
    ...task,
    priorityScore,
    recommendedAction: rec.recommendedAction,
    escalationPrompt: rec.escalationPrompt,
  };
};

export const tasksRouter = Router();

tasksRouter.get(
  "/my",
  asyncHandler(async (req, res) => {
    const { skip, take, page, pageSize } = getPagination(req);
    const status = queueStatusSchema.parse(req.query.status);
    const scope = buildTaskScopeWhere(req.user!);

    const where = {
      AND: [
        scope,
        {
          OR: [{ assignedToId: req.user!.id }, { nextActionOwnerRole: { in: req.user!.roles } }],
        },
      ],
      status: status as TaskStatus | undefined,
    };

    const [items, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          student: { include: { program: true } },
          milestoneDefinition: true,
          assignedTo: { select: { id: true, fullName: true } },
        },
        orderBy: [{ priorityScore: "desc" }, { dueAt: "asc" }, { createdAt: "desc" }],
        skip,
        take,
      }),
      prisma.task.count({ where }),
    ]);

    const enriched = await Promise.all(items.map((task) => enrichTask(task.id)));
    res.json({ items: enriched, page, pageSize, total });
  })
);

tasksRouter.get(
  "/team",
  authorize(
    RoleName.ADMIN,
    RoleName.GRADUATE_SCHOOL_STAFF,
    RoleName.ACADEMIC_COORDINATOR,
    RoleName.RESEARCH_COORDINATOR
  ),
  asyncHandler(async (req, res) => {
    const { skip, take, page, pageSize } = getPagination(req);
    const status = queueStatusSchema.parse(req.query.status);

    const [items, total] = await Promise.all([
      prisma.task.findMany({
        where: {
          status: status as TaskStatus | undefined,
          OR: [
            { assignedRole: { in: req.user!.roles } },
            { nextActionOwnerRole: { in: req.user!.roles } },
            { assignedToId: null },
          ],
        },
        include: {
          student: { include: { program: true } },
          milestoneDefinition: true,
          assignedTo: { select: { id: true, fullName: true } },
        },
        orderBy: [{ priorityScore: "desc" }, { dueAt: "asc" }, { createdAt: "desc" }],
        skip,
        take,
      }),
      prisma.task.count({
        where: {
          status: status as TaskStatus | undefined,
        },
      }),
    ]);

    const enriched = await Promise.all(items.map((task) => enrichTask(task.id)));
    res.json({ items: enriched, page, pageSize, total });
  })
);

tasksRouter.post(
  "/",
  authorize(
    RoleName.ADMIN,
    RoleName.GRADUATE_SCHOOL_STAFF,
    RoleName.ACADEMIC_COORDINATOR,
    RoleName.RESEARCH_COORDINATOR,
    RoleName.ADVISER
  ),
  asyncHandler(async (req, res) => {
    const parsed = createTaskSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "Invalid task payload.");
    }

    const scope = buildStudentScopeWhere(req.user!);
    if (parsed.data.studentId) {
      const accessible = await prisma.student.findFirst({
        where: { AND: [scope, { id: parsed.data.studentId }] },
        select: { id: true },
      });
      if (!accessible) throw new HttpError(404, "Student not found or not accessible.");
    }

    const created = await prisma.task.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        studentId: parsed.data.studentId ?? null,
        milestoneDefinitionId: parsed.data.milestoneDefinitionId ?? null,
        assignedToId: parsed.data.assignedToId ?? null,
        assignedRole: parsed.data.assignedRole ?? null,
        nextActionOwnerRole: parsed.data.nextActionOwnerRole ?? parsed.data.assignedRole ?? null,
        dueAt: parsed.data.dueAt ?? null,
        createdById: req.user!.id,
      },
    });

    const enriched = await enrichTask(created.id);
    if (created.studentId) {
      await logTimelineEvent({
        studentId: created.studentId,
        eventType: "TASK_CREATED",
        title: created.title,
        details: created.description ?? undefined,
        relatedEntityType: "Task",
        relatedEntityId: created.id,
        performedById: req.user!.id,
      });
    }

    await logAudit({
      actorUserId: req.user!.id,
      actionType: AuditActionType.CREATE,
      entityType: "Task",
      entityId: String(created.id),
      description: "Workflow task created.",
      metadata: parsed.data,
      req,
    });

    res.status(201).json(enriched);
  })
);

tasksRouter.post(
  "/:id/decision",
  authorize(
    RoleName.ADMIN,
    RoleName.GRADUATE_SCHOOL_STAFF,
    RoleName.ACADEMIC_COORDINATOR,
    RoleName.RESEARCH_COORDINATOR,
    RoleName.ADVISER,
    RoleName.PANEL_MEMBER
  ),
  asyncHandler(async (req, res) => {
    const taskId = Number(req.params.id);
    if (!Number.isFinite(taskId)) throw new HttpError(400, "Invalid task ID.");

    const parsed = decisionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "Invalid decision payload.");
    }

    const scopedTask = await prisma.task.findFirst({
      where: {
        AND: [buildTaskScopeWhere(req.user!), { id: taskId }],
      },
      include: {
        student: true,
        milestoneDefinition: true,
      },
    });

    if (!scopedTask) throw new HttpError(404, "Task not found or not accessible.");

    const decisionToStatus: Record<TaskDecision, TaskStatus> = {
      APPROVE: TaskStatus.COMPLETED,
      REVISE: TaskStatus.PENDING,
      RETURN: TaskStatus.PENDING,
    };

    const updatedTask = await prisma.$transaction(async (tx) => {
      const task = await tx.task.update({
        where: { id: taskId },
        data: {
          status: decisionToStatus[parsed.data.decision],
          closedAt: parsed.data.decision === TaskDecision.APPROVE ? new Date() : null,
          nextActionOwnerRole:
            parsed.data.decision === TaskDecision.APPROVE
              ? RoleName.GRADUATE_SCHOOL_STAFF
              : parsed.data.decision === TaskDecision.REVISE
                ? RoleName.STUDENT
                : RoleName.ADVISER,
        },
      });

      await tx.decisionLog.create({
        data: {
          taskId,
          studentId: task.studentId,
          decision: parsed.data.decision,
          rationale: parsed.data.rationale ?? null,
          decidedById: req.user!.id,
        },
      });

      if (task.studentId && parsed.data.decision !== TaskDecision.APPROVE) {
        const student = await tx.student.findUnique({
          where: { id: task.studentId },
        });

        if (student) {
          const routingRule = await tx.routingRule.findFirst({
            where: {
              fromStage: student.currentStage,
              decision: parsed.data.decision,
              active: true,
            },
            orderBy: { id: "asc" },
          });

          if (routingRule) {
            await tx.task.create({
              data: {
                title: routingRule.taskTemplate,
                studentId: student.id,
                assignedRole: routingRule.nextOwnerRole,
                nextActionOwnerRole: routingRule.nextOwnerRole,
                status: TaskStatus.PENDING,
                createdById: req.user!.id,
                dueAt: task.dueAt,
              },
            });
          }
        }
      }

      return task;
    });

    const enriched = await enrichTask(updatedTask.id);

    if (updatedTask.studentId) {
      await logTimelineEvent({
        studentId: updatedTask.studentId,
        eventType: "TASK_DECISION",
        title: `Task ${parsed.data.decision}`,
        details: parsed.data.rationale ?? undefined,
        relatedEntityType: "Task",
        relatedEntityId: updatedTask.id,
        performedById: req.user!.id,
      });
    }

    await logAudit({
      actorUserId: req.user!.id,
      actionType: AuditActionType.DECISION,
      entityType: "Task",
      entityId: String(updatedTask.id),
      description: `Task decision recorded: ${parsed.data.decision}`,
      metadata: parsed.data,
      req,
    });

    res.json(enriched);
  })
);

import { AlertStatus, AuditActionType, InterventionStatus, RoleName } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { logAudit, logTimelineEvent } from "../../lib/audit";
import { prisma } from "../../lib/prisma";
import { authorize } from "../../middleware/authorize";
import { asyncHandler } from "../../utils/async-handler";
import { HttpError } from "../../utils/http-error";
import { getPagination } from "../../utils/pagination";
import { buildStudentScopeWhere } from "../../utils/scope";
import { runMonitoringCycle } from "./monitoring.service";

const createInterventionSchema = z.object({
  actionTaken: z.string().min(3),
  evidenceNote: z.string().optional().nullable(),
});

const closeInterventionSchema = z.object({
  closureEvidence: z.string().min(3),
});

const updateAlertStatusSchema = z.object({
  status: z.nativeEnum(AlertStatus),
});

export const alertsRouter = Router();

alertsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { skip, take, page, pageSize } = getPagination(req);
    const status = req.query.status ? (String(req.query.status) as AlertStatus) : undefined;
    const studentId = req.query.studentId ? Number(req.query.studentId) : undefined;
    const scope = buildStudentScopeWhere(req.user!);

    const where = {
      status: status ?? undefined,
      studentId: Number.isFinite(studentId) ? studentId : undefined,
      student: scope,
    };

    const [items, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        include: {
          student: {
            include: {
              program: true,
            },
          },
          task: true,
          interventions: {
            include: { performedBy: { select: { id: true, fullName: true } } },
            orderBy: { performedAt: "desc" },
          },
          notifications: {
            orderBy: { sentAt: "desc" },
            take: 20,
          },
        },
        orderBy: { triggeredAt: "desc" },
        skip,
        take,
      }),
      prisma.alert.count({ where }),
    ]);

    res.json({ items, page, pageSize, total });
  })
);

alertsRouter.post(
  "/run-monitoring",
  authorize(
    RoleName.ADMIN,
    RoleName.GRADUATE_SCHOOL_STAFF,
    RoleName.ACADEMIC_COORDINATOR,
    RoleName.RESEARCH_COORDINATOR
  ),
  asyncHandler(async (req, res) => {
    const summary = await runMonitoringCycle(req.user!.id);
    res.json(summary);
  })
);

alertsRouter.patch(
  "/:id/status",
  authorize(
    RoleName.ADMIN,
    RoleName.GRADUATE_SCHOOL_STAFF,
    RoleName.ACADEMIC_COORDINATOR,
    RoleName.RESEARCH_COORDINATOR,
    RoleName.ADVISER
  ),
  asyncHandler(async (req, res) => {
    const alertId = Number(req.params.id);
    if (!Number.isFinite(alertId)) throw new HttpError(400, "Invalid alert ID.");
    const parsed = updateAlertStatusSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid payload.");

    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
      include: { student: true },
    });
    if (!alert) throw new HttpError(404, "Alert not found.");

    const access = await prisma.student.findFirst({
      where: { AND: [buildStudentScopeWhere(req.user!), { id: alert.studentId }] },
      select: { id: true },
    });
    if (!access) throw new HttpError(403, "Student scope denied.");

    const updated = await prisma.alert.update({
      where: { id: alertId },
      data: {
        status: parsed.data.status,
        resolvedAt: parsed.data.status === AlertStatus.CLOSED ? new Date() : null,
        closedById: parsed.data.status === AlertStatus.CLOSED ? req.user!.id : null,
      },
    });

    await logTimelineEvent({
      studentId: alert.studentId,
      eventType: "ALERT_STATUS_UPDATED",
      title: `Alert ${parsed.data.status.toLowerCase()}`,
      relatedEntityType: "Alert",
      relatedEntityId: alertId,
      performedById: req.user!.id,
    });

    await logAudit({
      actorUserId: req.user!.id,
      actionType:
        parsed.data.status === AlertStatus.CLOSED
          ? AuditActionType.ALERT_RESOLVED
          : AuditActionType.UPDATE,
      entityType: "Alert",
      entityId: String(alertId),
      description: `Alert status updated to ${parsed.data.status}.`,
      metadata: parsed.data,
      req,
    });

    res.json(updated);
  })
);

alertsRouter.post(
  "/:id/interventions",
  authorize(
    RoleName.ADMIN,
    RoleName.GRADUATE_SCHOOL_STAFF,
    RoleName.ACADEMIC_COORDINATOR,
    RoleName.RESEARCH_COORDINATOR,
    RoleName.ADVISER
  ),
  asyncHandler(async (req, res) => {
    const alertId = Number(req.params.id);
    if (!Number.isFinite(alertId)) throw new HttpError(400, "Invalid alert ID.");

    const parsed = createInterventionSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid intervention payload.");

    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
    });
    if (!alert) throw new HttpError(404, "Alert not found.");

    const access = await prisma.student.findFirst({
      where: { AND: [buildStudentScopeWhere(req.user!), { id: alert.studentId }] },
      select: { id: true },
    });
    if (!access) throw new HttpError(403, "Student scope denied.");

    const intervention = await prisma.intervention.create({
      data: {
        alertId,
        actionTaken: parsed.data.actionTaken,
        evidenceNote: parsed.data.evidenceNote ?? null,
        performedById: req.user!.id,
        status: InterventionStatus.OPEN,
      },
    });

    await prisma.alert.update({
      where: { id: alertId },
      data: { status: AlertStatus.ACKNOWLEDGED },
    });

    await logTimelineEvent({
      studentId: alert.studentId,
      eventType: "INTERVENTION_LOGGED",
      title: "Intervention logged",
      details: parsed.data.actionTaken,
      relatedEntityType: "Intervention",
      relatedEntityId: intervention.id,
      performedById: req.user!.id,
    });

    await logAudit({
      actorUserId: req.user!.id,
      actionType: AuditActionType.CREATE,
      entityType: "Intervention",
      entityId: String(intervention.id),
      description: "Intervention logged on alert.",
      metadata: parsed.data,
      req,
    });

    res.status(201).json(intervention);
  })
);

alertsRouter.patch(
  "/interventions/:id/close",
  authorize(
    RoleName.ADMIN,
    RoleName.GRADUATE_SCHOOL_STAFF,
    RoleName.ACADEMIC_COORDINATOR,
    RoleName.RESEARCH_COORDINATOR,
    RoleName.ADVISER
  ),
  asyncHandler(async (req, res) => {
    const interventionId = Number(req.params.id);
    if (!Number.isFinite(interventionId)) throw new HttpError(400, "Invalid intervention ID.");

    const parsed = closeInterventionSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid closure payload.");

    const intervention = await prisma.intervention.findUnique({
      where: { id: interventionId },
      include: { alert: true },
    });
    if (!intervention) throw new HttpError(404, "Intervention not found.");

    const access = await prisma.student.findFirst({
      where: { AND: [buildStudentScopeWhere(req.user!), { id: intervention.alert.studentId }] },
      select: { id: true },
    });
    if (!access) throw new HttpError(403, "Student scope denied.");

    const updated = await prisma.$transaction(async (tx) => {
      const closedIntervention = await tx.intervention.update({
        where: { id: interventionId },
        data: {
          status: InterventionStatus.CLOSED,
          closedAt: new Date(),
          closureEvidence: parsed.data.closureEvidence,
        },
      });

      const openInterventions = await tx.intervention.count({
        where: { alertId: intervention.alertId, status: InterventionStatus.OPEN },
      });

      if (openInterventions === 0) {
        await tx.alert.update({
          where: { id: intervention.alertId },
          data: {
            status: AlertStatus.CLOSED,
            resolvedAt: new Date(),
            closedById: req.user!.id,
          },
        });
      }

      return closedIntervention;
    });

    await logTimelineEvent({
      studentId: intervention.alert.studentId,
      eventType: "INTERVENTION_CLOSED",
      title: "Intervention closed",
      details: parsed.data.closureEvidence,
      relatedEntityType: "Intervention",
      relatedEntityId: interventionId,
      performedById: req.user!.id,
    });

    await logAudit({
      actorUserId: req.user!.id,
      actionType: AuditActionType.ALERT_RESOLVED,
      entityType: "Intervention",
      entityId: String(interventionId),
      description: "Intervention closed with evidence.",
      metadata: parsed.data,
      req,
    });

    res.json(updated);
  })
);


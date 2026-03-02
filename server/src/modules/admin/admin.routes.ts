import { AuditActionType, LifecycleStage, RoleName, TaskDecision } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { logAudit } from "../../lib/audit";
import { prisma } from "../../lib/prisma";
import { authorize } from "../../middleware/authorize";
import { asyncHandler } from "../../utils/async-handler";
import { HttpError } from "../../utils/http-error";

const thresholdSchema = z.object({
  key: z.string().min(2),
  stage: z.nativeEnum(LifecycleStage).optional().nullable(),
  thresholdDays: z.number().int().min(1).max(365),
  enabled: z.boolean().optional().default(true),
  description: z.string().min(3),
});

const updateThresholdSchema = thresholdSchema.partial();

const routingSchema = z.object({
  fromStage: z.nativeEnum(LifecycleStage),
  decision: z.nativeEnum(TaskDecision).optional().nullable(),
  nextOwnerRole: z.nativeEnum(RoleName),
  taskTemplate: z.string().min(3),
  active: z.boolean().optional().default(true),
});

const updateRoutingSchema = routingSchema.partial();

export const adminRouter = Router();
adminRouter.use(authorize(RoleName.ADMIN));

adminRouter.get(
  "/thresholds",
  asyncHandler(async (_req, res) => {
    const items = await prisma.alertThreshold.findMany({
      orderBy: [{ key: "asc" }],
    });
    res.json(items);
  })
);

adminRouter.post(
  "/thresholds",
  asyncHandler(async (req, res) => {
    const parsed = thresholdSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid threshold payload.");

    const created = await prisma.alertThreshold.create({
      data: {
        ...parsed.data,
        createdById: req.user!.id,
        updatedById: req.user!.id,
      },
    });

    await logAudit({
      actorUserId: req.user!.id,
      actionType: AuditActionType.CONFIG_CHANGE,
      entityType: "AlertThreshold",
      entityId: String(created.id),
      description: "Threshold created.",
      metadata: parsed.data,
      req,
    });

    res.status(201).json(created);
  })
);

adminRouter.patch(
  "/thresholds/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw new HttpError(400, "Invalid threshold ID.");

    const parsed = updateThresholdSchema.safeParse(req.body);
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      throw new HttpError(400, "Invalid threshold update payload.");
    }

    const updated = await prisma.alertThreshold.update({
      where: { id },
      data: {
        ...parsed.data,
        updatedById: req.user!.id,
      },
    });

    await logAudit({
      actorUserId: req.user!.id,
      actionType: AuditActionType.CONFIG_CHANGE,
      entityType: "AlertThreshold",
      entityId: String(updated.id),
      description: "Threshold updated.",
      metadata: parsed.data,
      req,
    });

    res.json(updated);
  })
);

adminRouter.get(
  "/routing-rules",
  asyncHandler(async (_req, res) => {
    const items = await prisma.routingRule.findMany({
      orderBy: [{ fromStage: "asc" }, { decision: "asc" }],
    });
    res.json(items);
  })
);

adminRouter.post(
  "/routing-rules",
  asyncHandler(async (req, res) => {
    const parsed = routingSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid routing rule payload.");

    const created = await prisma.routingRule.create({
      data: {
        ...parsed.data,
        createdById: req.user!.id,
        updatedById: req.user!.id,
      },
    });

    await logAudit({
      actorUserId: req.user!.id,
      actionType: AuditActionType.CONFIG_CHANGE,
      entityType: "RoutingRule",
      entityId: String(created.id),
      description: "Routing rule created.",
      metadata: parsed.data,
      req,
    });

    res.status(201).json(created);
  })
);

adminRouter.patch(
  "/routing-rules/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) throw new HttpError(400, "Invalid routing rule ID.");

    const parsed = updateRoutingSchema.safeParse(req.body);
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      throw new HttpError(400, "Invalid routing update payload.");
    }

    const updated = await prisma.routingRule.update({
      where: { id },
      data: {
        ...parsed.data,
        updatedById: req.user!.id,
      },
    });

    await logAudit({
      actorUserId: req.user!.id,
      actionType: AuditActionType.CONFIG_CHANGE,
      entityType: "RoutingRule",
      entityId: String(updated.id),
      description: "Routing rule updated.",
      metadata: parsed.data,
      req,
    });

    res.json(updated);
  })
);


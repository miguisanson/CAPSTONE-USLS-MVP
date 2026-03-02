import { AuditActionType, LifecycleStage, RoleName } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { logAudit } from "../../lib/audit";
import { prisma } from "../../lib/prisma";
import { authorize } from "../../middleware/authorize";
import { asyncHandler } from "../../utils/async-handler";
import { HttpError } from "../../utils/http-error";

const milestoneSchema = z.object({
  name: z.string().min(2),
  stage: z.nativeEnum(LifecycleStage),
  description: z.string().optional().nullable(),
  expectedDays: z.number().int().min(1).max(365).optional().default(14),
  criticality: z.number().int().min(1).max(5).optional().default(1),
  active: z.boolean().optional().default(true),
  sortOrder: z.number().int().optional().default(0),
});

const milestoneUpdateSchema = milestoneSchema.partial();

export const milestonesRouter = Router();

milestonesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const stage = req.query.stage ? (String(req.query.stage) as LifecycleStage) : undefined;
    const active = req.query.active === undefined ? undefined : String(req.query.active) === "true";

    const items = await prisma.milestoneDefinition.findMany({
      where: {
        stage: stage ?? undefined,
        active: active ?? undefined,
      },
      orderBy: [{ stage: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });

    res.json(items);
  })
);

milestonesRouter.post(
  "/",
  authorize(RoleName.ADMIN),
  asyncHandler(async (req, res) => {
    const parsed = milestoneSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "Invalid milestone payload.");
    }

    const created = await prisma.milestoneDefinition.create({
      data: {
        ...parsed.data,
        createdById: req.user!.id,
      },
    });

    await logAudit({
      actorUserId: req.user!.id,
      actionType: AuditActionType.CONFIG_CHANGE,
      entityType: "MilestoneDefinition",
      entityId: String(created.id),
      description: "Milestone definition created.",
      metadata: parsed.data,
      req,
    });

    res.status(201).json(created);
  })
);

milestonesRouter.patch(
  "/:id",
  authorize(RoleName.ADMIN),
  asyncHandler(async (req, res) => {
    const milestoneId = Number(req.params.id);
    if (!Number.isFinite(milestoneId)) {
      throw new HttpError(400, "Invalid milestone ID.");
    }

    const parsed = milestoneUpdateSchema.safeParse(req.body);
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      throw new HttpError(400, "Invalid milestone update payload.");
    }

    const existing = await prisma.milestoneDefinition.findUnique({
      where: { id: milestoneId },
    });
    if (!existing) {
      throw new HttpError(404, "Milestone definition not found.");
    }

    const updated = await prisma.milestoneDefinition.update({
      where: { id: milestoneId },
      data: parsed.data,
    });

    await logAudit({
      actorUserId: req.user!.id,
      actionType: AuditActionType.CONFIG_CHANGE,
      entityType: "MilestoneDefinition",
      entityId: String(updated.id),
      description: "Milestone definition updated.",
      metadata: parsed.data,
      req,
    });

    res.json(updated);
  })
);


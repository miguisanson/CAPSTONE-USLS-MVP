import { AuditActionType, RoleName } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { authorize } from "../../middleware/authorize";
import { asyncHandler } from "../../utils/async-handler";
import { getPagination } from "../../utils/pagination";

export const auditRouter = Router();

auditRouter.get(
  "/",
  authorize(
    RoleName.ADMIN,
    RoleName.GRADUATE_SCHOOL_STAFF,
    RoleName.ACADEMIC_COORDINATOR,
    RoleName.RESEARCH_COORDINATOR
  ),
  asyncHandler(async (req, res) => {
    const { skip, take, page, pageSize } = getPagination(req);
    const actorUserId = req.query.userId ? Number(req.query.userId) : undefined;
    const actionType = req.query.actionType ? (String(req.query.actionType) as AuditActionType) : undefined;
    const entityType = req.query.entityType ? String(req.query.entityType) : undefined;
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;

    const where = {
      actorUserId: Number.isFinite(actorUserId) ? actorUserId : undefined,
      actionType: actionType ?? undefined,
      entityType: entityType ?? undefined,
      createdAt:
        from || to
          ? {
              gte: from,
              lte: to,
            }
          : undefined,
    };

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({ items, page, pageSize, total });
  })
);


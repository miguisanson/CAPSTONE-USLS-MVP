import { AuditActionType } from "@prisma/client";
import { Router } from "express";
import { canAccessAudit, logAccessDenied } from "../../auth/policy";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../utils/async-handler";
import { getPagination } from "../../utils/pagination";
import { HttpError } from "../../utils/http-error";

export const auditRouter = Router();

auditRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!canAccessAudit(req.user!)) {
      await logAccessDenied(req, "Audit log access denied.");
      throw new HttpError(403, "You are not authorized to access audit logs.");
    }

    const { skip, take, page, pageSize } = getPagination(req);
    const actorUserId = req.query.userId ? Number(req.query.userId) : undefined;
    const actionType = req.query.actionType ? (String(req.query.actionType) as AuditActionType) : undefined;
    const entityType = req.query.entityType ? String(req.query.entityType) : undefined;
    const entityId = req.query.entityId ? String(req.query.entityId) : undefined;
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;

    const where = {
      actorUserId: Number.isFinite(actorUserId) ? actorUserId : undefined,
      actionType: actionType ?? undefined,
      entityType: entityType ?? undefined,
      entityId: entityId ?? undefined,
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

    res.json({
      items: items.map((item) => ({
        ...item,
        id: item.id.toString(),
      })),
      page,
      pageSize,
      total,
    });
  })
);

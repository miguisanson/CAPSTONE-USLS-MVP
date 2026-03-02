import { AuditActionType, RoleName } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { logAudit } from "../lib/audit";

export const authorize =
  (...allowedRoles: RoleName[]) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ message: "Authentication is required." });
      return;
    }

    const canAccess = req.user.roles.some((role) => allowedRoles.includes(role));
    if (!canAccess) {
      await logAudit({
        actorUserId: req.user.id,
        actionType: AuditActionType.ACCESS_DENIED,
        entityType: "Route",
        entityId: req.originalUrl,
        description: "Role blocked by RBAC middleware.",
        metadata: {
          requiredRoles: allowedRoles,
          userRoles: req.user.roles,
        },
        req,
      });
      res.status(403).json({ message: "You are not authorized to perform this action." });
      return;
    }

    next();
  };


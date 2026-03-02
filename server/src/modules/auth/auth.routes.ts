import { AuditActionType } from "@prisma/client";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signAccessToken } from "../../lib/auth";
import { logAudit } from "../../lib/audit";
import { prisma } from "../../lib/prisma";
import { authenticate } from "../../middleware/authenticate";
import { asyncHandler } from "../../utils/async-handler";
import { HttpError } from "../../utils/http-error";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRouter = Router();

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "Invalid login payload.");
    }

    const user = await prisma.userAccount.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
      include: {
        roles: { include: { role: true } },
        studentProfile: true,
      },
    });

    if (!user) {
      await logAudit({
        actionType: AuditActionType.LOGIN_FAILED,
        entityType: "UserAccount",
        description: "Login attempt with unknown email.",
        metadata: { email: parsed.data.email },
        req,
      });
      throw new HttpError(401, "Invalid email or password.");
    }

    const passwordMatches = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!passwordMatches) {
      await logAudit({
        actorUserId: user.id,
        actionType: AuditActionType.LOGIN_FAILED,
        entityType: "UserAccount",
        entityId: String(user.id),
        description: "Login attempt with invalid password.",
        req,
      });
      throw new HttpError(401, "Invalid email or password.");
    }

    if (!user.isActive) {
      throw new HttpError(403, "Account is inactive.");
    }

    const authUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: user.roles.map((item) => item.role.name),
    };
    const token = signAccessToken(authUser);

    await logAudit({
      actorUserId: user.id,
      actionType: AuditActionType.LOGIN_SUCCESS,
      entityType: "UserAccount",
      entityId: String(user.id),
      description: "User login successful.",
      req,
    });

    res.json({
      token,
      user: {
        ...authUser,
        studentId: user.studentProfile?.id ?? null,
      },
    });
  })
);

authRouter.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.userAccount.findUnique({
      where: { id: req.user!.id },
      include: {
        roles: { include: { role: true } },
        studentProfile: true,
      },
    });

    if (!user) {
      throw new HttpError(404, "User not found.");
    }

    res.json({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: user.roles.map((item) => item.role.name),
      studentId: user.studentProfile?.id ?? null,
      isActive: user.isActive,
    });
  })
);

authRouter.post(
  "/logout-me",
  authenticate,
  asyncHandler(async (req, res) => {
    await logAudit({
      actorUserId: req.user!.id,
      actionType: AuditActionType.LOGOUT,
      entityType: "UserAccount",
      entityId: String(req.user!.id),
      description: "User logged out.",
      req,
    });
    res.status(204).send();
  })
);


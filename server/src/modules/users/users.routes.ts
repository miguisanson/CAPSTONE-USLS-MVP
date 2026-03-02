import { AuditActionType, RoleName } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { logAudit } from "../../lib/audit";
import { prisma } from "../../lib/prisma";
import { authorize } from "../../middleware/authorize";
import { asyncHandler } from "../../utils/async-handler";
import { HttpError } from "../../utils/http-error";
import { getPagination } from "../../utils/pagination";

const createUserSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  roles: z.array(z.nativeEnum(RoleName)).nonempty(),
  isActive: z.boolean().optional().default(true),
});

const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  roles: z.array(z.nativeEnum(RoleName)).optional(),
  isActive: z.boolean().optional(),
});

export const usersRouter = Router();

usersRouter.use(authorize(RoleName.ADMIN));

usersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { skip, take, page, pageSize } = getPagination(req);
    const q = String(req.query.q ?? "").trim();
    const where = q
      ? {
          OR: [
            { email: { contains: q } },
            { fullName: { contains: q } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      prisma.userAccount.findMany({
        where,
        include: { roles: { include: { role: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.userAccount.count({ where }),
    ]);

    res.json({
      items: items.map((item) => ({
        id: item.id,
        fullName: item.fullName,
        email: item.email,
        isActive: item.isActive,
        createdAt: item.createdAt,
        roles: item.roles.map((userRole) => userRole.role.name),
      })),
      page,
      pageSize,
      total,
    });
  })
);

usersRouter.get(
  "/roles",
  asyncHandler(async (_req, res) => {
    res.json(Object.values(RoleName));
  })
);

usersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "Invalid user payload.");
    }

    const existing = await prisma.userAccount.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (existing) {
      throw new HttpError(409, "Email already exists.");
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const roles = await prisma.role.findMany({
      where: { name: { in: parsed.data.roles } },
    });

    const created = await prisma.userAccount.create({
      data: {
        fullName: parsed.data.fullName,
        email: parsed.data.email.toLowerCase(),
        passwordHash,
        isActive: parsed.data.isActive,
        roles: {
          create: roles.map((role) => ({
            roleId: role.id,
          })),
        },
      },
      include: {
        roles: { include: { role: true } },
      },
    });

    await logAudit({
      actorUserId: req.user!.id,
      actionType: AuditActionType.CREATE,
      entityType: "UserAccount",
      entityId: String(created.id),
      description: "Admin created user account.",
      metadata: { roles: parsed.data.roles },
      req,
    });

    res.status(201).json({
      id: created.id,
      fullName: created.fullName,
      email: created.email,
      isActive: created.isActive,
      roles: created.roles.map((item) => item.role.name),
    });
  })
);

usersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const userId = Number(req.params.id);
    if (!Number.isFinite(userId)) {
      throw new HttpError(400, "Invalid user ID.");
    }

    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "Invalid user update payload.");
    }

    const existing = await prisma.userAccount.findUnique({
      where: { id: userId },
      include: { roles: true },
    });
    if (!existing) {
      throw new HttpError(404, "User not found.");
    }

    const updateData: Parameters<typeof prisma.userAccount.update>[0]["data"] = {};

    if (parsed.data.fullName !== undefined) updateData.fullName = parsed.data.fullName;
    if (parsed.data.email !== undefined) updateData.email = parsed.data.email.toLowerCase();
    if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;
    if (parsed.data.password) {
      updateData.passwordHash = await bcrypt.hash(parsed.data.password, 10);
    }

    await prisma.$transaction(async (tx) => {
      await tx.userAccount.update({
        where: { id: userId },
        data: updateData,
      });

      if (parsed.data.roles) {
        await tx.userRole.deleteMany({ where: { userId } });
        const roles = await tx.role.findMany({ where: { name: { in: parsed.data.roles } } });
        await tx.userRole.createMany({
          data: roles.map((role) => ({
            userId,
            roleId: role.id,
          })),
        });
      }
    });

    const updated = await prisma.userAccount.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });

    await logAudit({
      actorUserId: req.user!.id,
      actionType: AuditActionType.UPDATE,
      entityType: "UserAccount",
      entityId: String(userId),
      description: "Admin updated user account.",
      metadata: parsed.data,
      req,
    });

    res.json({
      id: updated!.id,
      fullName: updated!.fullName,
      email: updated!.email,
      isActive: updated!.isActive,
      roles: updated!.roles.map((item) => item.role.name),
    });
  })
);


import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/auth";
import { prisma } from "../lib/prisma";

const getBearerToken = (header?: string): string | null => {
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
};

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ message: "Missing authentication token." });
    return;
  }

  try {
    const decoded = verifyAccessToken(token);
    const userId = Number(decoded.sub);
    const user = await prisma.userAccount.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });

    if (!user || !user.isActive) {
      res.status(401).json({ message: "Invalid or inactive account." });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: user.roles.map((roleItem) => roleItem.role.name),
    };

    next();
  } catch {
    res.status(401).json({ message: "Invalid authentication token." });
  }
};


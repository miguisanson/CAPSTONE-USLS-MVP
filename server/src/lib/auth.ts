import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import type { AuthUser } from "../types/auth";

type JwtPayload = {
  sub: string;
  email: string;
  fullName: string;
  roles: string[];
};

export const signAccessToken = (user: AuthUser): string =>
  jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      fullName: user.fullName,
      roles: user.roles,
    },
    env.JWT_SECRET as Secret,
    { expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"] }
  );

export const verifyAccessToken = (token: string): JwtPayload =>
  jwt.verify(token, env.JWT_SECRET) as JwtPayload;

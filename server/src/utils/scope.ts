import type { Prisma } from "@prisma/client";
import { buildStudentAccessWhere, buildTaskAccessWhere } from "../auth/policy";
import type { AuthUser } from "../types/auth";

export const buildStudentScopeWhere = (user: AuthUser): Prisma.StudentWhereInput =>
  buildStudentAccessWhere(user);

export const buildTaskScopeWhere = (user: AuthUser): Prisma.TaskWhereInput => buildTaskAccessWhere(user);

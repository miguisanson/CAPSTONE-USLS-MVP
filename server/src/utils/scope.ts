import { Prisma, RoleName } from "@prisma/client";
import { BROAD_ACCESS_ROLES } from "../config/roles";
import type { AuthUser } from "../types/auth";

const hasBroadAccess = (roles: RoleName[]): boolean => roles.some((role) => BROAD_ACCESS_ROLES.includes(role));

export const buildStudentScopeWhere = (user: AuthUser): Prisma.StudentWhereInput => {
  if (hasBroadAccess(user.roles)) {
    return {};
  }

  const scopedOr: Prisma.StudentWhereInput[] = [];

  if (user.roles.includes(RoleName.STUDENT)) {
    scopedOr.push({ userAccountId: user.id });
  }

  if (user.roles.includes(RoleName.ADVISER)) {
    scopedOr.push({ adviserId: user.id });
  }

  if (user.roles.includes(RoleName.PANEL_MEMBER)) {
    scopedOr.push({ panelAssignments: { some: { panelMemberId: user.id } } });
  }

  if (scopedOr.length === 0) {
    return { id: -1 };
  }

  return { OR: scopedOr };
};

export const buildTaskScopeWhere = (user: AuthUser): Prisma.TaskWhereInput => {
  if (hasBroadAccess(user.roles)) {
    return {};
  }

  const studentScope = buildStudentScopeWhere(user);
  return {
    OR: [
      { assignedToId: user.id },
      {
        student: studentScope,
      },
    ],
  };
};


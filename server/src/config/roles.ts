import { RoleName } from "@prisma/client";

export const TEAM_QUEUE_ROLES: RoleName[] = [
  RoleName.ADMIN,
  RoleName.GRADUATE_SCHOOL_STAFF,
  RoleName.ACADEMIC_COORDINATOR,
  RoleName.RESEARCH_COORDINATOR,
];

export const BROAD_ACCESS_ROLES: RoleName[] = [
  RoleName.ADMIN,
  RoleName.GRADUATE_SCHOOL_STAFF,
  RoleName.ACADEMIC_COORDINATOR,
  RoleName.RESEARCH_COORDINATOR,
];

export const STUDENT_RELATED_ROLES: RoleName[] = [
  RoleName.ADVISER,
  RoleName.PANEL_MEMBER,
  RoleName.STUDENT,
];

export const canViewAllStudents = (roles: RoleName[]): boolean =>
  roles.some((role) => BROAD_ACCESS_ROLES.includes(role));

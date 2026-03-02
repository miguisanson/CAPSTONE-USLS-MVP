import type { RoleName } from "../types/domain";

export const roleLabel = (role: RoleName): string => role.replace(/_/g, " ");

export const hasAnyRole = (roles: RoleName[], allowed: RoleName[]): boolean =>
  roles.some((role) => allowed.includes(role));

export const canViewTeamQueue = (roles: RoleName[]): boolean =>
  hasAnyRole(roles, ["ADMIN", "GRADUATE_SCHOOL_STAFF", "ACADEMIC_COORDINATOR", "RESEARCH_COORDINATOR"]);

export const canAccessAnalytics = (roles: RoleName[]): boolean =>
  hasAnyRole(roles, ["ADMIN", "GRADUATE_SCHOOL_STAFF", "ACADEMIC_COORDINATOR", "RESEARCH_COORDINATOR"]);

export const canAccessAudit = (roles: RoleName[]): boolean =>
  hasAnyRole(roles, ["ADMIN", "GRADUATE_SCHOOL_STAFF", "ACADEMIC_COORDINATOR", "RESEARCH_COORDINATOR"]);

export const canSubmitTaskDecisions = (roles: RoleName[]): boolean =>
  hasAnyRole(roles, [
    "ADMIN",
    "GRADUATE_SCHOOL_STAFF",
    "ACADEMIC_COORDINATOR",
    "RESEARCH_COORDINATOR",
    "ADVISER",
    "PANEL_MEMBER",
  ]);

export const canAccessAdmin = (roles: RoleName[]): boolean => roles.includes("ADMIN");

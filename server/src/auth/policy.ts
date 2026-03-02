import { AuditActionType, RoleName, type Prisma } from "@prisma/client";
import type { Request } from "express";
import { logAudit } from "../lib/audit";
import { prisma } from "../lib/prisma";
import type { AuthUser } from "../types/auth";

const BROAD_ACCESS_ROLES: RoleName[] = [
  RoleName.ADMIN,
  RoleName.GRADUATE_SCHOOL_STAFF,
  RoleName.ACADEMIC_COORDINATOR,
  RoleName.RESEARCH_COORDINATOR,
];

const ANALYTICS_ROLES: RoleName[] = [...BROAD_ACCESS_ROLES];
const AUDIT_ROLES: RoleName[] = [...BROAD_ACCESS_ROLES];

export type TaskScope = "my" | "team";

export const hasAnyRole = (user: AuthUser, roles: RoleName[]): boolean =>
  user.roles.some((role) => roles.includes(role));

export const canReadAllStudents = (user: AuthUser): boolean =>
  hasAnyRole(user, BROAD_ACCESS_ROLES);

export const buildStudentAccessWhere = (user: AuthUser): Prisma.StudentWhereInput => {
  if (canReadAllStudents(user)) {
    return {};
  }

  const scopedOr: Prisma.StudentWhereInput[] = [];

  if (user.roles.includes(RoleName.STUDENT)) {
    scopedOr.push({ userAccountId: user.id });
  }

  if (user.roles.includes(RoleName.ADVISER)) {
    scopedOr.push({
      OR: [{ adviserId: user.id }, { adviserAssignments: { some: { adviserUserId: user.id } } }],
    });
  }

  if (user.roles.includes(RoleName.PANEL_MEMBER)) {
    scopedOr.push({
      OR: [
        { panelAssignments: { some: { panelMemberId: user.id } } },
        { panelAssignmentsV2: { some: { panelUserId: user.id } } },
      ],
    });
  }

  if (scopedOr.length === 0) {
    return { id: -1 };
  }

  return { OR: scopedOr };
};

export const buildTaskAccessWhere = (user: AuthUser): Prisma.TaskWhereInput => {
  if (canReadAllStudents(user)) {
    return {};
  }

  return {
    OR: [
      { assignedToId: user.id },
      { nextActionOwnerRole: { in: user.roles } },
      { student: buildStudentAccessWhere(user) },
    ],
  };
};

export const canReadStudent = async (user: AuthUser, studentId: number): Promise<boolean> => {
  if (!Number.isFinite(studentId)) return false;
  const count = await prisma.student.count({
    where: {
      AND: [buildStudentAccessWhere(user), { id: studentId }],
    },
  });
  return count > 0;
};

export const canUpdateStudentLifecycle = async (user: AuthUser, studentId: number): Promise<boolean> => {
  if (!Number.isFinite(studentId)) return false;
  if (canReadAllStudents(user)) return true;

  if (!user.roles.includes(RoleName.ADVISER)) {
    return false;
  }

  const count = await prisma.student.count({
    where: {
      id: studentId,
      OR: [{ adviserId: user.id }, { adviserAssignments: { some: { adviserUserId: user.id } } }],
    },
  });
  return count > 0;
};

export const canReadTasks = (user: AuthUser, scope: TaskScope): boolean => {
  if (scope === "team") {
    return canReadAllStudents(user);
  }
  return user.roles.length > 0;
};

export const canDecideTask = async (user: AuthUser, taskId: number): Promise<boolean> => {
  if (!Number.isFinite(taskId)) return false;
  if (user.roles.includes(RoleName.STUDENT)) return false;
  if (canReadAllStudents(user)) return true;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      studentId: true,
      assignedToId: true,
      assignedRole: true,
      nextActionOwnerRole: true,
    },
  });

  if (!task) return false;
  if (task.assignedToId === user.id) return true;

  const hasDecisionRole =
    user.roles.includes(RoleName.ADVISER) || user.roles.includes(RoleName.PANEL_MEMBER);
  if (!hasDecisionRole) return false;

  const matchesTaskRole =
    (!!task.assignedRole && user.roles.includes(task.assignedRole)) ||
    (!!task.nextActionOwnerRole && user.roles.includes(task.nextActionOwnerRole));

  if (!matchesTaskRole) return false;
  if (!task.studentId) return false;

  return canReadStudent(user, task.studentId);
};

export const canUploadDocument = async (
  user: AuthUser,
  studentId: number,
  docType: string
): Promise<boolean> => {
  if (!Number.isFinite(studentId)) return false;

  if (canReadAllStudents(user)) return true;

  const canRead = await canReadStudent(user, studentId);
  if (!canRead) return false;

  if (user.roles.includes(RoleName.STUDENT)) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { currentStage: true, userAccountId: true },
    });
    if (!student || student.userAccountId !== user.id) return false;

    const [matchingMilestone, matchingChecklist] = await Promise.all([
      prisma.milestoneDefinition.count({
        where: {
          stage: student.currentStage,
          active: true,
          name: docType,
        },
      }),
      prisma.documentRecord.count({
        where: {
          studentId,
          checklistItem: docType,
        },
      }),
    ]);

    return matchingMilestone > 0 || matchingChecklist > 0;
  }

  return user.roles.includes(RoleName.ADVISER) || user.roles.includes(RoleName.PANEL_MEMBER);
};

export const canDownloadDocument = async (user: AuthUser, documentVersionId: number): Promise<boolean> => {
  if (!Number.isFinite(documentVersionId)) return false;

  const version = await prisma.documentVersion.findUnique({
    where: { id: documentVersionId },
    select: { documentRecord: { select: { studentId: true } } },
  });
  if (!version) return false;

  if (canReadAllStudents(user)) return true;
  return canReadStudent(user, version.documentRecord.studentId);
};

export const canAccessAnalyticsDescriptive = (user: AuthUser): boolean => hasAnyRole(user, ANALYTICS_ROLES);

export const canAccessAnalyticsPrescriptive = (user: AuthUser): boolean => hasAnyRole(user, ANALYTICS_ROLES);

export const canAccessAudit = (user: AuthUser): boolean => hasAnyRole(user, AUDIT_ROLES);

export const logAccessDenied = async (
  req: Request,
  description: string,
  metadata?: Prisma.InputJsonValue
): Promise<void> => {
  await logAudit({
    actorUserId: req.user?.id ?? null,
    actionType: AuditActionType.ACCESS_DENIED,
    entityType: "Authorization",
    entityId: req.originalUrl,
    description,
    metadata,
    req,
  });
};

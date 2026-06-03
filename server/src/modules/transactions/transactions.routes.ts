import {
  AuditActionType,
  DocumentStatus,
  LifecycleStage,
  Prisma,
  RoleName,
  ScheduleStatus,
  TaskDecision,
  TaskStatus,
} from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { canReadStudent, logAccessDenied } from "../../auth/policy";
import { logAudit, logTimelineEvent } from "../../lib/audit";
import { prisma } from "../../lib/prisma";
import { authorize } from "../../middleware/authorize";
import { asyncHandler } from "../../utils/async-handler";
import { HttpError } from "../../utils/http-error";
import { buildRecommendation, computePriorityScore } from "../../utils/decision-support";
import { buildStudentScopeWhere } from "../../utils/scope";

const transactionComponents = [
  {
    key: "lifecycle",
    title: "Lifecycle Intake and Standing",
    transactions: [
      {
        key: "STUDENT_HANDOFF",
        priority: "P0",
        transaction:
          "Receive student data handoff from institutional records and create Graduate School monitoring record",
        actors: ["GRADUATE_SCHOOL_STAFF"],
        dataCaptured:
          "Student profile, admission or enrollment signal, program assignment, term, source reference, received timestamp, and initial monitoring status",
      },
      {
        key: "ONBOARDING_CHECK",
        priority: "P1",
        transaction: "Compare onboarding records with required onboarding items and set onboarding status",
        actors: ["GRADUATE_SCHOOL_STAFF", "ACADEMIC_COORDINATOR"],
        dataCaptured:
          "Student lifecycle record, onboarding checklist, missing onboarding items, starting status, and onboarding completion status",
      },
      {
        key: "TERM_STANDING",
        priority: "P1",
        transaction: "Confirm enrollment standing for the term from institutional enrollment signal",
        actors: ["GRADUATE_SCHOOL_STAFF"],
        dataCaptured:
          "Enrolled or not enrolled status, term, timestamp, source reference, and updated lifecycle standing",
      },
      {
        key: "LOA_REQUEST",
        priority: "P0",
        transaction: "Compare LOA request with residency rules, route Dean decision, and update residency pause",
        actors: ["STUDENT", "GRADUATE_SCHOOL_STAFF", "ADMIN"],
        dataCaptured:
          "LOA request, effective term, eligibility result, approval or denial, residency pause, updated lifecycle status, and follow-up status",
      },
      {
        key: "READMISSION_REQUEST",
        priority: "P1",
        transaction: "Send readmission request for decision and update return-term status",
        actors: ["STUDENT", "GRADUATE_SCHOOL_STAFF", "ADMIN"],
        dataCaptured:
          "Readmission request, return term, requirement reference, approval or denial, and updated lifecycle status",
      },
      {
        key: "WITHDRAWAL_REQUEST",
        priority: "P1",
        transaction: "Send withdrawal request for decision and update lifecycle status",
        actors: ["STUDENT", "GRADUATE_SCHOOL_STAFF", "ADMIN"],
        dataCaptured:
          "Withdrawal request, effective term, approval or denial, updated case status, closure reference, and attrition monitoring signal",
      },
    ],
  },
  {
    key: "coursework",
    title: "Curriculum, Coursework, and Offerings",
    transactions: [
      {
        key: "CURRICULUM_MATCH",
        priority: "P1",
        transaction: "Match student program and entry term to the correct curriculum version",
        actors: ["ACADEMIC_COORDINATOR"],
        dataCaptured:
          "Program, entry term, curriculum tag, required subjects, remaining subjects, and curriculum matching result",
      },
      {
        key: "CLASS_CHANGE_AUDIT",
        priority: "P1",
        transaction: "Compare enrolled subjects or class changes with the study plan and flag affected items",
        actors: ["GRADUATE_SCHOOL_STAFF", "ACADEMIC_COORDINATOR"],
        dataCaptured:
          "Subject list, added or dropped subjects, class changes, affected study plan items, and subject status update",
      },
      {
        key: "COURSE_AUDIT",
        priority: "P1",
        transaction: "Map completed, current, and missing subjects to curriculum requirements",
        actors: ["ACADEMIC_COORDINATOR", "GRADUATE_SCHOOL_STAFF"],
        dataCaptured:
          "Taken, currently taking, and not taken subjects; AY and semester taken; missing subjects; completion evidence; and course audit result",
      },
      {
        key: "OFFERING_DECISION",
        priority: "P1",
        transaction: "Record course offering decision and final offering list",
        actors: ["ADMIN", "ACADEMIC_COORDINATOR"],
        dataCaptured:
          "Proposed offerings, approved offerings, final course list, approval status, and timestamp",
      },
    ],
  },
  {
    key: "research",
    title: "Research Gate and Document Readiness",
    transactions: [
      {
        key: "FORM1_READINESS",
        priority: "P1",
        transaction: "Compare Form 1 submission with title defense requirements and set readiness status",
        actors: ["STUDENT", "ACADEMIC_COORDINATOR", "RESEARCH_COORDINATOR"],
        dataCaptured:
          "Form 1, proposed title, concept paper or required attachments, submission date, document completeness result, and readiness status",
      },
      {
        key: "TITLE_DEFENSE_RESULT",
        priority: "P1",
        transaction: "Record title defense result and set required next step",
        actors: ["PANEL_MEMBER", "RESEARCH_COORDINATOR"],
        dataCaptured:
          "Form 2, approved or disapproved title, selected title, outcome date, required revisions or next action, next-action owner, and status transition",
      },
      {
        key: "ADVISER_DESIGNATION",
        priority: "P1",
        transaction: "Send adviser designation request for approval and record appointed adviser",
        actors: ["STUDENT", "RESEARCH_COORDINATOR", "ADMIN"],
        dataCaptured:
          "Form 3, nominated adviser, adviser acceptance reference, Dean approval, Form 3.1, and adviser assignment status",
      },
      {
        key: "ADVISING_CHANGE",
        priority: "P1",
        transaction: "Record advising setup or change documents and update research case details",
        actors: ["STUDENT", "ADVISER", "GRADUATE_SCHOOL_STAFF", "RESEARCH_COORDINATOR"],
        dataCaptured:
          "Research timetable, advising contract, title change request, adviser change request, approval status, and updated research case details",
      },
      {
        key: "FORM4_READINESS",
        priority: "P1",
        transaction: "Compare Form 4 submission with defense readiness requirements and set scheduling eligibility",
        actors: ["ADVISER", "STUDENT", "RESEARCH_COORDINATOR"],
        dataCaptured:
          "Form 4, required manuscript or documents, readiness endorsement, document completeness result, scheduling eligibility, and requirement checklist result",
      },
      {
        key: "DEFENSE_RESULT",
        priority: "P1",
        transaction: "Record proposal or final defense result and assign revision requirements",
        actors: ["PANEL_MEMBER", "ADVISER", "RESEARCH_COORDINATOR"],
        dataCaptured:
          "Comments sheet, evaluation result, defense result, revision requirements, responsible owner, revision due status, and next action",
      },
      {
        key: "COMPLETION_CLEARANCE",
        priority: "P1",
        transaction: "Compare revision or completion documents with clearance requirements and mark completion status",
        actors: ["STUDENT", "ADVISER", "GRADUATE_SCHOOL_STAFF", "RESEARCH_COORDINATOR"],
        dataCaptured:
          "Revised manuscript version, technical review, ethics clearance, editor certification, approval sheet, clearance status, completion evidence, and updated research milestone status",
      },
    ],
  },
  {
    key: "scheduling",
    title: "Panel Matching and Defense Scheduling",
    transactions: [
      {
        key: "PANEL_MATCH",
        priority: "P0",
        transaction: "Match panel candidates using specialization, availability, and eligibility rules",
        actors: ["RESEARCH_COORDINATOR", "ACADEMIC_COORDINATOR"],
        dataCaptured:
          "Faculty specialization, availability reference, workload or assignment reference, nominated panel members, panel chair, assigned evaluators, conflict or eligibility notes, and recommended panel composition",
      },
      {
        key: "DEFENSE_SCHEDULE",
        priority: "P0",
        transaction: "Match available dates across panel, adviser, and student, then confirm defense schedule",
        actors: ["RESEARCH_COORDINATOR", "PANEL_MEMBER", "ADVISER", "STUDENT"],
        dataCaptured:
          "Preferred dates, availability responses, schedule request timestamp, scheduling constraints, final schedule, mode, venue or meeting link, reschedule reason, and confirmation status",
      },
    ],
  },
  {
    key: "completion",
    title: "Completion, Practicum, and Graduation Endorsement",
    transactions: [
      {
        key: "PRACTICUM_CHECK",
        priority: "P1",
        transaction: "Compare practicum evidence with practicum requirements and mark completion status, if applicable",
        actors: ["STUDENT", "ACADEMIC_COORDINATOR"],
        dataCaptured:
          "MOA, practicum hours, certificates, uploaded evidence, pending requirements, and completion status",
      },
      {
        key: "GRADUATION_ENDORSEMENT",
        priority: "P1",
        transaction:
          "Compare coursework, research, practicum, and clearance records with graduation requirements and compile candidate endorsement list",
        actors: ["GRADUATE_SCHOOL_STAFF", "ACADEMIC_COORDINATOR", "RESEARCH_COORDINATOR", "ADMIN"],
        dataCaptured:
          "Coursework completion, research completion, practicum status, missing requirements list, eligibility result, candidate endorsement list, Dean approval status, and Registrar acknowledgment reference",
      },
    ],
  },
  {
    key: "followUp",
    title: "Follow-Up, Alerts, and Decision Support",
    transactions: [
      {
        key: "FOLLOW_UP_INTERVENTION",
        priority: "P1",
        transaction: "Record follow-up action or intervention and update next-action reference",
        actors: ["GRADUATE_SCHOOL_STAFF", "ACADEMIC_COORDINATOR", "RESEARCH_COORDINATOR"],
        dataCaptured:
          "Follow-up note, contacted party, date and time, case status update, closure proof, and next-action owner",
      },
    ],
  },
] as const;

const transactionKeys = transactionComponents.flatMap((component) =>
  component.transactions.map((transaction) => transaction.key)
) as [string, ...string[]];

type TransactionDefinitionEntry = {
  component: string;
  key: string;
  priority: string;
  transaction: string;
  actors: readonly string[];
  dataCaptured: string;
};

type CreatedEntityRef = { type: string; id: number | string };

const transactionByKey: Map<string, TransactionDefinitionEntry> = new Map(
  transactionComponents.flatMap((component) =>
    component.transactions.map((transaction) => [transaction.key, { component: component.key, ...transaction }])
  )
);

const recordSchema = z.object({
  transactionKey: z.enum(transactionKeys),
  studentId: z.number().int().positive().optional().nullable(),
  actorRole: z.nativeEnum(RoleName).optional().nullable(),
  sourceReference: z.string().trim().max(180).optional().nullable(),
  termId: z.number().int().positive().optional().nullable(),
  milestoneDefinitionId: z.number().int().positive().optional().nullable(),
  scheduleRequestId: z.number().int().positive().optional().nullable(),
  adviserUserId: z.number().int().positive().optional().nullable(),
  panelUserIds: z.array(z.number().int().positive()).optional().default([]),
  studentProfile: z
    .object({
      studentNumber: z.string().trim().min(2),
      firstName: z.string().trim().min(1),
      lastName: z.string().trim().min(1),
      email: z.string().trim().email().optional().nullable(),
      programCode: z.string().trim().min(1),
    })
    .optional()
    .nullable(),
  statusResult: z.string().trim().max(120).optional().nullable(),
  missingItems: z.array(z.string().trim().min(1)).optional().default([]),
  decisionOutcome: z.nativeEnum(TaskDecision).optional().nullable(),
  nextOwnerRole: z.nativeEnum(RoleName).optional().nullable(),
  evidenceNote: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  effectiveFrom: z.coerce.date().optional().nullable(),
  effectiveTo: z.coerce.date().optional().nullable(),
});

type RecordPayload = z.infer<typeof recordSchema>;

const stageThresholdDefaults: Record<LifecycleStage, number> = {
  ADMISSION: 14,
  COURSEWORK: 45,
  PROPOSAL_DEVELOPMENT: 50,
  PROPOSAL_DEFENSE: 20,
  DATA_COLLECTION: 75,
  DISSERTATION_WRITING: 45,
  ORAL_DEFENSE: 20,
  LOA: 30,
  COMPLETED: 999,
};

const openTaskStatuses = [TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.OVERDUE];

const summaryStudentSelect = {
  id: true,
  studentNumber: true,
  firstName: true,
  lastName: true,
  currentStage: true,
  riskFlag: true,
  program: { select: { code: true, name: true } },
} satisfies Prisma.StudentSelect;

const asStudentLabel = (student: { studentNumber: string; firstName: string; lastName: string }): string =>
  `${student.studentNumber} - ${student.firstName} ${student.lastName}`;

const compactList = (items: string[]): string => items.map((item) => item.trim()).filter(Boolean).join("; ");

const getDefaultTermId = async (tx: Prisma.TransactionClient): Promise<number | null> => {
  const term = await tx.academicTerm.findFirst({
    orderBy: [{ startDate: "desc" }, { id: "desc" }],
    select: { id: true },
  });
  return term?.id ?? null;
};

const getDefaultMilestoneId = async (
  tx: Prisma.TransactionClient,
  studentId: number,
  requestedMilestoneId?: number | null
): Promise<number | null> => {
  if (requestedMilestoneId) return requestedMilestoneId;
  const student = await tx.student.findUnique({
    where: { id: studentId },
    select: { currentStage: true },
  });
  const milestone = await tx.milestoneDefinition.findFirst({
    where: { active: true, stage: student?.currentStage },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true },
  });
  return milestone?.id ?? null;
};

const createTask = async (
  tx: Prisma.TransactionClient,
  input: {
    title: string;
    studentId?: number | null;
    milestoneDefinitionId?: number | null;
    assignedRole?: RoleName | null;
    nextOwnerRole?: RoleName | null;
    status?: TaskStatus;
    dueAt?: Date | null;
    createdById: number;
    description?: string | null;
  }
): Promise<number> => {
  const created = await tx.task.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      studentId: input.studentId ?? null,
      milestoneDefinitionId: input.milestoneDefinitionId ?? null,
      assignedRole: input.assignedRole ?? input.nextOwnerRole ?? null,
      nextActionOwnerRole: input.nextOwnerRole ?? input.assignedRole ?? null,
      status: input.status ?? TaskStatus.PENDING,
      dueAt: input.dueAt ?? null,
      createdById: input.createdById,
      priorityScore: computePriorityScore({
        dueAt: input.dueAt,
        taskStatus: input.status ?? TaskStatus.PENDING,
      }),
    },
  });

  const rec = buildRecommendation({
    dueAt: input.dueAt,
    nextActionOwnerRole: input.nextOwnerRole ?? input.assignedRole,
  });

  await tx.task.update({
    where: { id: created.id },
    data: {
      recommendedAction: rec.recommendedAction,
      escalationPrompt: rec.escalationPrompt,
    },
  });

  return created.id;
};

const recordDecisionIfPresent = async (
  tx: Prisma.TransactionClient,
  input: {
    taskId: number;
    studentId?: number | null;
    decision?: TaskDecision | null;
    rationale?: string | null;
    actorUserId: number;
  }
): Promise<void> => {
  if (!input.decision) return;

  await tx.decisionLog.create({
    data: {
      taskId: input.taskId,
      studentId: input.studentId ?? null,
      decision: input.decision,
      rationale: input.rationale ?? null,
      decidedById: input.actorUserId,
    },
  });

  await tx.task.update({
    where: { id: input.taskId },
    data: {
      status: input.decision === TaskDecision.APPROVE ? TaskStatus.COMPLETED : TaskStatus.PENDING,
      closedAt: input.decision === TaskDecision.APPROVE ? new Date() : null,
    },
  });
};

const createMilestoneEventIfPossible = async (
  tx: Prisma.TransactionClient,
  input: {
    studentId: number;
    milestoneDefinitionId?: number | null;
    transactionKey: string;
    outcome?: string | null;
    ownerRole?: RoleName | null;
    decidedById?: number | null;
    taskId?: number | null;
    notes?: string | null;
  }
): Promise<number | null> => {
  const milestoneDefinitionId = await getDefaultMilestoneId(tx, input.studentId, input.milestoneDefinitionId);
  if (!milestoneDefinitionId) return null;

  const researchCase = await tx.researchCase.findFirst({
    where: { studentId: input.studentId },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  const created = await tx.milestoneEvent.create({
    data: {
      studentId: input.studentId,
      researchCaseId: researchCase?.id ?? null,
      milestoneDefinitionId,
      outcome: input.outcome ?? "recorded",
      ownerRole: input.ownerRole ?? null,
      decidedById: input.decidedById ?? null,
      taskId: input.taskId ?? null,
      notes: `${input.transactionKey}: ${input.notes ?? "Transaction recorded."}`,
    },
  });

  return created.id;
};

const assertStudentAccess = async (user: Express.Request["user"], studentId?: number | null): Promise<void> => {
  if (!studentId || !user) return;
  const allowed = await canReadStudent(user, studentId);
  if (!allowed) {
    throw new HttpError(403, "You are not authorized to record a transaction for this student.");
  }
};

const buildCourseAudit = async (studentIds?: number[]) => {
  const students = await prisma.student.findMany({
    where: {
      ...(studentIds ? { id: { in: studentIds } } : {}),
    },
    select: {
      ...summaryStudentSelect,
      curriculumTags: {
        include: {
          curriculum: {
            include: {
              studyPlanItems: {
                include: {
                  course: true,
                },
                orderBy: { id: "asc" },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      termEnrollments: {
        include: {
          term: true,
          courseEnrollments: { include: { course: true } },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return students.map((student) => {
    const curriculum = student.curriculumTags[0]?.curriculum ?? null;
    const completedCourseIds = new Set<number>();
    const currentCourseIds = new Set<number>();
    const incompleteCourseIds = new Set<number>();

    student.termEnrollments.forEach((termEnrollment) => {
      termEnrollment.courseEnrollments.forEach((courseEnrollment) => {
        const status = String(courseEnrollment.statusSignal ?? "").toLowerCase();
        if (status === "completed") completedCourseIds.add(courseEnrollment.courseId);
        if (["enrolled", "in-progress", "ongoing"].includes(status)) currentCourseIds.add(courseEnrollment.courseId);
        if (["incomplete", "dropped", "failed"].includes(status)) incompleteCourseIds.add(courseEnrollment.courseId);
      });
    });

    const requiredItems = curriculum?.studyPlanItems.filter((item) => item.isRequired) ?? [];
    const missing = requiredItems.filter(
      (item) => !completedCourseIds.has(item.courseId) && !currentCourseIds.has(item.courseId)
    );
    const current = requiredItems.filter((item) => currentCourseIds.has(item.courseId));
    const completed = requiredItems.filter((item) => completedCourseIds.has(item.courseId));
    const affected = requiredItems.filter((item) => incompleteCourseIds.has(item.courseId));

    return {
      student: {
        id: student.id,
        label: asStudentLabel(student),
        program: student.program,
        currentStage: student.currentStage,
      },
      curriculum: curriculum
        ? {
            id: curriculum.id,
            code: curriculum.code,
            version: curriculum.version,
            effectiveAcademicYear: curriculum.effectiveAcademicYear,
          }
        : null,
      requiredCount: requiredItems.length,
      completedCount: completed.length,
      currentCount: current.length,
      missingCount: missing.length,
      affectedCount: affected.length,
      missingSubjects: missing.slice(0, 8).map((item) => ({
        id: item.course.id,
        code: item.course.code,
        title: item.course.title,
      })),
      currentSubjects: current.slice(0, 8).map((item) => ({
        id: item.course.id,
        code: item.course.code,
        title: item.course.title,
      })),
      affectedSubjects: affected.slice(0, 8).map((item) => ({
        id: item.course.id,
        code: item.course.code,
        title: item.course.title,
      })),
      result:
        requiredItems.length === 0
          ? "NO_CURRICULUM_TAG"
          : missing.length === 0 && current.length === 0
            ? "COURSEWORK_COMPLETE"
            : "COURSEWORK_IN_PROGRESS",
    };
  });
};

const buildOfferingDemand = async () => {
  const audits = await buildCourseAudit();
  const demand = new Map<string, { courseCode: string; courseTitle: string; count: number; students: string[] }>();

  audits.forEach((audit) => {
    audit.missingSubjects.forEach((course) => {
      const key = course.code;
      const existing = demand.get(key) ?? {
        courseCode: course.code,
        courseTitle: course.title,
        count: 0,
        students: [],
      };
      existing.count += 1;
      existing.students.push(audit.student.label);
      demand.set(key, existing);
    });
  });

  return [...demand.values()].sort((a, b) => b.count - a.count || a.courseCode.localeCompare(b.courseCode));
};

export const transactionsRouter = Router();

transactionsRouter.get(
  "/definitions",
  asyncHandler(async (_req, res) => {
    res.json({ components: transactionComponents });
  })
);

transactionsRouter.get(
  "/lifecycle",
  asyncHandler(async (req, res) => {
    const scope = buildStudentScopeWhere(req.user!);
    const [stageCounts, handoffCandidates, loaCases, standingRecords, lifecycleTasks] = await Promise.all([
      prisma.student.groupBy({
        by: ["currentStage"],
        where: scope,
        _count: { _all: true },
      }),
      prisma.student.findMany({
        where: { AND: [scope, { currentStage: LifecycleStage.ADMISSION }] },
        select: summaryStudentSelect,
        orderBy: { createdAt: "desc" },
        take: 12,
      }),
      prisma.student.findMany({
        where: { AND: [scope, { OR: [{ currentStage: LifecycleStage.LOA }, { loaStart: { not: null } }] }] },
        select: { ...summaryStudentSelect, loaStart: true, loaEnd: true },
        orderBy: { updatedAt: "desc" },
        take: 12,
      }),
      prisma.termEnrollment.findMany({
        where: { student: scope },
        include: { term: true, student: { select: summaryStudentSelect } },
        orderBy: { updatedAt: "desc" },
        take: 12,
      }),
      prisma.task.findMany({
        where: {
          student: scope,
          status: { in: openTaskStatuses },
          OR: [
            { title: { contains: "handoff" } },
            { title: { contains: "onboarding" } },
            { title: { contains: "LOA" } },
            { title: { contains: "readmission" } },
            { title: { contains: "withdrawal" } },
          ],
        },
        include: { student: { select: summaryStudentSelect }, assignedTo: { select: { fullName: true } } },
        orderBy: [{ dueAt: "asc" }, { priorityScore: "desc" }],
        take: 20,
      }),
    ]);

    res.json({
      summary: {
        totalInScope: stageCounts.reduce((sum, row) => sum + row._count._all, 0),
        admissionRecords: stageCounts.find((row) => row.currentStage === LifecycleStage.ADMISSION)?._count._all ?? 0,
        loaActive: loaCases.length,
        openLifecycleTasks: lifecycleTasks.length,
      },
      stageCounts: stageCounts.map((row) => ({ stage: row.currentStage, count: row._count._all })),
      handoffCandidates,
      loaCases,
      standingRecords,
      lifecycleTasks,
    });
  })
);

transactionsRouter.get(
  "/coursework",
  asyncHandler(async (req, res) => {
    const scope = buildStudentScopeWhere(req.user!);
    const scopedStudents = await prisma.student.findMany({
      where: scope,
      select: { id: true },
      take: 250,
    });
    const studentIds = scopedStudents.map((student) => student.id);
    const audits = await buildCourseAudit(studentIds);
    const offeringDemand = await buildOfferingDemand();

    res.json({
      summary: {
        auditedStudents: audits.length,
        completeCoursework: audits.filter((audit) => audit.result === "COURSEWORK_COMPLETE").length,
        missingSubjectCases: audits.filter((audit) => audit.missingCount > 0).length,
        highDemandSubjects: offeringDemand.filter((row) => row.count >= 5).length,
      },
      courseAudits: audits.slice(0, 60),
      offeringDemand: offeringDemand.slice(0, 25),
    });
  })
);

transactionsRouter.get(
  "/research",
  asyncHandler(async (req, res) => {
    const scope = buildStudentScopeWhere(req.user!);
    const cases = await prisma.student.findMany({
      where: {
        AND: [
          scope,
          {
            OR: [
              { researchCases: { some: {} } },
              { currentStage: { in: [LifecycleStage.PROPOSAL_DEVELOPMENT, LifecycleStage.PROPOSAL_DEFENSE, LifecycleStage.DATA_COLLECTION, LifecycleStage.DISSERTATION_WRITING, LifecycleStage.ORAL_DEFENSE] } },
            ],
          },
        ],
      },
      select: {
        ...summaryStudentSelect,
        adviser: { select: { id: true, fullName: true } },
        researchCoordinator: { select: { id: true, fullName: true } },
        researchCases: {
          include: {
            currentMilestone: true,
            milestoneEvents: { orderBy: { occurredAt: "desc" }, take: 3 },
          },
          take: 1,
          orderBy: { updatedAt: "desc" },
        },
        documents: true,
        tasks: {
          where: { status: { in: openTaskStatuses } },
          orderBy: [{ dueAt: "asc" }],
          take: 5,
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 80,
    });

    const gateCases = cases.map((student) => {
      const requiredEvidence = student.documents.length;
      const approvedEvidence = student.documents.filter((document) => document.status === DocumentStatus.APPROVED).length;
      const openRevisionCount = student.documents.reduce((sum, document) => sum + document.outstandingRevisionCount, 0);
      const latestCase = student.researchCases[0] ?? null;
      return {
        student,
        researchCase: latestCase,
        requiredEvidence,
        approvedEvidence,
        openRevisionCount,
        openTaskCount: student.tasks.length,
        readiness:
          requiredEvidence > 0 && approvedEvidence === requiredEvidence && openRevisionCount === 0
            ? "READY"
            : openRevisionCount > 0
              ? "NEEDS_REVISION"
              : "MISSING_EVIDENCE",
      };
    });

    res.json({
      summary: {
        researchCases: gateCases.length,
        readyCases: gateCases.filter((item) => item.readiness === "READY").length,
        revisionCases: gateCases.filter((item) => item.readiness === "NEEDS_REVISION").length,
        missingEvidenceCases: gateCases.filter((item) => item.readiness === "MISSING_EVIDENCE").length,
      },
      gateCases,
    });
  })
);

transactionsRouter.get(
  "/scheduling",
  asyncHandler(async (req, res) => {
    const scope = buildStudentScopeWhere(req.user!);
    const requests = await prisma.scheduleRequest.findMany({
      where: { student: scope },
      include: {
        student: { select: summaryStudentSelect },
        requestedBy: { select: { id: true, fullName: true } },
        availabilities: { include: { user: { select: { id: true, fullName: true } } }, orderBy: { availableFrom: "asc" } },
        scheduleEvents: { include: { decidedBy: { select: { id: true, fullName: true } } }, orderBy: { createdAt: "desc" } },
      },
      orderBy: { createdAt: "desc" },
      take: 80,
    });

    const cases = requests.map((request) => {
      const availabilityDates = new Map<string, number>();
      request.availabilities.forEach((slot) => {
        const key = slot.availableFrom.toISOString().slice(0, 10);
        availabilityDates.set(key, (availabilityDates.get(key) ?? 0) + 1);
      });
      const bestMatch = [...availabilityDates.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
      const ageDays = Math.max(0, Math.floor((Date.now() - request.createdAt.getTime()) / (1000 * 60 * 60 * 24)));
      const rescheduleCount = request.scheduleEvents.filter((event) => event.eventStatus === ScheduleStatus.RESCHEDULED).length;
      return {
        ...request,
        ageDays,
        rescheduleCount,
        participantAvailabilityCount: request.availabilities.length,
        bestAvailabilityDate: bestMatch?.[0] ?? null,
        bestAvailabilityCount: bestMatch?.[1] ?? 0,
        schedulingSignal:
          request.status === ScheduleStatus.CONFIRMED
            ? "CONFIRMED"
            : ageDays >= 10
              ? "DELAYED"
              : bestMatch && bestMatch[1] >= 2
                ? "MATCH_FOUND"
                : "COLLECT_AVAILABILITY",
      };
    });

    res.json({
      summary: {
        requests: cases.length,
        confirmed: cases.filter((item) => item.status === ScheduleStatus.CONFIRMED).length,
        delayed: cases.filter((item) => item.schedulingSignal === "DELAYED").length,
        matchFound: cases.filter((item) => item.schedulingSignal === "MATCH_FOUND").length,
      },
      scheduleCases: cases,
    });
  })
);

transactionsRouter.get(
  "/completion",
  asyncHandler(async (req, res) => {
    const scope = buildStudentScopeWhere(req.user!);
    const scopedStudents = await prisma.student.findMany({ where: scope, select: { id: true }, take: 250 });
    const audits = await buildCourseAudit(scopedStudents.map((student) => student.id));
    const students = await prisma.student.findMany({
      where: scope,
      select: {
        ...summaryStudentSelect,
        milestoneStatuses: true,
        documents: true,
        alerts: { where: { status: { in: ["OPEN", "ACKNOWLEDGED"] } } },
      },
      take: 120,
    });
    const auditMap = new Map(audits.map((audit) => [audit.student.id, audit]));
    const candidates = students.map((student) => {
      const audit = auditMap.get(student.id);
      const pendingMilestones = student.milestoneStatuses.filter((milestone) => milestone.status !== "COMPLETED").length;
      const missingDocuments = student.documents.filter((document) => document.status !== DocumentStatus.APPROVED).length;
      const eligible =
        student.currentStage === LifecycleStage.COMPLETED ||
        ((audit?.missingCount ?? 1) === 0 && pendingMilestones <= 2 && missingDocuments <= 1 && student.alerts.length === 0);
      return {
        student,
        courseworkMissing: audit?.missingCount ?? null,
        pendingMilestones,
        missingDocuments,
        openAlerts: student.alerts.length,
        eligibilityResult: eligible ? "ELIGIBLE_FOR_GS_ENDORSEMENT" : "PENDING_REQUIREMENTS",
        missingRequirements: [
          ...((audit?.missingSubjects ?? []).slice(0, 4).map((course) => course.code)),
          ...(pendingMilestones > 0 ? [`${pendingMilestones} milestone(s)`] : []),
          ...(missingDocuments > 0 ? [`${missingDocuments} document(s)`] : []),
          ...(student.alerts.length > 0 ? [`${student.alerts.length} open alert(s)`] : []),
        ],
      };
    });

    res.json({
      summary: {
        candidates: candidates.length,
        eligible: candidates.filter((item) => item.eligibilityResult === "ELIGIBLE_FOR_GS_ENDORSEMENT").length,
        pendingRequirements: candidates.filter((item) => item.eligibilityResult === "PENDING_REQUIREMENTS").length,
      },
      graduationCandidates: candidates
        .sort((a, b) => (a.eligibilityResult === b.eligibilityResult ? 0 : a.eligibilityResult === "ELIGIBLE_FOR_GS_ENDORSEMENT" ? -1 : 1))
        .slice(0, 80),
    });
  })
);

transactionsRouter.get(
  "/follow-up",
  asyncHandler(async (req, res) => {
    const scope = buildStudentScopeWhere(req.user!);
    const [alerts, overdueTasks] = await Promise.all([
      prisma.alert.findMany({
        where: { student: scope, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
        include: {
          student: { select: summaryStudentSelect },
          task: true,
          interventions: { include: { performedBy: { select: { id: true, fullName: true } } }, orderBy: { performedAt: "desc" } },
        },
        orderBy: [{ severity: "desc" }, { triggeredAt: "asc" }],
        take: 80,
      }),
      prisma.task.findMany({
        where: { student: scope, status: TaskStatus.OVERDUE },
        include: { student: { select: summaryStudentSelect }, assignedTo: { select: { id: true, fullName: true } } },
        orderBy: [{ dueAt: "asc" }, { priorityScore: "desc" }],
        take: 50,
      }),
    ]);

    res.json({
      summary: {
        openAlerts: alerts.length,
        overdueTasks: overdueTasks.length,
        alertsWithoutIntervention: alerts.filter((alert) => alert.interventions.length === 0).length,
      },
      interventionQueue: alerts.map((alert) => ({
        ...alert,
        ageDays: Math.max(0, Math.floor((Date.now() - alert.triggeredAt.getTime()) / (1000 * 60 * 60 * 24))),
        latestIntervention: alert.interventions[0] ?? null,
      })),
      overdueTasks,
    });
  })
);

transactionsRouter.post(
  "/record",
  authorize(
    RoleName.ADMIN,
    RoleName.GRADUATE_SCHOOL_STAFF,
    RoleName.ACADEMIC_COORDINATOR,
    RoleName.RESEARCH_COORDINATOR,
    RoleName.ADVISER,
    RoleName.PANEL_MEMBER,
    RoleName.STUDENT
  ),
  asyncHandler(async (req, res) => {
    const parsed = recordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, "Invalid transaction record payload.");
    }

    const payload = parsed.data;
    const definition = transactionByKey.get(payload.transactionKey);
    if (!definition) {
      throw new HttpError(400, "Unknown transaction key.");
    }

    await assertStudentAccess(req.user, payload.studentId);

    const actorRole = payload.actorRole ?? req.user!.roles[0] ?? RoleName.GRADUATE_SCHOOL_STAFF;
    const nextOwnerRole = payload.nextOwnerRole ?? actorRole;
    const missingItemText = compactList(payload.missingItems);
    const transactionTitle = definition.transaction;
    const sourceReference = payload.sourceReference ?? "manual transaction entry";
    const notes = [
      `Source/reference: ${sourceReference}`,
      payload.statusResult ? `Status/result: ${payload.statusResult}` : null,
      missingItemText ? `Missing/items affected: ${missingItemText}` : null,
      payload.evidenceNote ? `Evidence: ${payload.evidenceNote}` : null,
      payload.notes ?? null,
    ]
      .filter(Boolean)
      .join("\n");

    let affectedStudentId = payload.studentId ?? null;
    let createdTaskId: number | null = null;
    let createdEntity: CreatedEntityRef | null = null;

    await prisma.$transaction(async (tx) => {
      if (payload.transactionKey === "STUDENT_HANDOFF") {
        if (!payload.studentProfile) {
          throw new HttpError(400, "Student handoff requires a student profile.");
        }
        const program = await tx.program.findFirst({
          where: {
            OR: [
              { code: payload.studentProfile.programCode },
              { name: { contains: payload.studentProfile.programCode } },
            ],
          },
        });
        if (!program) {
          throw new HttpError(400, "Program code was not found for handoff.");
        }

        const email =
          payload.studentProfile.email ??
          `${payload.studentProfile.studentNumber.toLowerCase().replace(/[^a-z0-9]/g, ".")}@student.gs.local`;

        const student = await tx.student.create({
          data: {
            studentNumber: payload.studentProfile.studentNumber,
            firstName: payload.studentProfile.firstName,
            lastName: payload.studentProfile.lastName,
            email,
            programId: program.id,
            currentStage: LifecycleStage.ADMISSION,
            riskFlag: payload.missingItems.length > 0,
          },
        });
        affectedStudentId = student.id;
        createdEntity = { type: "Student", id: student.id };

        await tx.studentLifecycle.create({
          data: {
            studentId: student.id,
            stage: LifecycleStage.ADMISSION,
            enteredAt: payload.effectiveFrom ?? new Date(),
            notes,
            changedById: req.user!.id,
          },
        });

        const checklistItems = payload.missingItems.length > 0 ? payload.missingItems : ["Admission handoff confirmation"];
        await tx.documentRecord.createMany({
          data: checklistItems.map((item) => ({
            studentId: student.id,
            checklistItem: item,
            status: payload.missingItems.length > 0 ? DocumentStatus.PENDING : DocumentStatus.APPROVED,
          })),
        });

        if (payload.missingItems.length > 0) {
          createdTaskId = await createTask(tx, {
            title: "Resolve onboarding missing items",
            studentId: student.id,
            assignedRole: RoleName.GRADUATE_SCHOOL_STAFF,
            nextOwnerRole: RoleName.GRADUATE_SCHOOL_STAFF,
            createdById: req.user!.id,
            dueAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            description: notes,
          });
        }
      } else {
        if (!payload.studentId) {
          throw new HttpError(400, "This transaction requires a student.");
        }

        const milestoneDefinitionId = await getDefaultMilestoneId(tx, payload.studentId, payload.milestoneDefinitionId);
        const dueAt = payload.effectiveTo ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        if (payload.transactionKey === "TERM_STANDING") {
          const termId = payload.termId ?? (await getDefaultTermId(tx));
          if (!termId) throw new HttpError(400, "No academic term exists for enrollment standing.");

          const enrollment = await tx.termEnrollment.create({
            data: {
              studentId: payload.studentId,
              termId,
              statusSignal: payload.statusResult ?? "confirmed",
              confirmedAt: payload.effectiveFrom ?? new Date(),
            },
          });
          createdEntity = { type: "TermEnrollment", id: enrollment.id };
          if ((payload.statusResult ?? "").toLowerCase().includes("enrolled")) {
            await tx.student.update({
              where: { id: payload.studentId },
              data: { currentStage: LifecycleStage.COURSEWORK },
            });
          }
        }

        if (payload.transactionKey === "LOA_REQUEST") {
          await tx.student.update({
            where: { id: payload.studentId },
            data: {
              currentStage: LifecycleStage.LOA,
              loaStart: payload.effectiveFrom ?? new Date(),
              loaEnd: payload.effectiveTo ?? null,
              riskFlag: true,
            },
          });
          await tx.studentLifecycle.create({
            data: {
              studentId: payload.studentId,
              stage: LifecycleStage.LOA,
              enteredAt: payload.effectiveFrom ?? new Date(),
              notes,
              changedById: req.user!.id,
            },
          });
        }

        if (payload.transactionKey === "READMISSION_REQUEST" && payload.decisionOutcome === TaskDecision.APPROVE) {
          await tx.student.update({
            where: { id: payload.studentId },
            data: {
              currentStage: LifecycleStage.COURSEWORK,
              loaEnd: payload.effectiveFrom ?? new Date(),
              riskFlag: false,
            },
          });
        }

        if (payload.transactionKey === "ADVISER_DESIGNATION" && payload.adviserUserId) {
          await tx.student.update({
            where: { id: payload.studentId },
            data: { adviserId: payload.adviserUserId },
          });
          await tx.adviserAssignment.upsert({
            where: {
              adviserUserId_studentId: {
                adviserUserId: payload.adviserUserId,
                studentId: payload.studentId,
              },
            },
            update: {},
            create: {
              adviserUserId: payload.adviserUserId,
              studentId: payload.studentId,
            },
          });
        }

        if (payload.transactionKey === "PANEL_MATCH" && payload.panelUserIds.length > 0) {
          await tx.panelAssignment.createMany({
            data: payload.panelUserIds.map((panelUserId) => ({
              studentId: payload.studentId!,
              panelUserId,
            })),
            skipDuplicates: true,
          });
        }

        if (payload.transactionKey === "DEFENSE_SCHEDULE") {
          const request =
            payload.scheduleRequestId
              ? await tx.scheduleRequest.findUnique({ where: { id: payload.scheduleRequestId } })
              : await tx.scheduleRequest.create({
                  data: {
                    studentId: payload.studentId,
                    requestedById: req.user!.id,
                    preferredDate: payload.effectiveFrom ?? null,
                    reason: notes,
                    status: ScheduleStatus.REQUESTED,
                  },
                });
          if (!request) throw new HttpError(404, "Schedule request not found.");
          createdEntity = { type: "ScheduleRequest", id: request.id };

          const normalizedStatus = String(payload.statusResult ?? "").toUpperCase();
          const finalStatus =
            normalizedStatus.includes("CONFIRM")
              ? ScheduleStatus.CONFIRMED
              : normalizedStatus.includes("CANCEL")
                ? ScheduleStatus.CANCELLED
                : normalizedStatus.includes("RESCHEDULE")
                  ? ScheduleStatus.RESCHEDULED
                  : null;
          if (finalStatus) {
            await tx.scheduleEvent.create({
              data: {
                scheduleRequestId: request.id,
                eventStatus: finalStatus,
                scheduledAt: payload.effectiveFrom ?? null,
                decidedById: req.user!.id,
                notes,
              },
            });
            await tx.scheduleRequest.update({
              where: { id: request.id },
              data: { status: finalStatus },
            });
          }
        }

        if (
          [
            "FORM1_READINESS",
            "FORM4_READINESS",
            "TITLE_DEFENSE_RESULT",
            "DEFENSE_RESULT",
            "COMPLETION_CLEARANCE",
          ].includes(payload.transactionKey)
        ) {
          const milestoneEventId = await createMilestoneEventIfPossible(tx, {
            studentId: payload.studentId,
            milestoneDefinitionId,
            transactionKey: payload.transactionKey,
            outcome: payload.statusResult ?? payload.decisionOutcome ?? "recorded",
            ownerRole: nextOwnerRole,
            decidedById: req.user!.id,
            notes,
          });
          if (milestoneEventId) {
            createdEntity = { type: "MilestoneEvent", id: milestoneEventId };
          }

          if (payload.transactionKey.includes("FORM")) {
            await tx.formSubmission.create({
              data: {
                studentId: payload.studentId,
                milestoneEventId,
                formType: payload.transactionKey === "FORM1_READINESS" ? "Form 1" : "Form 4",
                submittedAt: payload.effectiveFrom ?? new Date(),
                routingState: payload.statusResult ?? "recorded",
                submittedById: req.user!.id,
              },
            });
          }
        }

        if (payload.missingItems.length > 0 && ["FORM1_READINESS", "FORM4_READINESS", "COMPLETION_CLEARANCE", "PRACTICUM_CHECK", "GRADUATION_ENDORSEMENT", "ONBOARDING_CHECK"].includes(payload.transactionKey)) {
          await tx.documentRecord.createMany({
            data: payload.missingItems.map((item) => ({
              studentId: payload.studentId!,
              milestoneDefinitionId,
              checklistItem: item,
              status: DocumentStatus.PENDING,
            })),
          });
        }

        createdTaskId = await createTask(tx, {
          title: transactionTitle,
          studentId: payload.studentId,
          milestoneDefinitionId,
          assignedRole: nextOwnerRole,
          nextOwnerRole,
          createdById: req.user!.id,
          dueAt,
          description: notes,
          status: payload.decisionOutcome === TaskDecision.APPROVE ? TaskStatus.COMPLETED : TaskStatus.PENDING,
        });

        await recordDecisionIfPresent(tx, {
          taskId: createdTaskId,
          studentId: payload.studentId,
          decision: payload.decisionOutcome,
          rationale: notes,
          actorUserId: req.user!.id,
        });
      }
    });

    if (affectedStudentId) {
      const relatedEntity = createdEntity as CreatedEntityRef | null;
      await logTimelineEvent({
        studentId: affectedStudentId,
        eventType: `TRANSACTION_${payload.transactionKey}`,
        title: transactionTitle,
        details: notes,
        relatedEntityType: relatedEntity?.type ?? (createdTaskId ? "Task" : "Transaction"),
        relatedEntityId: typeof relatedEntity?.id === "number" ? relatedEntity.id : createdTaskId ?? undefined,
        performedById: req.user!.id,
      });
    }

    await logAudit({
      actorUserId: req.user!.id,
      actionType: AuditActionType.CREATE,
      entityType: "TransactionRecord",
      entityId: payload.transactionKey,
      description: `Transaction recorded: ${payload.transactionKey}`,
      metadata: payload as Prisma.InputJsonValue,
      req,
    });

    res.status(201).json({
      message: "Transaction recorded.",
      transactionKey: payload.transactionKey,
      studentId: affectedStudentId,
      taskId: createdTaskId,
      createdEntity,
    });
  })
);

transactionsRouter.use(
  asyncHandler(async (req, _res, next) => {
    await logAccessDenied(req, "Unknown transaction endpoint.");
    next();
  })
);

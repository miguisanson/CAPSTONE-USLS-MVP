import "dotenv/config";
import { PrismaClient, RoleName, LifecycleStage, MilestoneStatus, TaskStatus, TaskDecision, DocumentStatus, ScheduleStatus, AlertType, AlertSeverity, AlertStatus, InterventionStatus, AuditActionType } from "@prisma/client";
import bcrypt from "bcryptjs";
import dayjs from "dayjs";

const prisma = new PrismaClient();

const stageOrder: LifecycleStage[] = [
  LifecycleStage.ADMISSION,
  LifecycleStage.COURSEWORK,
  LifecycleStage.PROPOSAL_DEVELOPMENT,
  LifecycleStage.PROPOSAL_DEFENSE,
  LifecycleStage.DATA_COLLECTION,
  LifecycleStage.DISSERTATION_WRITING,
  LifecycleStage.ORAL_DEFENSE,
  LifecycleStage.LOA,
  LifecycleStage.COMPLETED,
];

const stageIndex = (stage: LifecycleStage): number => stageOrder.indexOf(stage);

const resetDatabase = async (): Promise<void> => {
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.notificationAlert.deleteMany(),
    prisma.intervention.deleteMany(),
    prisma.alert.deleteMany(),
    prisma.clearanceRecord.deleteMany(),
    prisma.formSubmission.deleteMany(),
    prisma.scheduleEvent.deleteMany(),
    prisma.availability.deleteMany(),
    prisma.scheduleRequest.deleteMany(),
    prisma.revisionNote.deleteMany(),
    prisma.documentVersion.deleteMany(),
    prisma.documentRecord.deleteMany(),
    prisma.milestoneEvent.deleteMany(),
    prisma.researchCase.deleteMany(),
    prisma.decisionLog.deleteMany(),
    prisma.task.deleteMany(),
    prisma.courseEnrollment.deleteMany(),
    prisma.termEnrollment.deleteMany(),
    prisma.studyPlanItem.deleteMany(),
    prisma.studentCurriculumTag.deleteMany(),
    prisma.curriculum.deleteMany(),
    prisma.course.deleteMany(),
    prisma.academicTerm.deleteMany(),
    prisma.studentMilestoneStatus.deleteMany(),
    prisma.studentLifecycle.deleteMany(),
    prisma.panelAssignment.deleteMany(),
    prisma.studentPanelAssignment.deleteMany(),
    prisma.adviserAssignment.deleteMany(),
    prisma.timelineEvent.deleteMany(),
    prisma.student.deleteMany(),
    prisma.milestoneDefinition.deleteMany(),
    prisma.routingRule.deleteMany(),
    prisma.alertThreshold.deleteMany(),
    prisma.program.deleteMany(),
    prisma.userRole.deleteMany(),
    prisma.role.deleteMany(),
    prisma.userAccount.deleteMany(),
  ]);
};

const ensureRoleMap = async (): Promise<Record<RoleName, number>> => {
  for (const roleName of Object.values(RoleName)) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: {
        name: roleName,
        description: roleName.replace(/_/g, " "),
      },
    });
  }

  const roles = await prisma.role.findMany();
  return roles.reduce(
    (acc, role) => ({
      ...acc,
      [role.name]: role.id,
    }),
    {} as Record<RoleName, number>
  );
};

const createUserWithRoles = async (params: {
  email: string;
  fullName: string;
  roleNames: RoleName[];
  passwordHash: string;
}): Promise<number> => {
  const user = await prisma.userAccount.create({
    data: {
      email: params.email.toLowerCase(),
      fullName: params.fullName,
      passwordHash: params.passwordHash,
      roles: {
        create: params.roleNames.map((roleName) => ({
          role: { connect: { name: roleName } },
        })),
      },
    },
  });
  return user.id;
};

const seed = async (): Promise<void> => {
  await resetDatabase();
  await ensureRoleMap();

  const sharedPassword = await bcrypt.hash("DemoPass123!", 10);

  const userIds = {
    admin: await createUserWithRoles({
      email: "admin@gs.local",
      fullName: "System Administrator",
      roleNames: [RoleName.ADMIN],
      passwordHash: sharedPassword,
    }),
    staff: await createUserWithRoles({
      email: "staff@gs.local",
      fullName: "Graduate School Staff",
      roleNames: [RoleName.GRADUATE_SCHOOL_STAFF],
      passwordHash: sharedPassword,
    }),
    acadCoord: await createUserWithRoles({
      email: "acad.coord@gs.local",
      fullName: "Academic Coordinator",
      roleNames: [RoleName.ACADEMIC_COORDINATOR],
      passwordHash: sharedPassword,
    }),
    researchCoord: await createUserWithRoles({
      email: "research.coord@gs.local",
      fullName: "Research Coordinator",
      roleNames: [RoleName.RESEARCH_COORDINATOR],
      passwordHash: sharedPassword,
    }),
    adviser1: await createUserWithRoles({
      email: "adviser.one@gs.local",
      fullName: "Prof. Alicia Romero",
      roleNames: [RoleName.ADVISER],
      passwordHash: sharedPassword,
    }),
    adviser2: await createUserWithRoles({
      email: "adviser.two@gs.local",
      fullName: "Prof. Marco Dizon",
      roleNames: [RoleName.ADVISER],
      passwordHash: sharedPassword,
    }),
    panel1: await createUserWithRoles({
      email: "panel.one@gs.local",
      fullName: "Dr. Helena Cruz",
      roleNames: [RoleName.PANEL_MEMBER],
      passwordHash: sharedPassword,
    }),
    panel2: await createUserWithRoles({
      email: "panel.two@gs.local",
      fullName: "Dr. Peter Lim",
      roleNames: [RoleName.PANEL_MEMBER],
      passwordHash: sharedPassword,
    }),
  };

  const studentUsers = await Promise.all(
    Array.from({ length: 10 }).map(async (_, index) => {
      const n = index + 1;
      const id = await createUserWithRoles({
        email: `student${n}@gs.local`,
        fullName: `Student ${n} User`,
        roleNames: [RoleName.STUDENT],
        passwordHash: sharedPassword,
      });
      return { id, n };
    })
  );

  await prisma.program.createMany({
    data: [
      { code: "MSCS", name: "MS Computer Science" },
      { code: "MAED", name: "MA Education" },
      { code: "MBA", name: "Master of Business Administration" },
      { code: "PHDENG", name: "PhD Engineering" },
    ],
  });
  const programs = await prisma.program.findMany();

  const programByCode = programs.reduce(
    (acc, item) => ({
      ...acc,
      [item.code]: item.id,
    }),
    {} as Record<string, number>
  );

  await prisma.academicTerm.createMany({
    data: [
      {
        academicYear: "2025-2026",
        term: "Term 1",
        startDate: dayjs("2025-08-01").toDate(),
        endDate: dayjs("2025-12-01").toDate(),
      },
      {
        academicYear: "2025-2026",
        term: "Term 2",
        startDate: dayjs("2026-01-10").toDate(),
        endDate: dayjs("2026-05-15").toDate(),
      },
      {
        academicYear: "2026-2027",
        term: "Term 1",
        startDate: dayjs("2026-08-01").toDate(),
        endDate: dayjs("2026-12-05").toDate(),
      },
    ],
  });
  const academicTerms = await prisma.academicTerm.findMany({
    orderBy: [{ academicYear: "asc" }, { term: "asc" }],
  });
  const termByLabel = academicTerms.reduce(
    (acc, term) => ({
      ...acc,
      [`${term.academicYear}-${term.term}`]: term.id,
    }),
    {} as Record<string, number>
  );

  await prisma.course.createMany({
    data: [
      { code: "CS-501", title: "Advanced Algorithms", units: 3, programId: programByCode.MSCS },
      { code: "CS-520", title: "Research Methods in Computing", units: 3, programId: programByCode.MSCS },
      { code: "MBA-510", title: "Strategic Management", units: 3, programId: programByCode.MBA },
      { code: "MBA-525", title: "Applied Business Analytics", units: 3, programId: programByCode.MBA },
      { code: "ENG-710", title: "Experimental Design", units: 3, programId: programByCode.PHDENG },
      { code: "EDU-610", title: "Curriculum Development", units: 3, programId: programByCode.MAED },
    ],
  });
  const courses = await prisma.course.findMany();
  const courseByCode = courses.reduce(
    (acc, course) => ({
      ...acc,
      [course.code]: course.id,
    }),
    {} as Record<string, number>
  );

  await prisma.curriculum.createMany({
    data: [
      {
        programId: programByCode.MSCS,
        code: "MSCS-2025",
        version: "v1",
        effectiveAcademicYear: "2025-2026",
      },
      {
        programId: programByCode.MBA,
        code: "MBA-2025",
        version: "v1",
        effectiveAcademicYear: "2025-2026",
      },
    ],
  });
  const curricula = await prisma.curriculum.findMany();
  const curriculumByCode = curricula.reduce(
    (acc, curriculum) => ({
      ...acc,
      [curriculum.code]: curriculum.id,
    }),
    {} as Record<string, number>
  );

  await prisma.studyPlanItem.createMany({
    data: [
      {
        curriculumId: curriculumByCode["MSCS-2025"],
        courseId: courseByCode["CS-501"],
        recommendedTermId: termByLabel["2025-2026-Term 1"],
        isRequired: true,
        notes: "Core course",
      },
      {
        curriculumId: curriculumByCode["MSCS-2025"],
        courseId: courseByCode["CS-520"],
        recommendedTermId: termByLabel["2025-2026-Term 1"],
        isRequired: true,
        notes: "Pre-thesis requirement",
      },
      {
        curriculumId: curriculumByCode["MBA-2025"],
        courseId: courseByCode["MBA-510"],
        recommendedTermId: termByLabel["2025-2026-Term 1"],
        isRequired: true,
      },
      {
        curriculumId: curriculumByCode["MBA-2025"],
        courseId: courseByCode["MBA-525"],
        recommendedTermId: termByLabel["2025-2026-Term 2"],
        isRequired: true,
      },
    ],
  });

  const studentsSeed = [
    { number: "2024-0001", firstName: "Ana", lastName: "Santos", stage: LifecycleStage.COURSEWORK, program: "MSCS", stageDays: 45, riskFlag: false },
    { number: "2024-0002", firstName: "Ben", lastName: "Reyes", stage: LifecycleStage.PROPOSAL_DEVELOPMENT, program: "MSCS", stageDays: 70, riskFlag: true },
    { number: "2024-0003", firstName: "Carla", lastName: "Tan", stage: LifecycleStage.PROPOSAL_DEFENSE, program: "MBA", stageDays: 12, riskFlag: false },
    { number: "2024-0004", firstName: "Daniel", lastName: "Uy", stage: LifecycleStage.DATA_COLLECTION, program: "PHDENG", stageDays: 88, riskFlag: true },
    { number: "2024-0005", firstName: "Elise", lastName: "Co", stage: LifecycleStage.DISSERTATION_WRITING, program: "PHDENG", stageDays: 34, riskFlag: false },
    { number: "2024-0006", firstName: "Francis", lastName: "Lim", stage: LifecycleStage.ORAL_DEFENSE, program: "MAED", stageDays: 19, riskFlag: false },
    { number: "2024-0007", firstName: "Grace", lastName: "Ong", stage: LifecycleStage.LOA, program: "MAED", stageDays: 28, riskFlag: true },
    { number: "2024-0008", firstName: "Hector", lastName: "Yu", stage: LifecycleStage.COURSEWORK, program: "MBA", stageDays: 21, riskFlag: false },
    { number: "2024-0009", firstName: "Irene", lastName: "Flores", stage: LifecycleStage.PROPOSAL_DEVELOPMENT, program: "MSCS", stageDays: 55, riskFlag: true },
    { number: "2024-0010", firstName: "Jon", lastName: "Pang", stage: LifecycleStage.COMPLETED, program: "MBA", stageDays: 5, riskFlag: false },
  ];

  const students: Array<{ id: number; stage: LifecycleStage; firstName: string; lastName: string }> = [];
  for (let i = 0; i < studentsSeed.length; i += 1) {
    const item = studentsSeed[i];
    const studentUser = studentUsers[i];
    const adviserId = i % 2 === 0 ? userIds.adviser1 : userIds.adviser2;
    const student = await prisma.student.create({
      data: {
        studentNumber: item.number,
        firstName: item.firstName,
        lastName: item.lastName,
        email: `${item.firstName.toLowerCase()}.${item.lastName.toLowerCase()}@student.gs.local`,
        programId: programByCode[item.program],
        userAccountId: studentUser.id,
        currentStage: item.stage,
        riskFlag: item.riskFlag,
        adviserId,
        researchCoordinatorId: userIds.researchCoord,
        loaStart: item.stage === LifecycleStage.LOA ? dayjs().subtract(item.stageDays, "day").toDate() : null,
      },
    });

    await prisma.adviserAssignment.create({
      data: {
        adviserUserId: adviserId,
        studentId: student.id,
      },
    });

    students.push({
      id: student.id,
      stage: student.currentStage,
      firstName: item.firstName,
      lastName: item.lastName,
    });

    const currentStageIdx = stageIndex(item.stage);
    const previousStage = currentStageIdx > 0 ? stageOrder[currentStageIdx - 1] : null;
    if (previousStage) {
      await prisma.studentLifecycle.create({
        data: {
          studentId: student.id,
          stage: previousStage,
          enteredAt: dayjs().subtract(item.stageDays + 30, "day").toDate(),
          exitedAt: dayjs().subtract(item.stageDays, "day").toDate(),
          notes: "Seeded previous stage.",
          changedById: userIds.staff,
        },
      });
    }

    await prisma.studentLifecycle.create({
      data: {
        studentId: student.id,
        stage: item.stage,
        enteredAt: dayjs().subtract(item.stageDays, "day").toDate(),
        notes: "Seeded current stage entry.",
        changedById: userIds.staff,
      },
    });
  }

  for (const student of students) {
    await prisma.studentPanelAssignment.createMany({
      data: [
        { studentId: student.id, panelMemberId: userIds.panel1 },
        { studentId: student.id, panelMemberId: userIds.panel2 },
      ],
      skipDuplicates: true,
    });

    await prisma.panelAssignment.createMany({
      data: [
        { studentId: student.id, panelUserId: userIds.panel1 },
        { studentId: student.id, panelUserId: userIds.panel2 },
      ],
      skipDuplicates: true,
    });
  }

  await prisma.studentCurriculumTag.createMany({
    data: [
      {
        studentId: students[0].id,
        curriculumId: curriculumByCode["MSCS-2025"],
        tag: "regular-plan",
      },
      {
        studentId: students[1].id,
        curriculumId: curriculumByCode["MSCS-2025"],
        tag: "revised-plan",
      },
      {
        studentId: students[2].id,
        curriculumId: curriculumByCode["MBA-2025"],
        tag: "bridging",
      },
      {
        studentId: students[7].id,
        curriculumId: curriculumByCode["MBA-2025"],
        tag: "conditional",
      },
    ],
  });

  const termEnrollments = await Promise.all([
    prisma.termEnrollment.create({
      data: {
        studentId: students[0].id,
        termId: termByLabel["2025-2026-Term 1"],
        statusSignal: "enrolled",
        confirmedAt: dayjs().subtract(150, "day").toDate(),
      },
    }),
    prisma.termEnrollment.create({
      data: {
        studentId: students[0].id,
        termId: termByLabel["2025-2026-Term 2"],
        statusSignal: "enrolled",
        confirmedAt: dayjs().subtract(50, "day").toDate(),
      },
    }),
    prisma.termEnrollment.create({
      data: {
        studentId: students[1].id,
        termId: termByLabel["2025-2026-Term 2"],
        statusSignal: "enrolled",
        confirmedAt: dayjs().subtract(60, "day").toDate(),
      },
    }),
    prisma.termEnrollment.create({
      data: {
        studentId: students[2].id,
        termId: termByLabel["2025-2026-Term 1"],
        statusSignal: "completed",
        confirmedAt: dayjs().subtract(170, "day").toDate(),
      },
    }),
    prisma.termEnrollment.create({
      data: {
        studentId: students[3].id,
        termId: termByLabel["2025-2026-Term 2"],
        statusSignal: "enrolled",
        confirmedAt: dayjs().subtract(65, "day").toDate(),
      },
    }),
    prisma.termEnrollment.create({
      data: {
        studentId: students[7].id,
        termId: termByLabel["2025-2026-Term 2"],
        statusSignal: "withdrawn",
        confirmedAt: dayjs().subtract(40, "day").toDate(),
      },
    }),
  ]);

  await prisma.courseEnrollment.createMany({
    data: [
      {
        termEnrollmentId: termEnrollments[0].id,
        courseId: courseByCode["CS-501"],
        statusSignal: "completed",
        grade: "1.75",
      },
      {
        termEnrollmentId: termEnrollments[0].id,
        courseId: courseByCode["CS-520"],
        statusSignal: "completed",
        grade: "1.50",
      },
      {
        termEnrollmentId: termEnrollments[1].id,
        courseId: courseByCode["CS-520"],
        statusSignal: "in-progress",
        grade: null,
      },
      {
        termEnrollmentId: termEnrollments[3].id,
        courseId: courseByCode["MBA-510"],
        statusSignal: "completed",
        grade: "1.25",
      },
      {
        termEnrollmentId: termEnrollments[5].id,
        courseId: courseByCode["MBA-525"],
        statusSignal: "incomplete",
        grade: "INC",
      },
    ],
  });

  const milestoneDefinitions = await Promise.all(
    [
      { name: "Admission Documents Complete", stage: LifecycleStage.ADMISSION, expectedDays: 7, criticality: 2, sortOrder: 1, createdById: userIds.admin },
      { name: "Course Plan Approved", stage: LifecycleStage.COURSEWORK, expectedDays: 30, criticality: 3, sortOrder: 1, createdById: userIds.admin },
      { name: "Proposal Draft Submitted", stage: LifecycleStage.PROPOSAL_DEVELOPMENT, expectedDays: 45, criticality: 4, sortOrder: 1, createdById: userIds.admin },
      { name: "Panel Pre-Review Complete", stage: LifecycleStage.PROPOSAL_DEVELOPMENT, expectedDays: 20, criticality: 3, sortOrder: 2, createdById: userIds.admin },
      { name: "Proposal Defense Completed", stage: LifecycleStage.PROPOSAL_DEFENSE, expectedDays: 14, criticality: 5, sortOrder: 1, createdById: userIds.admin },
      { name: "Data Collection Ethics Clearance", stage: LifecycleStage.DATA_COLLECTION, expectedDays: 21, criticality: 4, sortOrder: 1, createdById: userIds.admin },
      { name: "Draft Chapters Submitted", stage: LifecycleStage.DISSERTATION_WRITING, expectedDays: 60, criticality: 4, sortOrder: 1, createdById: userIds.admin },
      { name: "Final Oral Defense Schedule", stage: LifecycleStage.ORAL_DEFENSE, expectedDays: 15, criticality: 5, sortOrder: 1, createdById: userIds.admin },
    ].map((data) => prisma.milestoneDefinition.create({ data }))
  );

  for (const student of students) {
    const currentIdx = stageIndex(student.stage);
    for (const def of milestoneDefinitions) {
      const milestoneIdx = stageIndex(def.stage);
      if (milestoneIdx > currentIdx) continue;

      const isCurrentStageMilestone = def.stage === student.stage;
      const status = isCurrentStageMilestone
        ? MilestoneStatus.IN_PROGRESS
        : MilestoneStatus.COMPLETED;

      await prisma.studentMilestoneStatus.create({
        data: {
          studentId: student.id,
          milestoneDefinitionId: def.id,
          status,
          dueAt: dayjs().add(14, "day").toDate(),
          completedAt: status === MilestoneStatus.COMPLETED ? dayjs().subtract(3, "day").toDate() : null,
          updatedById: userIds.staff,
          notes: status === MilestoneStatus.IN_PROGRESS ? "Currently in progress." : "Completed.",
        },
      });
    }
  }

  await prisma.alertThreshold.createMany({
    data: [
      { key: "TASK_ESCALATION_DAYS", thresholdDays: 7, enabled: true, description: "Escalate tasks beyond 7 days overdue.", createdById: userIds.admin, updatedById: userIds.admin },
      { key: "UNRESOLVED_HANDOFF_DAYS", thresholdDays: 5, enabled: true, description: "Unresolved handoff threshold.", createdById: userIds.admin, updatedById: userIds.admin },
      { key: "DELAYED_SCHEDULING_DAYS", thresholdDays: 10, enabled: true, description: "Scheduling delay threshold.", createdById: userIds.admin, updatedById: userIds.admin },
      { key: "INACTIVITY_DAYS", thresholdDays: 14, enabled: true, description: "Student inactivity threshold.", createdById: userIds.admin, updatedById: userIds.admin },
      { key: "STAGE_PROPOSAL_DEVELOPMENT", stage: LifecycleStage.PROPOSAL_DEVELOPMENT, thresholdDays: 50, enabled: true, description: "Proposal development stage threshold.", createdById: userIds.admin, updatedById: userIds.admin },
      { key: "STAGE_DATA_COLLECTION", stage: LifecycleStage.DATA_COLLECTION, thresholdDays: 75, enabled: true, description: "Data collection stage threshold.", createdById: userIds.admin, updatedById: userIds.admin },
      { key: "STAGE_DISSERTATION_WRITING", stage: LifecycleStage.DISSERTATION_WRITING, thresholdDays: 45, enabled: true, description: "Dissertation writing stage threshold.", createdById: userIds.admin, updatedById: userIds.admin },
    ],
  });

  await prisma.routingRule.createMany({
    data: [
      {
        fromStage: LifecycleStage.PROPOSAL_DEVELOPMENT,
        decision: TaskDecision.REVISE,
        nextOwnerRole: RoleName.STUDENT,
        taskTemplate: "Revise proposal draft and re-submit to adviser",
        createdById: userIds.admin,
        updatedById: userIds.admin,
      },
      {
        fromStage: LifecycleStage.PROPOSAL_DEFENSE,
        decision: TaskDecision.RETURN,
        nextOwnerRole: RoleName.ADVISER,
        taskTemplate: "Coordinate proposal return notes with student",
        createdById: userIds.admin,
        updatedById: userIds.admin,
      },
      {
        fromStage: LifecycleStage.DISSERTATION_WRITING,
        decision: TaskDecision.REVISE,
        nextOwnerRole: RoleName.STUDENT,
        taskTemplate: "Address dissertation revision notes",
        createdById: userIds.admin,
        updatedById: userIds.admin,
      },
    ],
  });

  const milestoneMap = milestoneDefinitions.reduce(
    (acc, item) => ({
      ...acc,
      [item.name]: item.id,
    }),
    {} as Record<string, number>
  );

  const taskSeed = [
    {
      title: "Review proposal draft",
      studentId: students[1].id,
      milestone: "Proposal Draft Submitted",
      assignedToId: userIds.adviser1,
      assignedRole: RoleName.ADVISER,
      nextActionOwnerRole: RoleName.ADVISER,
      status: TaskStatus.OVERDUE,
      dueOffset: -9,
      createdById: userIds.staff,
    },
    {
      title: "Submit revised methodology chapter",
      studentId: students[3].id,
      milestone: "Data Collection Ethics Clearance",
      assignedToId: studentUsers[3].id,
      assignedRole: RoleName.STUDENT,
      nextActionOwnerRole: RoleName.STUDENT,
      status: TaskStatus.PENDING,
      dueOffset: 4,
      createdById: userIds.adviser2,
    },
    {
      title: "Panel pre-review decision",
      studentId: students[2].id,
      milestone: "Proposal Defense Completed",
      assignedToId: userIds.panel1,
      assignedRole: RoleName.PANEL_MEMBER,
      nextActionOwnerRole: RoleName.PANEL_MEMBER,
      status: TaskStatus.IN_PROGRESS,
      dueOffset: -1,
      createdById: userIds.acadCoord,
    },
    {
      title: "Schedule oral defense panel",
      studentId: students[5].id,
      milestone: "Final Oral Defense Schedule",
      assignedToId: userIds.staff,
      assignedRole: RoleName.GRADUATE_SCHOOL_STAFF,
      nextActionOwnerRole: RoleName.GRADUATE_SCHOOL_STAFF,
      status: TaskStatus.PENDING,
      dueOffset: 2,
      createdById: userIds.acadCoord,
    },
    {
      title: "Validate coursework completion",
      studentId: students[0].id,
      milestone: "Course Plan Approved",
      assignedToId: userIds.acadCoord,
      assignedRole: RoleName.ACADEMIC_COORDINATOR,
      nextActionOwnerRole: RoleName.ACADEMIC_COORDINATOR,
      status: TaskStatus.COMPLETED,
      dueOffset: -20,
      createdById: userIds.staff,
    },
    {
      title: "Finalize LOA status review",
      studentId: students[6].id,
      milestone: "Draft Chapters Submitted",
      assignedToId: userIds.researchCoord,
      assignedRole: RoleName.RESEARCH_COORDINATOR,
      nextActionOwnerRole: RoleName.RESEARCH_COORDINATOR,
      status: TaskStatus.OVERDUE,
      dueOffset: -13,
      createdById: userIds.staff,
    },
  ];

  const createdTasks = [];
  for (const task of taskSeed) {
    const created = await prisma.task.create({
      data: {
        title: task.title,
        studentId: task.studentId,
        milestoneDefinitionId: milestoneMap[task.milestone] ?? null,
        description: "Seed task for workflow queue.",
        assignedToId: task.assignedToId,
        assignedRole: task.assignedRole,
        nextActionOwnerRole: task.nextActionOwnerRole,
        status: task.status,
        dueAt: dayjs().add(task.dueOffset, "day").toDate(),
        createdById: task.createdById,
        priorityScore: 25 + Math.max(0, Math.abs(task.dueOffset) * 2),
      },
    });
    createdTasks.push(created);
  }

  await prisma.decisionLog.createMany({
    data: [
      {
        taskId: createdTasks[4].id,
        studentId: createdTasks[4].studentId,
        decision: TaskDecision.APPROVE,
        rationale: "Coursework validated and complete.",
        decidedById: userIds.acadCoord,
        createdAt: dayjs().subtract(15, "day").toDate(),
      },
      {
        taskId: createdTasks[2].id,
        studentId: createdTasks[2].studentId,
        decision: TaskDecision.REVISE,
        rationale: "Need clearer justification in chapter 2.",
        decidedById: userIds.panel1,
        createdAt: dayjs().subtract(2, "day").toDate(),
      },
    ],
  });

  const researchCases = await Promise.all([
    prisma.researchCase.create({
      data: {
        studentId: students[1].id,
        caseType: "thesis",
        topicTitle: "AI-Supported Student Risk Monitoring",
        status: "under-review",
        currentMilestoneId: milestoneMap["Proposal Draft Submitted"],
      },
    }),
    prisma.researchCase.create({
      data: {
        studentId: students[3].id,
        caseType: "dissertation",
        topicTitle: "Optimization in Distributed Sensor Networks",
        status: "data-collection",
        currentMilestoneId: milestoneMap["Data Collection Ethics Clearance"],
      },
    }),
    prisma.researchCase.create({
      data: {
        studentId: students[5].id,
        caseType: "thesis",
        topicTitle: "Assessment Rubric Standardization for Oral Defense",
        status: "for-scheduling",
        currentMilestoneId: milestoneMap["Final Oral Defense Schedule"],
      },
    }),
  ]);

  const milestoneEvents = await Promise.all([
    prisma.milestoneEvent.create({
      data: {
        researchCaseId: researchCases[0].id,
        studentId: students[1].id,
        milestoneDefinitionId: milestoneMap["Proposal Draft Submitted"],
        occurredAt: dayjs().subtract(18, "day").toDate(),
        outcome: "submitted",
        ownerRole: RoleName.STUDENT,
        taskId: createdTasks[0].id,
        notes: "Initial draft submitted for adviser review.",
      },
    }),
    prisma.milestoneEvent.create({
      data: {
        researchCaseId: researchCases[0].id,
        studentId: students[1].id,
        milestoneDefinitionId: milestoneMap["Proposal Draft Submitted"],
        occurredAt: dayjs().subtract(2, "day").toDate(),
        outcome: "revise",
        ownerRole: RoleName.ADVISER,
        decidedById: userIds.adviser1,
        taskId: createdTasks[0].id,
        notes: "Revision requested due to insufficient literature synthesis.",
      },
    }),
    prisma.milestoneEvent.create({
      data: {
        researchCaseId: researchCases[1].id,
        studentId: students[3].id,
        milestoneDefinitionId: milestoneMap["Data Collection Ethics Clearance"],
        occurredAt: dayjs().subtract(12, "day").toDate(),
        outcome: "approved",
        ownerRole: RoleName.RESEARCH_COORDINATOR,
        decidedById: userIds.researchCoord,
        taskId: createdTasks[1].id,
        notes: "Ethics clearance validated. Proceed to field data collection.",
      },
    }),
    prisma.milestoneEvent.create({
      data: {
        researchCaseId: researchCases[2].id,
        studentId: students[5].id,
        milestoneDefinitionId: milestoneMap["Final Oral Defense Schedule"],
        occurredAt: dayjs().subtract(4, "day").toDate(),
        outcome: "pending",
        ownerRole: RoleName.GRADUATE_SCHOOL_STAFF,
        taskId: createdTasks[3].id,
        notes: "Waiting final panel confirmation for defense slot.",
      },
    }),
  ]);

  await prisma.formSubmission.createMany({
    data: [
      {
        studentId: students[1].id,
        milestoneEventId: milestoneEvents[1].id,
        formType: "ProposalRevisionForm",
        submittedAt: dayjs().subtract(1, "day").toDate(),
        endorsedAt: null,
        approvedAt: null,
        routingState: "awaiting-adviser-endorsement",
        submittedById: studentUsers[1].id,
      },
      {
        studentId: students[3].id,
        milestoneEventId: milestoneEvents[2].id,
        formType: "EthicsClearanceForm",
        submittedAt: dayjs().subtract(14, "day").toDate(),
        endorsedAt: dayjs().subtract(13, "day").toDate(),
        approvedAt: dayjs().subtract(12, "day").toDate(),
        routingState: "approved",
        submittedById: studentUsers[3].id,
      },
      {
        studentId: students[5].id,
        milestoneEventId: milestoneEvents[3].id,
        formType: "DefenseSchedulingForm",
        submittedAt: dayjs().subtract(5, "day").toDate(),
        endorsedAt: dayjs().subtract(4, "day").toDate(),
        approvedAt: null,
        routingState: "for-panel-confirmation",
        submittedById: userIds.staff,
      },
    ],
  });

  await prisma.clearanceRecord.createMany({
    data: [
      {
        studentId: students[3].id,
        milestoneDefinitionId: milestoneMap["Data Collection Ethics Clearance"],
        submittedAt: dayjs().subtract(14, "day").toDate(),
        clearedAt: dayjs().subtract(12, "day").toDate(),
        status: "cleared",
        createdById: userIds.researchCoord,
      },
      {
        studentId: students[1].id,
        milestoneDefinitionId: milestoneMap["Proposal Draft Submitted"],
        submittedAt: dayjs().subtract(2, "day").toDate(),
        clearedAt: null,
        status: "pending",
        createdById: userIds.adviser1,
      },
      {
        studentId: students[5].id,
        milestoneDefinitionId: milestoneMap["Final Oral Defense Schedule"],
        submittedAt: dayjs().subtract(5, "day").toDate(),
        clearedAt: null,
        status: "under-review",
        createdById: userIds.staff,
      },
    ],
  });

  const documentRecords = [];
  for (const student of students.slice(0, 6)) {
    const record = await prisma.documentRecord.create({
      data: {
        studentId: student.id,
        checklistItem: "Proposal Manuscript",
        milestoneDefinitionId: milestoneMap["Proposal Draft Submitted"] ?? null,
        status: DocumentStatus.NEEDS_REVISION,
        outstandingRevisionCount: 1,
      },
    });
    documentRecords.push(record);
  }

  for (const [index, doc] of documentRecords.entries()) {
    const firstVersion = await prisma.documentVersion.create({
      data: {
        documentRecordId: doc.id,
        versionNumber: 1,
        fileName: `proposal-${index + 1}-v1.pdf`,
        filePath: `seed/proposal-${index + 1}-v1.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 120000 + index * 2000,
        uploadedById: studentUsers[index].id,
        isCurrent: false,
        uploadedAt: dayjs().subtract(10, "day").toDate(),
      },
    });

    const secondVersion = await prisma.documentVersion.create({
      data: {
        documentRecordId: doc.id,
        versionNumber: 2,
        fileName: `proposal-${index + 1}-v2.pdf`,
        filePath: `seed/proposal-${index + 1}-v2.pdf`,
        mimeType: "application/pdf",
        sizeBytes: 128000 + index * 2200,
        uploadedById: studentUsers[index].id,
        isCurrent: true,
        uploadedAt: dayjs().subtract(3, "day").toDate(),
      },
    });

    await prisma.revisionNote.create({
      data: {
        documentRecordId: doc.id,
        versionId: secondVersion.id,
        authorId: userIds.adviser1,
        note: "Clarify research gap statement and tighten literature review synthesis.",
        isResolved: index % 2 === 0 ? false : true,
        resolvedAt: index % 2 === 0 ? null : dayjs().subtract(1, "day").toDate(),
        createdAt: dayjs().subtract(2, "day").toDate(),
      },
    });

    await prisma.revisionNote.create({
      data: {
        documentRecordId: doc.id,
        versionId: firstVersion.id,
        authorId: userIds.panel1,
        note: "Methodology section approved after updates.",
        isResolved: true,
        resolvedAt: dayjs().subtract(5, "day").toDate(),
        createdAt: dayjs().subtract(9, "day").toDate(),
      },
    });
  }

  const scheduleRequests = await Promise.all(
    students.slice(2, 7).map((student, i) =>
      prisma.scheduleRequest.create({
        data: {
          studentId: student.id,
          requestedById: userIds.staff,
          preferredDate: dayjs().add(7 + i, "day").toDate(),
          reason: "Defense schedule coordination",
          status: i % 2 === 0 ? ScheduleStatus.REQUESTED : ScheduleStatus.RESCHEDULED,
          createdAt: dayjs().subtract(12 - i, "day").toDate(),
        },
      })
    )
  );

  for (const [i, request] of scheduleRequests.entries()) {
    await prisma.availability.createMany({
      data: [
        {
          scheduleRequestId: request.id,
          userId: userIds.panel1,
          availableFrom: dayjs().add(5 + i, "day").hour(9).minute(0).toDate(),
          availableTo: dayjs().add(5 + i, "day").hour(11).minute(0).toDate(),
          notes: "Morning slot preferred.",
        },
        {
          scheduleRequestId: request.id,
          userId: userIds.panel2,
          availableFrom: dayjs().add(6 + i, "day").hour(13).minute(0).toDate(),
          availableTo: dayjs().add(6 + i, "day").hour(16).minute(0).toDate(),
          notes: "Afternoon slot preferred.",
        },
      ],
    });

    await prisma.scheduleEvent.create({
      data: {
        scheduleRequestId: request.id,
        eventStatus: i % 3 === 0 ? ScheduleStatus.CONFIRMED : ScheduleStatus.RESCHEDULED,
        scheduledAt: dayjs().add(8 + i, "day").toDate(),
        decidedById: userIds.staff,
        notes: i % 3 === 0 ? "Confirmed with panel and adviser." : "Need additional panel availability.",
        createdAt: dayjs().subtract(1, "day").toDate(),
      },
    });
  }

  const alerts = await Promise.all(
    [
      {
        studentId: students[1].id,
        taskId: createdTasks[0].id,
        alertType: AlertType.UNRESOLVED_HANDOFF,
        severity: AlertSeverity.HIGH,
        status: AlertStatus.OPEN,
        message: "Proposal review task is overdue by more than threshold.",
        thresholdDays: 5,
        triggeredAt: dayjs().subtract(2, "day").toDate(),
        createdById: userIds.staff,
      },
      {
        studentId: students[3].id,
        alertType: AlertType.PROLONGED_STAGE,
        severity: AlertSeverity.CRITICAL,
        status: AlertStatus.ACKNOWLEDGED,
        message: "Data collection stage exceeds configured duration.",
        thresholdDays: 75,
        triggeredAt: dayjs().subtract(4, "day").toDate(),
        createdById: userIds.researchCoord,
      },
      {
        studentId: students[6].id,
        alertType: AlertType.INACTIVITY,
        severity: AlertSeverity.MEDIUM,
        status: AlertStatus.OPEN,
        message: "No activity logged within inactivity threshold.",
        thresholdDays: 14,
        triggeredAt: dayjs().subtract(1, "day").toDate(),
        createdById: userIds.staff,
      },
    ].map((data) => prisma.alert.create({ data }))
  );

  await prisma.intervention.createMany({
    data: [
      {
        alertId: alerts[1].id,
        actionTaken: "Coordinator met adviser for recovery plan.",
        evidenceNote: "Meeting notes saved in portal.",
        performedById: userIds.researchCoord,
        status: InterventionStatus.OPEN,
      },
      {
        alertId: alerts[1].id,
        actionTaken: "Student submitted revised timeline.",
        evidenceNote: "Timeline accepted and archived.",
        performedById: userIds.adviser2,
        status: InterventionStatus.CLOSED,
        closedAt: dayjs().subtract(1, "day").toDate(),
        closureEvidence: "Timeline version 2 attached.",
      },
    ],
  });

  for (const alert of alerts) {
    await prisma.notificationAlert.createMany({
      data: [
        {
          alertId: alert.id,
          userId: userIds.staff,
          email: "staff@gs.local",
          reason: "Monitoring alert notification",
          success: true,
          metadata: { channel: "SMTP" },
        },
        {
          alertId: alert.id,
          userId: userIds.acadCoord,
          email: "acad.coord@gs.local",
          reason: "Monitoring alert notification",
          success: true,
          metadata: { channel: "SMTP" },
        },
      ],
    });
  }

  for (const student of students) {
    await prisma.timelineEvent.createMany({
      data: [
        {
          studentId: student.id,
          eventType: "STUDENT_CREATED",
          title: "Student record initialized",
          details: "Seeded demo student profile.",
          relatedEntityType: "Student",
          relatedEntityId: student.id,
          performedById: userIds.admin,
          occurredAt: dayjs().subtract(100, "day").toDate(),
        },
        {
          studentId: student.id,
          eventType: "MILESTONE_PROGRESS",
          title: "Milestone status refreshed",
          details: "Routine milestone status update.",
          relatedEntityType: "StudentMilestoneStatus",
          relatedEntityId: null,
          performedById: userIds.staff,
          occurredAt: dayjs().subtract(5, "day").toDate(),
        },
      ],
    });
  }

  await prisma.auditLog.createMany({
    data: [
      {
        actorUserId: userIds.admin,
        actionType: AuditActionType.LOGIN_SUCCESS,
        entityType: "UserAccount",
        entityId: String(userIds.admin),
        description: "Seeded login success event.",
      },
      {
        actorUserId: userIds.staff,
        actionType: AuditActionType.CREATE,
        entityType: "Task",
        entityId: String(createdTasks[0].id),
        description: "Seeded task creation audit.",
      },
      {
        actorUserId: userIds.adviser1,
        actionType: AuditActionType.DECISION,
        entityType: "Task",
        entityId: String(createdTasks[0].id),
        description: "Seeded decision audit.",
      },
      {
        actorUserId: userIds.panel1,
        actionType: AuditActionType.ACCESS_DENIED,
        entityType: "Route",
        entityId: "/api/admin/thresholds",
        description: "Seeded denied access event.",
      },
      {
        actorUserId: userIds.staff,
        actionType: AuditActionType.CONFIG_CHANGE,
        entityType: "AlertThreshold",
        entityId: "1",
        description: "Seeded threshold adjustment event.",
      },
    ],
  });
};

seed()
  .then(async () => {
    // eslint-disable-next-line no-console
    console.log("Seed completed.");
    // eslint-disable-next-line no-console
    console.log("\nDemo credentials (password for all: DemoPass123!):");
    // eslint-disable-next-line no-console
    console.log("  ADMIN: admin@gs.local");
    // eslint-disable-next-line no-console
    console.log("  GRADUATE_SCHOOL_STAFF: staff@gs.local");
    // eslint-disable-next-line no-console
    console.log("  ACADEMIC_COORDINATOR: acad.coord@gs.local");
    // eslint-disable-next-line no-console
    console.log("  RESEARCH_COORDINATOR: research.coord@gs.local");
    // eslint-disable-next-line no-console
    console.log("  ADVISER: adviser.one@gs.local");
    // eslint-disable-next-line no-console
    console.log("  PANEL_MEMBER: panel.one@gs.local");
    // eslint-disable-next-line no-console
    console.log("  STUDENT: student1@gs.local");
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error("Seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });

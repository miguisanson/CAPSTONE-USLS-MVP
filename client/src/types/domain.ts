export type RoleName =
  | "ADMIN"
  | "GRADUATE_SCHOOL_STAFF"
  | "ACADEMIC_COORDINATOR"
  | "RESEARCH_COORDINATOR"
  | "ADVISER"
  | "PANEL_MEMBER"
  | "STUDENT";

export type LifecycleStage =
  | "ADMISSION"
  | "COURSEWORK"
  | "PROPOSAL_DEVELOPMENT"
  | "PROPOSAL_DEFENSE"
  | "DATA_COLLECTION"
  | "DISSERTATION_WRITING"
  | "ORAL_DEFENSE"
  | "LOA"
  | "COMPLETED";

export type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE";
export type TaskDecision = "APPROVE" | "REVISE" | "RETURN";
export type AlertStatus = "OPEN" | "ACKNOWLEDGED" | "CLOSED";
export type ScheduleStatus = "REQUESTED" | "CONFIRMED" | "RESCHEDULED" | "CANCELLED";

export type AuthUser = {
  id: number;
  email: string;
  fullName: string;
  roles: RoleName[];
  studentId?: number | null;
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};

export type DashboardSummary = {
  studentsInScope: number;
  myOpenTasks: number;
  overdueTasks: number;
  openAlerts: number;
  roles: RoleName[];
};

export type StudentListItem = {
  id: number;
  studentNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  currentStage: LifecycleStage;
  riskFlag: boolean;
  openTaskCount?: number;
  openAlertCount?: number;
  pendingMilestoneCount?: number;
  nextActionOwnerRole?: RoleName | null;
  latestTaskStatus?: TaskStatus | null;
  lastActivityAt?: string | null;
  program: {
    code: string;
    name: string;
  };
  adviser?: { id: number; fullName: string } | null;
  researchCoordinator?: { id: number; fullName: string } | null;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type TaskItem = {
  id: number;
  title: string;
  description?: string | null;
  studentId?: number | null;
  milestoneDefinitionId?: number | null;
  assignedRole?: RoleName | null;
  assignedToId?: number | null;
  nextActionOwnerRole?: RoleName | null;
  status: TaskStatus;
  dueAt?: string | null;
  priorityScore: number;
  recommendedAction?: string | null;
  escalationPrompt?: string | null;
  milestoneDefinition?: {
    id: number;
    name: string;
    stage: LifecycleStage;
    criticality: number;
  } | null;
  student?: StudentListItem;
  assignedTo?: { id: number; fullName: string } | null;
};

export type StudentDetail = StudentListItem & {
  adviserAssignments?: Array<{
    id: number;
    adviserUser: { id: number; fullName: string; email: string };
  }>;
  panelAssignments?: Array<{
    id: number;
    panelMember: { id: number; fullName: string; email: string };
  }>;
  panelAssignmentsV2?: Array<{
    id: number;
    panelUser: { id: number; fullName: string; email: string };
  }>;
  lifecycleHistory?: Array<{
    id: number;
    stage: LifecycleStage;
    enteredAt: string;
    exitedAt?: string | null;
    notes?: string | null;
  }>;
  milestoneStatuses: Array<{
    id: number;
    status: string;
    dueAt?: string | null;
    completedAt?: string | null;
    notes?: string | null;
    milestoneDefinition: {
      id: number;
      name: string;
      stage: LifecycleStage;
      criticality: number;
    };
  }>;
  tasks: TaskItem[];
  timelineEvents: Array<{
    id: number;
    eventType: string;
    title: string;
    details?: string | null;
    occurredAt: string;
  }>;
  documents: DocumentRecord[];
  scheduleRequests: ScheduleRequestItem[];
  alerts: AlertItem[];
};

export type DocumentRecord = {
  id: number;
  studentId: number;
  checklistItem: string;
  status: string;
  outstandingRevisionCount: number;
  milestoneDefinition?: {
    id: number;
    name: string;
  } | null;
  versions: Array<{
    id: number;
    versionNumber: number;
    fileName: string;
    filePath: string;
    uploadedAt: string;
    isCurrent: boolean;
  }>;
  revisionNotes: Array<{
    id: number;
    note: string;
    isResolved: boolean;
    resolvedAt?: string | null;
    createdAt: string;
    author?: { id: number; fullName: string } | null;
    version?: {
      id: number;
      versionNumber: number;
      fileName: string;
    } | null;
  }>;
};

export type ScheduleRequestItem = {
  id: number;
  studentId: number;
  status: ScheduleStatus;
  preferredDate?: string | null;
  reason?: string | null;
  createdAt: string;
  requestedBy?: { id: number; fullName: string } | null;
  student?: StudentListItem;
  availabilities: Array<{
    id: number;
    availableFrom: string;
    availableTo: string;
    notes?: string | null;
    user?: { id: number; fullName: string } | null;
  }>;
  scheduleEvents: Array<{
    id: number;
    eventStatus: ScheduleStatus;
    scheduledAt?: string | null;
    notes?: string | null;
    createdAt: string;
    decidedBy?: { id: number; fullName: string } | null;
  }>;
};

export type AlertItem = {
  id: number;
  studentId: number;
  taskId?: number | null;
  alertType: string;
  severity: string;
  status: AlertStatus;
  message: string;
  thresholdDays?: number | null;
  triggeredAt: string;
  student?: StudentListItem;
  interventions: Array<{
    id: number;
    actionTaken: string;
    evidenceNote?: string | null;
    status: string;
    performedAt: string;
    closureEvidence?: string | null;
    performedBy?: { id: number; fullName: string } | null;
  }>;
  notifications: Array<{
    id: number;
    email: string;
    sentAt: string;
    success: boolean;
  }>;
};

export type AnalyticsDashboard = {
  stageCounts: Array<{ stage: string; count: number }>;
  pendingQueues: Array<{ role: string; count: number }>;
  agingByStage: Array<{ stage: string; averageDays: number }>;
  schedulingCycleTimeDays: number;
  loaVisibilityCount: number;
  workloadIndicators: Array<{ owner: string; taskCount: number }>;
};

export type PrescriptiveAnalyticsResponse = {
  generated_at: string;
  summary: string;
  priority_actions: Array<{
    action: string;
    why: string;
    who: string;
    timeframe: string;
    confidence: "low" | "med" | "high";
  }>;
  top_cases: Array<{
    student_ref: string;
    reason: string;
    recommended_next_action: string;
    owner_role: string;
    confidence: "low" | "med" | "high";
    data_needed: string[];
    priority_score: number;
  }>;
  disclaimer: string;
  ai: {
    enabled: boolean;
    status: "disabled" | "success" | "error";
    message: string;
    cached: boolean;
    prompt_hash?: string;
  };
};

export type AuditLogItem = {
  id: string;
  actorUserId?: number | null;
  actionType: string;
  entityType: string;
  entityId?: string | null;
  description: string;
  createdAt: string;
  actor?: { id: number; fullName: string; email: string } | null;
};

export type MilestoneDefinition = {
  id: number;
  name: string;
  stage: LifecycleStage;
  expectedDays: number;
  criticality: number;
  active: boolean;
  sortOrder: number;
};

export type AlertThreshold = {
  id: number;
  key: string;
  stage?: LifecycleStage | null;
  thresholdDays: number;
  enabled: boolean;
  description: string;
};

export type RoutingRule = {
  id: number;
  fromStage: LifecycleStage;
  decision?: TaskDecision | null;
  nextOwnerRole: RoleName;
  taskTemplate: string;
  active: boolean;
};

export type UserAccount = {
  id: number;
  fullName: string;
  email: string;
  isActive: boolean;
  roles: RoleName[];
};

export type TransactionDefinition = {
  key: string;
  priority: "P0" | "P1" | "P2";
  transaction: string;
  actors: RoleName[];
  dataCaptured: string;
};

export type TransactionComponentDefinition = {
  key: "lifecycle" | "coursework" | "research" | "scheduling" | "completion" | "followUp";
  title: string;
  transactions: TransactionDefinition[];
};

export type TransactionDefinitionsResponse = {
  components: TransactionComponentDefinition[];
};

export type TransactionRecordPayload = {
  transactionKey: string;
  studentId?: number | null;
  actorRole?: RoleName | null;
  sourceReference?: string | null;
  termId?: number | null;
  milestoneDefinitionId?: number | null;
  scheduleRequestId?: number | null;
  adviserUserId?: number | null;
  panelUserIds?: number[];
  studentProfile?: {
    studentNumber: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    programCode: string;
  } | null;
  statusResult?: string | null;
  missingItems?: string[];
  decisionOutcome?: TaskDecision | null;
  nextOwnerRole?: RoleName | null;
  evidenceNote?: string | null;
  notes?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
};

export type TransactionRecordResponse = {
  message: string;
  transactionKey: string;
  studentId?: number | null;
  taskId?: number | null;
  createdEntity?: { type: string; id: number | string } | null;
};

export type TransactionStudentRef = {
  id: number;
  studentNumber: string;
  firstName: string;
  lastName: string;
  currentStage: LifecycleStage;
  riskFlag: boolean;
  program: { code: string; name: string };
};

export type LifecycleTransactionModel = {
  summary: {
    totalInScope: number;
    admissionRecords: number;
    loaActive: number;
    openLifecycleTasks: number;
  };
  stageCounts: Array<{ stage: LifecycleStage; count: number }>;
  handoffCandidates: TransactionStudentRef[];
  loaCases: Array<TransactionStudentRef & { loaStart?: string | null; loaEnd?: string | null }>;
  standingRecords: Array<{
    id: number;
    statusSignal?: string | null;
    confirmedAt?: string | null;
    term: { academicYear: string; term: string };
    student: TransactionStudentRef;
  }>;
  lifecycleTasks: TaskItem[];
};

export type CourseworkTransactionModel = {
  summary: {
    auditedStudents: number;
    completeCoursework: number;
    missingSubjectCases: number;
    highDemandSubjects: number;
  };
  courseAudits: Array<{
    student: {
      id: number;
      label: string;
      currentStage: LifecycleStage;
      program: { code: string; name: string };
    };
    curriculum?: { id: number; code: string; version?: string | null; effectiveAcademicYear?: string | null } | null;
    requiredCount: number;
    completedCount: number;
    currentCount: number;
    missingCount: number;
    affectedCount: number;
    missingSubjects: Array<{ id: number; code: string; title: string }>;
    currentSubjects: Array<{ id: number; code: string; title: string }>;
    affectedSubjects: Array<{ id: number; code: string; title: string }>;
    result: string;
  }>;
  offeringDemand: Array<{ courseCode: string; courseTitle: string; count: number; students: string[] }>;
};

export type ResearchTransactionModel = {
  summary: {
    researchCases: number;
    readyCases: number;
    revisionCases: number;
    missingEvidenceCases: number;
  };
  gateCases: Array<{
    student: TransactionStudentRef & {
      adviser?: { id: number; fullName: string } | null;
      researchCoordinator?: { id: number; fullName: string } | null;
    };
    researchCase?: {
      id: number;
      caseType?: string | null;
      topicTitle?: string | null;
      status?: string | null;
      currentMilestone?: MilestoneDefinition | null;
    } | null;
    requiredEvidence: number;
    approvedEvidence: number;
    openRevisionCount: number;
    openTaskCount: number;
    readiness: "READY" | "NEEDS_REVISION" | "MISSING_EVIDENCE";
  }>;
};

export type SchedulingTransactionModel = {
  summary: {
    requests: number;
    confirmed: number;
    delayed: number;
    matchFound: number;
  };
  scheduleCases: Array<ScheduleRequestItem & {
    ageDays: number;
    rescheduleCount: number;
    participantAvailabilityCount: number;
    bestAvailabilityDate?: string | null;
    bestAvailabilityCount: number;
    schedulingSignal: "CONFIRMED" | "DELAYED" | "MATCH_FOUND" | "COLLECT_AVAILABILITY";
  }>;
};

export type CompletionTransactionModel = {
  summary: {
    candidates: number;
    eligible: number;
    pendingRequirements: number;
  };
  graduationCandidates: Array<{
    student: TransactionStudentRef;
    courseworkMissing?: number | null;
    pendingMilestones: number;
    missingDocuments: number;
    openAlerts: number;
    eligibilityResult: "ELIGIBLE_FOR_GS_ENDORSEMENT" | "PENDING_REQUIREMENTS";
    missingRequirements: string[];
  }>;
};

export type FollowUpTransactionModel = {
  summary: {
    openAlerts: number;
    overdueTasks: number;
    alertsWithoutIntervention: number;
  };
  interventionQueue: Array<AlertItem & {
    ageDays: number;
    latestIntervention?: AlertItem["interventions"][number] | null;
  }>;
  overdueTasks: TaskItem[];
};

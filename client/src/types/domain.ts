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
  assignedRole?: RoleName | null;
  assignedToId?: number | null;
  nextActionOwnerRole?: RoleName | null;
  status: TaskStatus;
  dueAt?: string | null;
  priorityScore: number;
  recommendedAction?: string | null;
  escalationPrompt?: string | null;
  student?: StudentListItem;
  assignedTo?: { id: number; fullName: string } | null;
};

export type StudentDetail = StudentListItem & {
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
    createdAt: string;
    author?: { id: number; fullName: string } | null;
  }>;
};

export type ScheduleRequestItem = {
  id: number;
  studentId: number;
  status: ScheduleStatus;
  preferredDate?: string | null;
  reason?: string | null;
  createdAt: string;
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

import { api } from "./client";
import type {
  AlertItem,
  AlertThreshold,
  AnalyticsDashboard,
  AuditLogItem,
  DashboardSummary,
  DocumentRecord,
  LoginResponse,
  MilestoneDefinition,
  Paginated,
  PrescriptiveAnalyticsResponse,
  RoutingRule,
  ScheduleRequestItem,
  StudentDetail,
  StudentListItem,
  TaskDecision,
  TaskItem,
  UserAccount,
} from "../types/domain";

type QueryParams = Record<string, string | number | boolean | undefined>;

export const authApi = {
  login: (payload: { email: string; password: string }) =>
    api.post<LoginResponse>("/api/auth/login", payload).then((res) => res.data),
  me: () => api.get("/api/auth/me").then((res) => res.data),
  logout: () => api.post("/api/auth/logout-me").then((res) => res.data),
};

export const homeApi = {
  dashboard: () => api.get<DashboardSummary>("/api/home/dashboard").then((res) => res.data),
};

export const usersApi = {
  list: (params?: QueryParams) =>
    api.get<Paginated<UserAccount>>("/api/users", { params }).then((res) => res.data),
  create: (payload: { fullName: string; email: string; password: string; roles: string[] }) =>
    api.post<UserAccount>("/api/users", payload).then((res) => res.data),
  update: (id: number, payload: Partial<UserAccount> & { password?: string; roles?: string[] }) =>
    api.patch<UserAccount>(`/api/users/${id}`, payload).then((res) => res.data),
  roles: () => api.get<string[]>("/api/users/roles").then((res) => res.data),
};

export const studentsApi = {
  list: (params?: QueryParams) =>
    api.get<Paginated<StudentListItem>>("/api/students", { params }).then((res) => res.data),
  me: () => api.get<StudentDetail>("/api/students/me").then((res) => res.data),
  detail: (id: number) => api.get<StudentDetail>(`/api/students/${id}`).then((res) => res.data),
  updateStage: (id: number, payload: { stage: string; notes?: string; riskFlag?: boolean }) =>
    api.patch(`/api/students/${id}/stage`, payload).then((res) => res.data),
  updateMilestone: (
    studentId: number,
    milestoneId: number,
    payload: { status: string; dueAt?: string | null; completedAt?: string | null; notes?: string | null }
  ) => api.patch(`/api/students/${studentId}/milestones/${milestoneId}`, payload).then((res) => res.data),
};

export const milestonesApi = {
  list: (params?: QueryParams) =>
    api.get<MilestoneDefinition[]>("/api/milestones", { params }).then((res) => res.data),
  create: (payload: Partial<MilestoneDefinition>) =>
    api.post<MilestoneDefinition>("/api/milestones", payload).then((res) => res.data),
  update: (id: number, payload: Partial<MilestoneDefinition>) =>
    api.patch<MilestoneDefinition>(`/api/milestones/${id}`, payload).then((res) => res.data),
};

export const tasksApi = {
  myQueue: (params?: QueryParams) =>
    api.get<Paginated<TaskItem>>("/api/tasks/my", { params }).then((res) => res.data),
  teamQueue: (params?: QueryParams) =>
    api.get<Paginated<TaskItem>>("/api/tasks/team", { params }).then((res) => res.data),
  create: (payload: Record<string, unknown>) => api.post<TaskItem>("/api/tasks", payload).then((res) => res.data),
  decide: (taskId: number, payload: { decision: TaskDecision; rationale?: string }) =>
    api.post<TaskItem>(`/api/tasks/${taskId}/decision`, payload).then((res) => res.data),
};

export const documentsApi = {
  byStudent: (studentId: number) =>
    api.get<DocumentRecord[]>(`/api/students/${studentId}/documents`).then((res) => res.data),
  my: () => api.get<DocumentRecord[]>("/api/documents/my").then((res) => res.data),
  createRecord: (studentId: number, payload: { checklistItem: string; milestoneDefinitionId?: number }) =>
    api.post<DocumentRecord>(`/api/students/${studentId}/documents`, payload).then((res) => res.data),
  uploadVersion: (documentId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post(`/api/documents/${documentId}/versions`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  downloadVersion: (versionId: number) =>
    api.get(`/api/documents/versions/${versionId}/download`, { responseType: "blob" }).then((res) => res.data),
  addComment: (documentId: number, payload: { note: string; versionId?: number }) =>
    api.post(`/api/documents/${documentId}/comments`, payload).then((res) => res.data),
  resolveComment: (commentId: number, resolved: boolean) =>
    api.patch(`/api/comments/${commentId}/resolve`, { resolved }).then((res) => res.data),
};

export const schedulingApi = {
  list: (params?: QueryParams) =>
    api.get<Paginated<ScheduleRequestItem>>("/api/scheduling/requests", { params }).then((res) => res.data),
  createRequest: (payload: { studentId: number; preferredDate?: string; reason?: string }) =>
    api.post("/api/scheduling/requests", payload).then((res) => res.data),
  createAvailability: (payload: {
    scheduleRequestId: number;
    availableFrom: string;
    availableTo: string;
    notes?: string;
  }) => api.post("/api/scheduling/availability", payload).then((res) => res.data),
  createEvent: (payload: {
    scheduleRequestId: number;
    eventStatus: string;
    scheduledAt?: string | null;
    notes?: string;
  }) => api.post("/api/scheduling/events", payload).then((res) => res.data),
};

export const alertsApi = {
  list: (params?: QueryParams) =>
    api.get<Paginated<AlertItem>>("/api/alerts", { params }).then((res) => res.data),
  runMonitoring: () => api.post("/api/alerts/run-monitoring").then((res) => res.data),
  updateStatus: (id: number, status: string) =>
    api.patch(`/api/alerts/${id}/status`, { status }).then((res) => res.data),
  addIntervention: (id: number, payload: { actionTaken: string; evidenceNote?: string }) =>
    api.post(`/api/alerts/${id}/interventions`, payload).then((res) => res.data),
  closeIntervention: (id: number, closureEvidence: string) =>
    api.patch(`/api/alerts/interventions/${id}/close`, { closureEvidence }).then((res) => res.data),
};

export const analyticsApi = {
  descriptive: () => api.get<AnalyticsDashboard>("/api/analytics/descriptive").then((res) => res.data),
  dashboard: () => api.get<AnalyticsDashboard>("/api/analytics/descriptive").then((res) => res.data),
  prescriptive: (payload?: Record<string, unknown>) =>
    api.post<PrescriptiveAnalyticsResponse>("/api/analytics/prescriptive", payload ?? {}).then((res) => res.data),
  reportViewUrl: () => `${api.defaults.baseURL}/api/analytics/report-view`,
  reportCsvUrl: () => `${api.defaults.baseURL}/api/analytics/report.csv`,
};

export const auditApi = {
  list: (params?: QueryParams) =>
    api.get<Paginated<AuditLogItem>>("/api/audit", { params }).then((res) => res.data),
};

export const adminApi = {
  thresholds: () => api.get<AlertThreshold[]>("/api/admin/thresholds").then((res) => res.data),
  createThreshold: (payload: Record<string, unknown>) =>
    api.post<AlertThreshold>("/api/admin/thresholds", payload).then((res) => res.data),
  updateThreshold: (id: number, payload: Record<string, unknown>) =>
    api.patch<AlertThreshold>(`/api/admin/thresholds/${id}`, payload).then((res) => res.data),
  routingRules: () => api.get<RoutingRule[]>("/api/admin/routing-rules").then((res) => res.data),
  createRoutingRule: (payload: Record<string, unknown>) =>
    api.post<RoutingRule>("/api/admin/routing-rules", payload).then((res) => res.data),
  updateRoutingRule: (id: number, payload: Record<string, unknown>) =>
    api.patch<RoutingRule>(`/api/admin/routing-rules/${id}`, payload).then((res) => res.data),
};

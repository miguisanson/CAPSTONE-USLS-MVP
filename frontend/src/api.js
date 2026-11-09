// Thin fetch wrapper around the Flask JSON API.
const BASE = "/api";

const NOT_REACHABLE = "The site is not reachable right now. Check your connection and try again.";
// Sign-in calls answer 401 on purpose (nobody is signed in yet); a 401 anywhere else means the session ended (I-211).
const SIGN_IN_PATHS = ["/auth/login", "/auth/logout", "/auth/me", "/auth/config", "/auth/demo-accounts", "/auth/demo-students"];
let signingOut = false;

// The Demo Guide listens to this event: after each write it re-reads the case, and a refused write shows its reason.
function announce(method, path, status, message = "") {
  if (method === "GET" || typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("demo-guide:api", { detail: { method, path, status, message } }));
}

// fetch for the upload and download calls that do not go through request(): same announcement for the Demo Guide, so a refused
// upload shows its reason there. The caller still gets the untouched response.
async function announced(url, options = {}) {
  const method = String(options.method || "GET").toUpperCase();
  const path = String(url).slice(BASE.length);
  let res;
  try {
    res = await fetch(url, options);
  } catch (error) {
    announce(method, path, 0, NOT_REACHABLE);
    throw error;
  }
  let message = "";
  if (!res.ok && method !== "GET") message = await res.clone().json().then((body) => (body && body.error) || "", () => "");
  announce(method, path, res.status, message || (res.ok ? "" : `Request failed (${res.status})`));
  return res;
}

async function request(path, options = {}) {
  if (path === "/auth/logout") signingOut = true; // a poll still in flight must not look like an expired session
  if (path === "/auth/login") signingOut = false;
  const method = String(options.method || "GET").toUpperCase();
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      ...options,
    });
  } catch {
    announce(method, path, 0, NOT_REACHABLE);
    throw new Error(NOT_REACHABLE);
  }
  if (!res.ok) {
    if (res.status === 401 && !signingOut && !SIGN_IN_PATHS.some((p) => path.startsWith(p)) && window.location.pathname !== "/login") {
      window.location.assign("/login?expired=1"); // a fresh load clears the signed-in user
    }
    if ([502, 503, 504].includes(res.status)) throw new Error(NOT_REACHABLE);
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body && body.error) message = body.error;
    } catch (e) {
      /* ignore parse errors */
    }
    announce(method, path, res.status, message);
    throw new Error(message);
  }
  announce(method, path, res.status);
  return res.json();
}

function queryString(params = {}) {
  return new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== "" && v != null)
  ).toString();
}

export const api = {
  // Edit anything, with history: one pair of calls for every editable text (components/ui/EditableText.jsx).
  editRecord: (entity, id, body) => request(`/edits/${encodeURIComponent(entity)}/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  editHistory: (entity, id) => request(`/edits/${encodeURIComponent(entity)}/${id}`),
  saveCourseOfferings: (body) => request("/course-offerings/bulk", { method: "PATCH", body: JSON.stringify(body) }),
  teachingAvailability: (params = {}) => request(`/faculty-portal/teaching-schedule?${queryString(params)}`),
  saveTeachingAvailability: (termId, body) => request(`/faculty-portal/teaching-schedule?${queryString({ term_id: termId })}`, { method: "PUT", body: JSON.stringify(body) }),
  teachingSchedules: (params = {}) => request(`/teaching-schedules?${queryString(params)}`),
  createTeachingSchedule: (body) => request("/teaching-schedules", { method: "POST", body: JSON.stringify(body) }),
  updateTeachingSchedule: (id, body) => request(`/teaching-schedules/${id}`, { method: "POST", body: JSON.stringify(body) }),
  studentClassSchedule: (params = {}) => request(`/student-portal/class-schedule?${queryString(params)}`),
  me: () => request("/auth/me"),
  login: (payload) => request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => request("/auth/logout", { method: "POST", body: JSON.stringify({}) }),
  changePassword: (payload) => request("/auth/change-password", { method: "POST", body: JSON.stringify(payload) }),
  acceptPrivacyNotice: () => request("/auth/privacy-consent", { method: "POST", body: JSON.stringify({ accept: true }) }),
  authConfig: () => request("/auth/config"),
  demoAccounts: () => request("/auth/demo-accounts"),
  setDemoSettings: (payload) => request("/auth/demo-settings", { method: "POST", body: JSON.stringify(payload) }),
  demoStudents: () => request("/auth/demo-students"),
  // The Demo Guide starts every run from a fresh private copy of the data. An old server has no such route (404): callers ignore that.
  resetDemoSandbox: (scope = {}) => request("/demo/sandbox/reset", { method: "POST", body: JSON.stringify(scope) }),
  demoGuideState: (params = {}) => request(`/demo/guide-state?${queryString(params)}`),
  resetDemoStudent: (demoKey) =>
    request(`/auth/demo-students/${encodeURIComponent(demoKey)}/reset`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  meta: () => request("/meta"),
  adminTerms: () => request("/admin/terms"),
  createTerm: (payload) => request("/admin/terms", { method: "POST", body: JSON.stringify(payload) }),
  updateTerm: (id, payload) => request(`/admin/terms/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  setActiveTerm: (id) => request(`/admin/terms/${id}/set-active`, { method: "PATCH", body: JSON.stringify({}) }),
  deleteTerm: (id, payload) => request(`/admin/terms/${id}`, { method: "DELETE", body: JSON.stringify(payload) }),
  addNextTerm: () => request("/admin/terms/add-next", { method: "POST", body: JSON.stringify({}) }),
  dashboard: (params = {}) => {
    const qs = queryString(params);
    return request(`/dashboard${qs ? `?${qs}` : ""}`);
  },
  students: (params = {}) => {
    const qs = queryString(params);
    return request(`/students${qs ? `?${qs}` : ""}`);
  },
  faculty: () => request("/faculty"),
  createFaculty: (payload) => request("/faculty", { method: "POST", body: JSON.stringify(payload) }),
  updateFaculty: (id, payload) => request(`/faculty/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  facultyProfile: (facultyId) => request(`/faculty/${facultyId}`),
  facultyExpertise: (facultyId) => request(`/faculty/${facultyId}/expertise`),
  addFacultyExpertise: (facultyId, payload) =>
    request(`/faculty/${facultyId}/expertise`, { method: "POST", body: JSON.stringify(payload) }),
  updateFacultyExpertise: (recordId, payload) =>
    request(`/faculty-expertise/${recordId}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteFacultyExpertise: (recordId) =>
    request(`/faculty-expertise/${recordId}`, { method: "DELETE", body: JSON.stringify({}) }),
  saveFacultyPreferences: (facultyId, courseIds) =>
    request(`/faculty/${facultyId}/preferences`, {
      method: "PUT",
      body: JSON.stringify({ course_ids: courseIds }),
    }),
  student: (id) => request(`/students/${id}`),
  recordComprehensiveExam: (id, payload) => request(`/students/${id}/comprehensive-exam`, { method: "POST", body: JSON.stringify(payload) }),
  duplicateStudents: () => request("/students/duplicates"),
  mergeStudents: (payload) =>
    request("/students/merge", { method: "POST", body: JSON.stringify(payload) }),
  tasks: (params = {}) => {
    const actual = typeof params === "string" ? { owner: params } : params;
    const qs = queryString(actual);
    return request(`/tasks${qs ? `?${qs}` : ""}`);
  },
  activity: () => request("/activity"),
  // The five Reports (IM20): rows for the screen, and the address of the Excel / PDF download of the same filtered rows.
  report: (id, params = {}) => {
    const qs = queryString(params);
    return request(`/reports/${id}${qs ? `?${qs}` : ""}`);
  },
  reportDownloadUrl: (id, params = {}, format = "xlsx") => `${BASE}/reports/${id}?${queryString({ ...params, format })}`,
  // Reports v2 (I-141): `name` is the path after /reports/ (summary, summary/<key>, attention, stages, records-to-fix,
  // decisions, cycle-times); the download address carries the same filters plus `format`.
  reportV2: (name, params = {}) => request(`/reports/${name}?${queryString(params)}`),
  reportV2Url: (name, params = {}, format = "xlsx") => `${BASE}/reports/${name}?${queryString({ ...params, format })}`,
  // BPMN 1 Admission — Dean onboarding gate
  onboardingReviews: () => request("/onboarding/reviews"),
  submitOnboardingReview: (id) =>
    request(`/onboarding/reviews/${id}/submit`, { method: "POST", body: JSON.stringify({}) }),
  decideOnboardingReview: (id, payload) =>
    request(`/onboarding/reviews/${id}/decision`, { method: "POST", body: JSON.stringify(payload) }),

  // BPMN 2 Enrollment — curriculum version tagging and the derived study plan
  curriculumTag: (studentId) => request(`/enrollment/curriculum-tag/${studentId}`),
  setCurriculumTag: (studentId, payload) =>
    request(`/enrollment/curriculum-tag/${studentId}`, { method: "POST", body: JSON.stringify(payload) }),
  studyPlans: () => request("/enrollment/study-plans"),
  generateStudyPlan: (payload) =>
    request("/enrollment/study-plans", { method: "POST", body: JSON.stringify(payload) }),
  sendStudyPlan: (id) =>
    request(`/enrollment/study-plans/${id}/send`, { method: "POST", body: JSON.stringify({}) }),
  reviewStudyPlan: (id, payload) =>
    request(`/enrollment/study-plans/${id}/review`, { method: "POST", body: JSON.stringify(payload) }),

  // BPMN 4 Coursework — status report to the Dean
  courseworkReports: () => request("/coursework/reports"),
  generateCourseworkReport: (payload = {}) =>
    request("/coursework/reports", { method: "POST", body: JSON.stringify(payload) }),
  sendCourseworkReport: (id) =>
    request(`/coursework/reports/${id}/send`, { method: "POST", body: JSON.stringify({}) }),
  decideCourseworkReport: (id, payload) =>
    request(`/coursework/reports/${id}/decision`, { method: "POST", body: JSON.stringify(payload) }),

  dailyChanges: (date = "") => {
    const qs = queryString({ date });
    return request(`/reports/daily-changes${qs ? `?${qs}` : ""}`);
  },
  markChangeReflected: (logId, reflected) =>
    request(`/reports/daily-changes/${logId}/reflected`, {
      method: "PATCH",
      body: JSON.stringify({ reflected }),
    }),
  // Staff or the Dean record by hand that the Registrar acknowledged an exported list (owner 2026-11-08).
  graduationRegistrarAcknowledged: (endorsementIds) =>
    request("/graduation/registrar-acknowledged", { method: "POST", body: JSON.stringify({ endorsement_ids: endorsementIds }) }),
  exportGraduationCsv: async (reviewWindow = "", endorsementIds = []) => {
    const res = await announced(`${BASE}/graduation/endorsed.csv`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ review_window: reviewWindow, endorsement_ids: endorsementIds }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Export failed (${res.status})`);
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const filename = disposition.match(/filename="?([^";]+)"?/)?.[1] || "graduate-school-endorsed-list.csv";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return { count: Number(res.headers.get("X-Exported-Count") || 0), filename, registrarEmail: res.headers.get("X-Registrar-Email") || "" };
  },
  exportWithdrawalXlsx: async (applicationIds = []) => {
    const res = await announced(`${BASE}/withdrawal/approved.xlsx`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ application_ids: applicationIds }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Export failed (${res.status})`);
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const filename = disposition.match(/filename="?([^";]+)"?/)?.[1] || "approved-subject-withdrawals.xlsx";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return { count: Number(res.headers.get("X-Exported-Count") || 0), filename, registrarEmail: res.headers.get("X-Registrar-Email") || "" };
  },
  // Staff record when an exported withdrawal list was sent to the Registrar and when the Registrar acknowledged it ("sent" | "acknowledged").
  // The case does not move; only the dates are saved.
  recordWithdrawalRegistrarFollowup: (applicationId, step, note = "") =>
    request(`/withdrawal/${applicationId}/registrar-followup`, { method: "POST", body: JSON.stringify({ step, note }) }),
  transactionContext: (slug, params = {}) => {
    const qs = queryString(params);
    return request(`/transactions/${slug}/context${qs ? `?${qs}` : ""}`);
  },
  submitTransaction: (slug, payload) =>
    request(`/transactions/${slug}`, { method: "POST", body: JSON.stringify(payload) }),
  sendWorkflowMessage: (slug, payload) =>
    request(`/transactions/${slug}/messages`, { method: "POST", body: JSON.stringify(payload) }),
  markWorkflowMessagesRead: (messageIds) =>
    request("/student-portal/messages/read", {
      method: "POST",
      body: JSON.stringify({ message_ids: messageIds }),
    }),
  graduationBatchAction: (payload) =>
    request("/graduation/batch-actions", { method: "POST", body: JSON.stringify(payload) }),
  resetWorkflowDemo: (slug, studentId) =>
    request(`/transactions/${slug}/demo-reset`, {
      method: "POST",
      body: JSON.stringify({ student_id: studentId }),
    }),
  importHandoff: async (file) => {
    const form = new FormData();
    form.append("file", file);
    // No Content-Type header: the browser sets the multipart boundary itself.
    const res = await announced(`${BASE}/transactions/student-handoff/import`, { method: "POST", body: form, credentials: "same-origin" });
    let body = null;
    try {
      body = await res.json();
    } catch (e) {
      /* ignore */
    }
    if (!res.ok) throw new Error((body && body.error) || `Upload failed (${res.status})`);
    return body;
  },
  monitoringGrid: (params = {}) => {
    const actual = typeof params === "string" || typeof params === "number" ? { program_id: params } : params;
    const qs = queryString(actual);
    return request(`/monitoring/grid${qs ? `?${qs}` : ""}`);
  },
  monitoringClassList: (params = {}) => {
    const qs = queryString(params);
    return request(`/monitoring/class-list${qs ? `?${qs}` : ""}`);
  },
  // Monitoring Sheet portal entry (staff / coordinators write; others read).
  monitoringStudent: (id) => request(`/monitoring/students/${id}`),
  createMonitoringStudent: (payload) =>
    request("/monitoring/students", { method: "POST", body: JSON.stringify(payload) }),
  updateMonitoringStudent: (id, payload) =>
    request(`/monitoring/students/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  monitoringHistory: (id) => request(`/monitoring/students/${id}/history`),
  addMonitoringSubject: (id, payload) =>
    request(`/monitoring/students/${id}/subjects`, { method: "POST", body: JSON.stringify(payload) }),
  updateMonitoringSubject: (id, recordId, payload) =>
    request(`/monitoring/students/${id}/subjects/${recordId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  removeMonitoringSubject: (id, recordId, payload) =>
    request(`/monitoring/students/${id}/subjects/${recordId}`, { method: "DELETE", body: JSON.stringify(payload) }),
  bulkAddMonitoringSubjects: (payload) =>
    request("/monitoring/subjects/bulk-add-remaining", { method: "POST", body: JSON.stringify(payload) }),
  monitoringExportUrl: (programId) => `${BASE}/monitoring/export${programId ? `?program_id=${programId}` : ""}`,
  monitoringUploads: () => request("/monitoring/uploads"),
  resolveMonitoringIssue: (issueId, payload) =>
    request(`/monitoring/issues/${issueId}/resolve`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  resolveMonitoringIssuesWithFile: async (issueIds, file) => {
    const form = new FormData();
    form.append("issue_ids", JSON.stringify(issueIds));
    form.append("file", file);
    const res = await announced(`${BASE}/monitoring/issues/resolve-upload`, {
      method: "POST",
      body: form,
      credentials: "same-origin",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Corrected workbook upload failed (${res.status})`);
    return body;
  },
  enrollment: (params = {}) => {
    const qs = queryString(params);
    return request(`/enrollment${qs ? `?${qs}` : ""}`);
  },
  previewEnrollment: (payload) =>
    request("/enrollment/preview", { method: "POST", body: JSON.stringify(payload) }),
  courseOfferings: (params = {}) => {
    const qs = queryString(params);
    return request(`/course-offerings${qs ? `?${qs}` : ""}`);
  },
  addCourseOffering: (payload) =>
    request("/course-offerings", { method: "POST", body: JSON.stringify(payload) }),
  updateCourseOffering: (id, payload) =>
    request(`/course-offerings/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteCourseOffering: (id) =>
    request(`/course-offerings/${id}`, { method: "DELETE" }),
  saveEnrollment: (payload) =>
    request("/enrollment", { method: "POST", body: JSON.stringify(payload) }),
  updateEnrollmentSubjectStatus: (payload) =>
    request("/enrollment/subject-status", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  previewClassList: async (file, termId) => {
    const form = new FormData();
    form.append("file", file);
    if (termId) form.append("term_id", termId);
    const res = await announced(`${BASE}/enrollment/class-list-preview`, { method: "POST", body: form, credentials: "same-origin" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Class list preview failed (${res.status})`);
    return body;
  },
  importClassList: async (file, termId) => {
    const form = new FormData();
    form.append("file", file);
    if (termId) form.append("term_id", termId);
    const res = await announced(`${BASE}/enrollment/class-list-import`, { method: "POST", body: form, credentials: "same-origin" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Class list import failed (${res.status})`);
    return body;
  },
  courseAdjustments: (params = {}) => {
    const actual = typeof params === "string" || typeof params === "number" ? { program_id: params } : params;
    const qs = queryString(actual);
    return request(`/course-adjustments${qs ? `?${qs}` : ""}`);
  },
  subjectNeedsReport: (params = {}) => {
    const qs = queryString(params);
    return request(`/course-adjustments/subject-needs-report${qs ? `?${qs}` : ""}`);
  },
  approvals: () => request("/approvals"),
  decideApproval: (planId, payload) =>
    request(`/approvals/${planId}/decide`, { method: "POST", body: JSON.stringify(payload) }),
  decideWorkflowApproval: (type, id, payload) =>
    request(`/approvals/workflow/${type}/${id}/decide`, { method: "POST", body: JSON.stringify(payload) }),
  saveCourseAdjustmentPlan: (payload) =>
    request("/course-adjustments/plan", { method: "POST", body: JSON.stringify(payload) }),
  facultyCvRag: (facultyId, question) =>
    request(`/faculty/${facultyId}/cv-rag`, { method: "POST", body: JSON.stringify({ question }) }),
  courseAuditMissing: (programId = "") => request(`/course-audit/missing${programId ? `?program_id=${programId}` : ""}`),
  courseAuditSubjects: () => request("/course-audit/subjects"),
  courseAuditRoster: (courseId, term = "") =>
    request(`/course-audit/roster?course_id=${courseId}${term ? `&term=${encodeURIComponent(term)}` : ""}`),
  flagMonitoringIssue: (studentId, payload = {}) =>
    request(`/students/${studentId}/flag-issue`, { method: "POST", body: JSON.stringify(payload) }),
  monitoringConflicts: (params = {}) => {
    const qs = queryString(params);
    return request(`/monitoring/conflicts${qs ? `?${qs}` : ""}`);
  },
  resolveMonitoringFlag: (studentId, flagId, payload = {}) =>
    request(`/students/${studentId}/flags/${flagId}/resolve`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  decisionSupport: () => request("/decision-support"),
  assistant: (question, studentId) =>
    request("/assistant", { method: "POST", body: JSON.stringify({ question, student_id: studentId || null }) }),
  assistantSuggestions: () => request("/assistant/suggestions"),
  policyDocuments: () => request("/policy-documents"),
  createPolicyDocument: async ({ file, ...fields }) => {
    const form = new FormData();
    form.append("file", file);
    Object.entries(fields).forEach(([key, value]) => form.append(key, value ?? ""));
    const res = await announced(`${BASE}/policy-documents`, { method: "POST", body: form, credentials: "same-origin" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Upload failed (${res.status})`);
    return body;
  },
  updatePolicyDocument: (id, payload) =>
    request(`/policy-documents/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  replacePolicyDocument: async (id, file, fields = {}) => {
    const form = new FormData();
    form.append("file", file);
    Object.entries(fields).forEach(([key, value]) => form.append(key, value ?? ""));
    const res = await announced(`${BASE}/policy-documents/${id}/file`, { method: "PUT", body: form, credentials: "same-origin" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Replacement failed (${res.status})`);
    return body;
  },
  testPolicyQuestion: (question) =>
    request("/policy-documents/test-question", { method: "POST", body: JSON.stringify({ question }) }),
  deletePolicyDocument: (id) => request(`/policy-documents/${id}`, { method: "DELETE" }),
  businessRules: (params = {}) => {
    const qs = queryString(params);
    return request(`/business-rules${qs ? `?${qs}` : ""}`);
  },
  updateBusinessRule: (id, payload) =>
    request(`/business-rules/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  awolPolicyReview: (payload) =>
    request("/awol/policy-review", { method: "POST", body: JSON.stringify(payload) }),
  studentPortalContext: () => request("/student-portal/context"),
  // What the system read from an uploaded practicum certificate: { hours: number | null, message }.
  practicumCertificateHours: (attachmentId) => request(`/student-portal/practicum/certificate-hours/${attachmentId}`),
  // The server always enrolls into the current semester, so no term is sent.
  saveStudentEnrollment: (courseIds) =>
    request("/student-portal/enrollment", {
      method: "POST",
      body: JSON.stringify({ course_ids: courseIds }),
    }),
  studentAssistant: (question) =>
    request("/student-portal/assistant", { method: "POST", body: JSON.stringify({ question }) }),
  studentAssistantSuggestions: () => request("/student-portal/assistant/suggestions"),
  facultyPortalContext: () => request("/faculty-portal/context"),
  googleCalendarAuthorization: () => request("/faculty-portal/google-calendar/authorization"),
  syncGoogleCalendar: () =>
    request("/faculty-portal/google-calendar/sync", { method: "POST", body: JSON.stringify({}) }),
  disconnectGoogleCalendar: () => request("/faculty-portal/google-calendar", { method: "DELETE" }),
  signAdviserPaper: (evidenceId, payload) =>
    request(`/faculty-portal/adviser-approvals/${evidenceId}`, { method: "POST", body: JSON.stringify(payload) }),
  submitDefenseVerdict: (scheduleId, payload) =>
    request(`/faculty-portal/defense-verdicts/${scheduleId}`, { method: "POST", body: JSON.stringify(payload) }),
  correctDefenseVerdict: (verdictId, payload) =>
    request(`/faculty-portal/defense-verdicts/${verdictId}/correction`, { method: "POST", body: JSON.stringify(payload) }),
  confirmDefenseRevisions: (verdictId, payload = {}) =>
    request(`/faculty-portal/defense-verdicts/${verdictId}/confirm-revisions`, { method: "POST", body: JSON.stringify(payload) }),
  // I-361: Graduate School staff and the Research Coordinator act for the panel chair.
  recordVerdictForPanel: (scheduleId, payload) =>
    request(`/research-gate/${scheduleId}/verdict`, { method: "POST", body: JSON.stringify(payload) }),
  correctVerdictForPanel: (verdictId, payload) =>
    request(`/research-gate/verdicts/${verdictId}/correction`, { method: "POST", body: JSON.stringify(payload) }),
  confirmRevisionsForPanel: (verdictId, payload) =>
    request(`/research-gate/verdicts/${verdictId}/confirm-revisions`, { method: "POST", body: JSON.stringify(payload) }),
  submitDefenseRevisions: async (verdictId, { note, file } = {}) => {
    const form = new FormData();
    if (note) form.append("note", note);
    if (file) form.append("file", file);
    const res = await announced(`${BASE}/student-portal/defense-verdicts/${verdictId}/revisions`, {
      method: "POST",
      body: form,
      credentials: "same-origin",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
    return body;
  },
  rescheduleDefense: (scheduleId, payload) =>
    request(`/defense-schedules/${scheduleId}/reschedule`, { method: "POST", body: JSON.stringify(payload) }),
  cancelDefense: (scheduleId, payload) =>
    request(`/defense-schedules/${scheduleId}/cancel`, { method: "POST", body: JSON.stringify(payload) }),
  reconfirmDefense: (scheduleId) =>
    request(`/defense-schedules/${scheduleId}/reconfirm`, { method: "POST", body: JSON.stringify({}) }),
  submitStudentRequest: (type, payload) =>
    request(`/student-portal/requests/${type}`, { method: "POST", body: JSON.stringify(payload) }),
  // Leave of Absence / Readmission cases. `slug` is "leave-of-absence" or "readmission".
  studentLeaveCaseAction: (caseId, action, payload = {}) =>
    request(`/student-portal/leave-cases/${caseId}/${action}`, { method: "POST", body: JSON.stringify(payload) }),
  // The standalone process board: the same four calls for Leave of Absence, Readmission,
  // AWOL & Residency and Withdrawal. Every drag, menu choice and button ends in
  // processCaseTransition.
  processCases: (slug) => request(`/process-cases?slug=${encodeURIComponent(slug)}`),
  processCase: (slug, ref) => request(`/process-cases/${encodeURIComponent(slug)}/${encodeURIComponent(ref)}`),
  processCaseTransition: (slug, ref, payload) =>
    request(`/process-cases/${encodeURIComponent(slug)}/${encodeURIComponent(ref)}/transition`, { method: "POST", body: JSON.stringify(payload) }),
  processCasesBatch: (slug, payload) =>
    request(`/process-cases/${encodeURIComponent(slug)}/batch`, { method: "POST", body: JSON.stringify(payload) }),
  leaveCase: (id) => request(`/leave-cases/${id}`),
  // Every button and every drag and drop on the staff board ends here.
  leaveCaseTransition: (id, payload) =>
    request(`/leave-cases/${id}/transition`, { method: "POST", body: JSON.stringify(payload) }),
  syncLeaveCases: () => request("/leave-cases/sync", { method: "POST", body: JSON.stringify({}) }),
  leaveExportLog: (slug) => request(`/leave-cases/export-log?slug=${encodeURIComponent(slug)}`),
  leaveHandoff: (caseIds, status) =>
    request("/leave-cases/handoff", { method: "POST", body: JSON.stringify({ case_ids: caseIds, status }) }),
  awolRegistrarHandoff: (recordId, target) =>
    request(`/awol/${recordId}/registrar-handoff`, { method: "POST", body: JSON.stringify({ target }) }),
  awolRegistrarReport: async (recordId) => {
    const res = await announced(`${BASE}/awol/${recordId}/registrar-report`, { credentials: "same-origin" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Download failed (${res.status})`);
    }
    const blob = await res.blob();
    const filename = (res.headers.get("Content-Disposition") || "").match(/filename="?([^";]+)"?/)?.[1] || `awol-registrar-${recordId}.csv`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return { filename };
  },
  exportLeaveRegistrarList: async (slug, format = "csv", caseIds = []) => {
    const res = await announced(`${BASE}/leave-cases/registrar-export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ slug, format, case_ids: caseIds }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Export failed (${res.status})`);
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const filename = disposition.match(/filename="?([^";]+)"?/)?.[1] || `registrar-list.${format}`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return { count: Number(res.headers.get("X-Exported-Count") || 0), filename, registrarEmail: res.headers.get("X-Registrar-Email") || "" };
  },
  uploadResearchEvidence: async (gate, itemName, file, similarityPercent, paperTitle) => {
    const form = new FormData();
    form.append("gate", gate);
    form.append("item_name", itemName);
    form.append("file", file);
    if (similarityPercent !== undefined) form.append("similarity_percent", similarityPercent);
    if (paperTitle !== undefined) form.append("paper_title", paperTitle);
    const res = await announced(`${BASE}/student-portal/research-evidence/upload`, {
      method: "POST",
      body: form,
      credentials: "same-origin",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Upload failed (${res.status})`);
    return body;
  },
  deleteResearchEvidence: (evidenceId) =>
    request(`/student-portal/research-evidence/${evidenceId}`, { method: "DELETE" }),
  evaluateConceptPaper: (evidenceId) =>
    request(`/research-evidence/${evidenceId}/concept-paper-compliance`, { method: "POST", body: JSON.stringify({}) }),
  form1Endorsements: () => request("/research-gate/form1-endorsements"),
  researchGateOverview: () => request("/research-gate/overview"),
  endorseForm1: (studentId, payload) =>
    request(`/research-gate/form1-endorsements/${studentId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  uploadStudentRequestAttachment: async (requestType, file) => {
    const form = new FormData();
    form.append("request_type", requestType);
    form.append("file", file);
    const res = await announced(`${BASE}/student-portal/request-attachments/upload`, {
      method: "POST",
      body: form,
      credentials: "same-origin",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Upload failed (${res.status})`);
    return body;
  },
  // ---- calendar, availability, adviser appointment, invitations, notifications, private feed ----
  calendar: (params = {}) => {
    const qs = queryString(params);
    return request(`/calendar${qs ? `?${qs}` : ""}`);
  },
  studentResearchCalendar: () => request("/student-portal/research-calendar"),
  facultyAvailability: () => request("/faculty-portal/availability"),
  saveFacultyWorkingHours: (hours) =>
    request("/faculty-portal/availability/working-hours", { method: "PUT", body: JSON.stringify({ hours }) }),
  addAvailabilityException: (payload) =>
    request("/faculty-portal/availability/exceptions", { method: "POST", body: JSON.stringify(payload) }),
  deleteAvailabilityException: (id) =>
    request(`/faculty-portal/availability/exceptions/${id}`, { method: "DELETE" }),
  answerAvailabilityRequest: (id) =>
    request(`/faculty-portal/availability/requests/${id}/answer`, { method: "POST", body: JSON.stringify({}) }),
  requestPanelAvailability: (payload) =>
    request("/availability-requests", { method: "POST", body: JSON.stringify(payload) }),
  checkDefenseSlot: (payload) =>
    request("/defense-schedules/check", { method: "POST", body: JSON.stringify(payload) }),
  studentAdviser: () => request("/student-portal/adviser"),
  applyForAdviser: (payload) =>
    request("/student-portal/adviser/apply", { method: "POST", body: JSON.stringify(payload) }),
  requestAdviserChange: (payload) =>
    request("/student-portal/adviser/change", { method: "POST", body: JSON.stringify(payload) }),
  withdrawAdviserApplication: (id) =>
    request(`/student-portal/adviser/${id}/withdraw`, { method: "POST", body: JSON.stringify({}) }),
  submitAdviserContract: (id, note = "") =>
    request(`/student-portal/adviser/${id}/contract`, { method: "POST", body: JSON.stringify({ note }) }),
  adviserAppointments: (params = {}) => {
    const qs = queryString(params);
    return request(`/adviser-appointments${qs ? `?${qs}` : ""}`);
  },
  noteAdviserApplication: (id, note = "") =>
    request(`/adviser-appointments/${id}/note`, { method: "POST", body: JSON.stringify({ note }) }),
  forwardAdviserApplication: (id) =>
    request(`/adviser-appointments/${id}/forward`, { method: "POST", body: JSON.stringify({}) }),
  decideAdviserAppointment: (id, payload) =>
    request(`/adviser-appointments/${id}/decision`, { method: "POST", body: JSON.stringify(payload) }),
  receiveAdviserContract: (id) =>
    request(`/adviser-appointments/${id}/contract-received`, { method: "POST", body: JSON.stringify({}) }),
  recordAdviserAppointment: (payload) =>
    request("/adviser-appointments/record", { method: "POST", body: JSON.stringify(payload) }),
  facultyAdviserRequests: () => request("/faculty-portal/adviser-requests"),
  respondAdviserRequest: (id, payload) =>
    request(`/faculty-portal/adviser-requests/${id}/respond`, { method: "POST", body: JSON.stringify(payload) }),
  consentAdviserChange: (id, payload) =>
    request(`/faculty-portal/adviser-requests/${id}/consent`, { method: "POST", body: JSON.stringify(payload) }),
  facultyPanelInvitations: () => request("/faculty-portal/panel-invitations"),
  respondPanelInvitation: (id, payload) =>
    request(`/faculty-portal/panel-invitations/${id}/respond`, { method: "POST", body: JSON.stringify(payload) }),
  setDefenseVenue: (scheduleId, payload) =>
    request(`/faculty-portal/defense-schedules/${scheduleId}/venue`, { method: "POST", body: JSON.stringify(payload) }),
  cannotAttendDefense: (scheduleId, payload) =>
    request(`/faculty-portal/defense-schedules/${scheduleId}/cannot-attend`, { method: "POST", body: JSON.stringify(payload) }),
  notifications: (params = {}) => {
    const qs = queryString(params);
    return request(`/notifications${qs ? `?${qs}` : ""}`);
  },
  // A read never makes anything (I-071): the due reminders are made by this explicit call, the sweeps by the next one.
  refreshNotifications: () => request("/notifications/refresh", { method: "POST", body: JSON.stringify({}) }),
  maintenanceRefresh: () => request("/maintenance/refresh", { method: "POST", body: JSON.stringify({}) }),
  markNotificationRead: (id) =>
    request(`/notifications/${id}/read`, { method: "POST", body: JSON.stringify({}) }),
  markAllNotificationsRead: () =>
    request("/notifications/read-all", { method: "POST", body: JSON.stringify({}) }),
  calendarFeed: () => request("/calendar-feed"),
  createCalendarFeed: () => request("/calendar-feed", { method: "POST", body: JSON.stringify({}) }),
  revokeCalendarFeed: () => request("/calendar-feed", { method: "DELETE" }),
  submitStudentDocument: async (documentId, file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await announced(`${BASE}/student-portal/documents/${documentId}/upload`, {
      method: "POST",
      body: form,
      credentials: "same-origin",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Upload failed (${res.status})`);
    return body;
  },
};

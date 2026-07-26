// Thin fetch wrapper around the Flask JSON API.
const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...options,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body && body.error) message = body.error;
    } catch (e) {
      /* ignore parse errors */
    }
    throw new Error(message);
  }
  return res.json();
}

function queryString(params = {}) {
  return new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== "" && v != null)
  ).toString();
}

export const api = {
  me: () => request("/auth/me"),
  login: (payload) => request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => request("/auth/logout", { method: "POST", body: JSON.stringify({}) }),
  demoStudents: () => request("/auth/demo-students"),
  resetDemoStudent: (demoKey) =>
    request(`/auth/demo-students/${encodeURIComponent(demoKey)}/reset`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  meta: () => request("/meta"),
  adminTerms: () => request("/admin/terms"),
  updateTerm: (id, payload) => request(`/admin/terms/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteTerm: (id, payload) => request(`/admin/terms/${id}`, { method: "DELETE", body: JSON.stringify(payload) }),
  addNextTerm: () => request("/admin/terms/add-next", { method: "POST", body: JSON.stringify({}) }),
  dashboard: (params = {}) => {
    const qs = queryString(params);
    return request(`/dashboard${qs ? `?${qs}` : ""}`);
  },
  dashboardDrilldown: (params = {}) => {
    const qs = queryString(params);
    return request(`/dashboard/drilldown${qs ? `?${qs}` : ""}`);
  },
  students: (params = {}) => {
    const qs = queryString(params);
    return request(`/students${qs ? `?${qs}` : ""}`);
  },
  faculty: () => request("/faculty"),
  facultyProfile: (facultyId) => request(`/faculty/${facultyId}`),
  saveFacultyPreferences: (facultyId, courseIds) =>
    request(`/faculty/${facultyId}/preferences`, {
      method: "PUT",
      body: JSON.stringify({ course_ids: courseIds }),
    }),
  student: (id) => request(`/students/${id}`),
  duplicateStudents: () => request("/students/duplicates"),
  mergeStudents: (payload) =>
    request("/students/merge", { method: "POST", body: JSON.stringify(payload) }),
  tasks: (params = {}) => {
    const actual = typeof params === "string" ? { owner: params } : params;
    const qs = queryString(actual);
    return request(`/tasks${qs ? `?${qs}` : ""}`);
  },
  activity: () => request("/activity"),
  reports: (params = {}) => {
    const qs = queryString(params);
    return request(`/reports${qs ? `?${qs}` : ""}`);
  },
  dailyChanges: (date = "") => {
    const qs = queryString({ date });
    return request(`/reports/daily-changes${qs ? `?${qs}` : ""}`);
  },
  markChangeReflected: (logId, reflected) =>
    request(`/reports/daily-changes/${logId}/reflected`, {
      method: "PATCH",
      body: JSON.stringify({ reflected }),
    }),
  exportGraduationCsv: async (reviewWindow = "", endorsementIds = []) => {
    const res = await fetch(`${BASE}/graduation/endorsed.csv`, {
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
    return { count: Number(res.headers.get("X-Exported-Count") || 0), filename };
  },
  exportWithdrawalXlsx: async (applicationIds = []) => {
    const res = await fetch(`${BASE}/withdrawal/approved.xlsx`, {
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
    return { count: Number(res.headers.get("X-Exported-Count") || 0), filename };
  },
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
    const res = await fetch(`${BASE}/transactions/student-handoff/import`, { method: "POST", body: form, credentials: "same-origin" });
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
  saveCompreExam: (payload) =>
    request("/monitoring/compre-exam", { method: "POST", body: JSON.stringify(payload) }),
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
    const res = await fetch(`${BASE}/monitoring/issues/resolve-upload`, {
      method: "POST",
      body: form,
      credentials: "same-origin",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Corrected workbook upload failed (${res.status})`);
    return body;
  },
  curriculumPlanning: (params = {}) => {
    const actual = typeof params === "string" || typeof params === "number" ? { program_id: params } : params;
    const qs = queryString(actual);
    return request(`/curriculum-planning${qs ? `?${qs}` : ""}`);
  },
  curriculumOfferings: (params = {}) => {
    const qs = queryString(params);
    return request(`/curriculum-planning/offerings${qs ? `?${qs}` : ""}`);
  },
  addCurriculumOfferings: (payload) =>
    request("/curriculum-planning/offerings", { method: "POST", body: JSON.stringify(payload) }),
  deleteCurriculumOffering: (id) =>
    request(`/curriculum-planning/offerings/${id}`, { method: "DELETE" }),
  generateCurriculum: (payload) =>
    request("/curriculum-planning/generate", { method: "POST", body: JSON.stringify(payload) }),
  createCurriculumSubject: (payload) =>
    request("/curriculum-planning/subjects", { method: "POST", body: JSON.stringify(payload) }),
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
    const res = await fetch(`${BASE}/enrollment/class-list-preview`, { method: "POST", body: form, credentials: "same-origin" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Class list preview failed (${res.status})`);
    return body;
  },
  importClassList: async (file, termId) => {
    const form = new FormData();
    form.append("file", file);
    if (termId) form.append("term_id", termId);
    const res = await fetch(`${BASE}/enrollment/class-list-import`, { method: "POST", body: form, credentials: "same-origin" });
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
  courseAuditSubjects: (programId) =>
    request(`/course-audit/subjects${programId ? `?program_id=${programId}` : ""}`),
  courseAuditRoster: (courseId, term = "") =>
    request(`/course-audit/roster?course_id=${courseId}${term ? `&term=${encodeURIComponent(term)}` : ""}`),
  saveCourseAudit: (payload) =>
    request("/course-audit/roster", { method: "POST", body: JSON.stringify(payload) }),
  removeStudent: (studentId, payload = {}) =>
    request(`/students/${studentId}/remove`, { method: "POST", body: JSON.stringify(payload) }),
  flagMonitoringIssue: (studentId, payload = {}) =>
    request(`/students/${studentId}/flag-issue`, { method: "POST", body: JSON.stringify(payload) }),
  monitoringFlags: (studentId) => request(`/students/${studentId}/flags`),
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
  loaPolicyReview: (payload) =>
    request("/leave-of-absence/policy-review", { method: "POST", body: JSON.stringify(payload) }),
  readmissionPolicyReview: (payload) =>
    request("/readmission/policy-review", { method: "POST", body: JSON.stringify(payload) }),
  awolPolicyReview: (payload) =>
    request("/awol/policy-review", { method: "POST", body: JSON.stringify(payload) }),
  studentPortalContext: () => request("/student-portal/context"),
  saveStudentEnrollment: (courseIds, termId) =>
    request("/student-portal/enrollment", {
      method: "POST",
      body: JSON.stringify({ course_ids: courseIds, term_id: termId || null }),
    }),
  studentAssistant: (question) =>
    request("/student-portal/assistant", { method: "POST", body: JSON.stringify({ question }) }),
  studentAssistantSuggestions: () => request("/student-portal/assistant/suggestions"),
  facultyPortalContext: () => request("/faculty-portal/context"),
  googleCalendarAuthorization: () => request("/faculty-portal/google-calendar/authorization"),
  signAdviserPaper: (evidenceId, payload) =>
    request(`/faculty-portal/adviser-approvals/${evidenceId}`, { method: "POST", body: JSON.stringify(payload) }),
  submitDefenseVerdict: (scheduleId, payload) =>
    request(`/faculty-portal/defense-verdicts/${scheduleId}`, { method: "POST", body: JSON.stringify(payload) }),
  submitStudentRequest: (type, payload) =>
    request(`/student-portal/requests/${type}`, { method: "POST", body: JSON.stringify(payload) }),
  withdrawStudentLoaRequest: () =>
    request("/student-portal/requests/leave-of-absence/withdraw", { method: "POST", body: JSON.stringify({}) }),
  uploadResearchEvidence: async (gate, itemName, file) => {
    const form = new FormData();
    form.append("gate", gate);
    form.append("item_name", itemName);
    form.append("file", file);
    const res = await fetch(`${BASE}/student-portal/research-evidence/upload`, {
      method: "POST",
      body: form,
      credentials: "same-origin",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Upload failed (${res.status})`);
    return body;
  },
  parseTitleDefense: async (file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/student-portal/title-defense/parse`, {
      method: "POST",
      body: form,
      credentials: "same-origin",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Could not read the file (${res.status})`);
    return body;
  },
  deleteResearchEvidence: (evidenceId) =>
    request(`/student-portal/research-evidence/${evidenceId}`, { method: "DELETE" }),
  evaluateConceptPaper: (evidenceId) =>
    request(`/research-evidence/${evidenceId}/concept-paper-compliance`, { method: "POST", body: JSON.stringify({}) }),
  form1Endorsements: () => request("/research-gate/form1-endorsements"),
  endorseForm1: (studentId, payload) =>
    request(`/research-gate/form1-endorsements/${studentId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  uploadStudentRequestAttachment: async (requestType, file) => {
    const form = new FormData();
    form.append("request_type", requestType);
    form.append("file", file);
    const res = await fetch(`${BASE}/student-portal/request-attachments/upload`, {
      method: "POST",
      body: form,
      credentials: "same-origin",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Upload failed (${res.status})`);
    return body;
  },
  submitStudentDocument: async (documentId, file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/student-portal/documents/${documentId}/upload`, {
      method: "POST",
      body: form,
      credentials: "same-origin",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Upload failed (${res.status})`);
    return body;
  },
};

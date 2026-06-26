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
  meta: () => request("/meta"),
  terms: () => request("/admin/terms"),
  activeTerm: () => request("/terms/active"),
  createTerm: (payload) =>
    request("/admin/terms", { method: "POST", body: JSON.stringify(payload) }),
  updateTerm: (id, payload) =>
    request(`/admin/terms/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  setActiveTerm: (id) =>
    request(`/admin/terms/${id}/set-active`, { method: "PATCH", body: JSON.stringify({}) }),
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
    return { count: Number(res.headers.get("X-Exported-Count") || 0) };
  },
  transactionContext: (slug, params = {}) => {
    const qs = queryString(params);
    return request(`/transactions/${slug}/context${qs ? `?${qs}` : ""}`);
  },
  submitTransaction: (slug, payload) =>
    request(`/transactions/${slug}`, { method: "POST", body: JSON.stringify(payload) }),
  sendWorkflowMessage: (slug, payload) =>
    request(`/transactions/${slug}/messages`, { method: "POST", body: JSON.stringify(payload) }),
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
  monitoringUploads: () => request("/monitoring/uploads"),
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
  courseAdjustments: (params = {}) => {
    const actual = typeof params === "string" || typeof params === "number" ? { program_id: params } : params;
    const qs = queryString(actual);
    return request(`/course-adjustments${qs ? `?${qs}` : ""}`);
  },
  resetUploadedData: () => request("/admin/reset-uploaded-data", { method: "POST", body: JSON.stringify({}) }),
  resetDemoData: () => request("/admin/reset-demo", { method: "POST", body: JSON.stringify({}) }),
  approvals: () => request("/approvals"),
  decideApproval: (planId, payload) =>
    request(`/approvals/${planId}/decide`, { method: "POST", body: JSON.stringify(payload) }),
  decideWorkflowApproval: (type, id, payload) =>
    request(`/approvals/workflow/${type}/${id}/decide`, { method: "POST", body: JSON.stringify(payload) }),
  saveCourseAdjustmentPlan: (payload) =>
    request("/course-adjustments/plan", { method: "POST", body: JSON.stringify(payload) }),
  courseAuditSubjects: (programId) =>
    request(`/course-audit/subjects${programId ? `?program_id=${programId}` : ""}`),
  courseAuditRoster: (courseId, term = "") =>
    request(`/course-audit/roster?course_id=${courseId}${term ? `&term=${encodeURIComponent(term)}` : ""}`),
  saveCourseAudit: (payload) =>
    request("/course-audit/roster", { method: "POST", body: JSON.stringify(payload) }),
  courseDropRequests: (status = "Submitted") =>
    request(`/course-drop/requests${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  decideCourseDrop: (requestId, payload) =>
    request(`/course-drop/requests/${requestId}/decide`, { method: "POST", body: JSON.stringify(payload) }),
  decisionSupport: () => request("/decision-support"),
  assistant: (question, studentId) =>
    request("/assistant", { method: "POST", body: JSON.stringify({ question, student_id: studentId || null }) }),
  assistantSuggestions: () => request("/assistant/suggestions"),
  studentPortalContext: () => request("/student-portal/context"),
  facultyPortalContext: () => request("/faculty-portal/context"),
  submitStudentRequest: (type, payload) =>
    request(`/student-portal/requests/${type}`, { method: "POST", body: JSON.stringify(payload) }),
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

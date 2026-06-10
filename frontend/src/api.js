// Thin fetch wrapper around the Flask JSON API.
const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
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

export const api = {
  meta: () => request("/meta"),
  dashboard: () => request("/dashboard"),
  students: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== "" && v != null)
    ).toString();
    return request(`/students${qs ? `?${qs}` : ""}`);
  },
  student: (id) => request(`/students/${id}`),
  tasks: (owner) => request(`/tasks${owner ? `?owner=${encodeURIComponent(owner)}` : ""}`),
  activity: () => request("/activity"),
  transactionContext: (slug, params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== "" && v != null)
    ).toString();
    return request(`/transactions/${slug}/context${qs ? `?${qs}` : ""}`);
  },
  submitTransaction: (slug, payload) =>
    request(`/transactions/${slug}`, { method: "POST", body: JSON.stringify(payload) }),
  importHandoff: async (file) => {
    const form = new FormData();
    form.append("file", file);
    // No Content-Type header: the browser sets the multipart boundary itself.
    const res = await fetch(`${BASE}/transactions/student-handoff/import`, { method: "POST", body: form });
    let body = null;
    try {
      body = await res.json();
    } catch (e) {
      /* ignore */
    }
    if (!res.ok) throw new Error((body && body.error) || `Upload failed (${res.status})`);
    return body;
  },
  monitoringGrid: (programId) =>
    request(`/monitoring/grid${programId ? `?program_id=${programId}` : ""}`),
  courseAuditSubjects: (programId) =>
    request(`/course-audit/subjects${programId ? `?program_id=${programId}` : ""}`),
  courseAuditRoster: (courseId) => request(`/course-audit/roster?course_id=${courseId}`),
  saveCourseAudit: (payload) =>
    request("/course-audit/roster", { method: "POST", body: JSON.stringify(payload) }),
  decisionSupport: () => request("/decision-support"),
  assistant: (question, studentId) =>
    request("/assistant", { method: "POST", body: JSON.stringify({ question, student_id: studentId || null }) }),
  assistantSuggestions: () => request("/assistant/suggestions"),
};

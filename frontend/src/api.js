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

export const api = {
  me: () => request("/auth/me"),
  login: (payload) => request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => request("/auth/logout", { method: "POST", body: JSON.stringify({}) }),
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
  decisionSupport: () => request("/decision-support"),
  assistant: (question, studentId) =>
    request("/assistant", { method: "POST", body: JSON.stringify({ question, student_id: studentId || null }) }),
  assistantSuggestions: () => request("/assistant/suggestions"),
  studentPortalContext: () => request("/student-portal/context"),
  submitStudentRequest: (type, payload) =>
    request(`/student-portal/requests/${type}`, { method: "POST", body: JSON.stringify(payload) }),
};

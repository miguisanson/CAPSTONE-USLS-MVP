import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle, Send, FileSpreadsheet, GraduationCap, ClipboardList, RefreshCw } from "lucide-react";
import { api } from "../api";
import { Card, EmptyState, SectionTitle, Spinner } from "./ui";

/* Panels for the process steps the BPMN models require but that previously had
   no screen: the Dean onboarding gate (BPMN 1), the derived study plan and
   curriculum version tagging (BPMN 2), and the coursework report routed to the
   Dean (BPMN 4). */

function Banner({ tone = "info", children }) {
  if (!children) return null;
  const tones = {
    info: "bg-brand-50 text-brand-700",
    error: "bg-rose-50 text-rose-700",
    ok: "bg-emerald-50 text-emerald-700",
  };
  return <div className={`rounded-lg px-3 py-2 text-sm font-semibold ${tones[tone]}`}>{children}</div>;
}

function Pill({ children }) {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-slate-600">
      {children}
    </span>
  );
}

/* ---------------------------------------------------------------- BPMN 1 */
export function OnboardingGatePanel({ role }) {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [remarks, setRemarks] = useState({});

  const load = useCallback(() => {
    api.onboardingReviews()
      .then((res) => setItems(res.items || []))
      .catch((err) => setMsg({ tone: "error", text: err.message }));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(fn) {
    setBusy(true); setMsg(null);
    try { await fn(); load(); }
    catch (err) { setMsg({ tone: "error", text: err.message }); }
    finally { setBusy(false); }
  }

  if (items === null) return <Spinner label="Loading onboarding reports..." />;

  return (
    <Card className="p-5">
      <SectionTitle
        title="Onboarding report & Dean approval"
        icon={GraduationCap}
        action={<button type="button" onClick={load} className="btn-ghost"><RefreshCw className="h-4 w-4" /> Refresh</button>}
      />
      <p className="-mt-1 mb-3 text-xs text-slate-500">
        Each import batch is checked, reported to the Dean, and only then recorded as an admission completion.
        The checklist is derived from the import — it is not ticked by hand.
      </p>
      {msg ? <div className="mb-3"><Banner tone={msg.tone}>{msg.text}</Banner></div> : null}
      {!items.length ? (
        <EmptyState icon={FileSpreadsheet} title="No import batches yet" hint="Import a monitoring sheet to open an onboarding report." />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">
                    {item.program_code} · {item.student_count} student{item.student_count === 1 ? "" : "s"}
                    {item.new_student_count ? ` · ${item.new_student_count} new` : ""}
                  </p>
                  <p className="text-xs text-slate-500">{item.source_file}</p>
                </div>
                <Pill>{item.status}</Pill>
              </div>

              <ul className="mt-3 space-y-1.5">
                {item.checklist.map((check) => (
                  <li key={check.label} className="flex items-start gap-2 text-sm">
                    {check.passed
                      ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
                    <span className="text-slate-600">
                      <span className="font-semibold text-ink">{check.label}</span> — {check.detail}
                    </span>
                  </li>
                ))}
              </ul>

              {item.dean_remarks ? (
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <span className="font-bold">Dean:</span> {item.dean_remarks}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {role !== "dean" && (item.status === "Draft" || item.status === "Returned") ? (
                  <button
                    type="button"
                    disabled={busy || !item.checklist_complete}
                    onClick={() => act(() => api.submitOnboardingReview(item.id))}
                    className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Send className="h-4 w-4" /> Send onboarding report to Dean
                  </button>
                ) : null}
                {role === "dean" && item.status === "Dean Review" ? (
                  <>
                    <input
                      value={remarks[item.id] || ""}
                      onChange={(e) => setRemarks((r) => ({ ...r, [item.id]: e.target.value }))}
                      placeholder="Remarks (required to return)"
                      className="field-input max-w-xs"
                    />
                    <button type="button" disabled={busy} className="btn-primary"
                      onClick={() => act(() => api.decideOnboardingReview(item.id, { decision: "approve", remarks: remarks[item.id] || "" }))}>
                      Approve onboarding
                    </button>
                    <button type="button" disabled={busy} className="btn-ghost"
                      onClick={() => act(() => api.decideOnboardingReview(item.id, { decision: "return", remarks: remarks[item.id] || "" }))}>
                      Return
                    </button>
                  </>
                ) : null}
                {item.admission_completed_at ? (
                  <span className="text-xs font-semibold text-emerald-700">
                    Admission completion recorded {new Date(item.admission_completed_at).toLocaleDateString()}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------- BPMN 2 */
export function StudyPlanPanel({ students = [] }) {
  const [plans, setPlans] = useState(null);
  const [studentId, setStudentId] = useState("");
  const [tag, setTag] = useState(null);
  const [version, setVersion] = useState("");
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(() => {
    api.studyPlans().then((res) => setPlans(res.items || [])).catch((e) => setMsg({ tone: "error", text: e.message }));
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!studentId) { setTag(null); return; }
    api.curriculumTag(studentId)
      .then((res) => { setTag(res); setVersion(res.tag?.curriculum_version || ""); })
      .catch((e) => setMsg({ tone: "error", text: e.message }));
  }, [studentId]);

  async function act(fn) {
    setBusy(true); setMsg(null);
    try { await fn(); load(); }
    catch (err) { setMsg({ tone: "error", text: err.message }); }
    finally { setBusy(false); }
  }

  const multipleVersions = (tag?.available_versions || []).length > 1;

  return (
    <Card className="p-5">
      <SectionTitle title="Curriculum version & study plan draft" icon={ClipboardList} />
      <p className="-mt-1 mb-3 text-xs text-slate-500">
        Tag the curriculum version the student is tracked against, then generate the study plan from the
        curriculum audit and send it to the Academic Coordinator. The plan is derived, never typed.
      </p>
      {msg ? <div className="mb-3"><Banner tone={msg.tone}>{msg.text}</Banner></div> : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="field-label">Student</label>
          <select className="field-input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            <option value="">Select a student…</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.name} · {s.student_number}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Curriculum version</label>
          <select className="field-input" value={version} onChange={(e) => setVersion(e.target.value)} disabled={!studentId}>
            <option value="">Select a version…</option>
            {(tag?.available_versions || []).map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>

      {multipleVersions ? (
        <div className="mt-3">
          <label className="field-label">
            Reason for this version <span className="text-rose-600">· required, more than one version is published</span>
          </label>
          <input className="field-input" value={rationale} onChange={(e) => setRationale(e.target.value)}
            placeholder="e.g. Entered under this curriculum; no bridging subjects required." />
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-ghost" disabled={busy || !studentId || !version}
          onClick={() => act(async () => {
            await api.setCurriculumTag(studentId, { curriculum_version: version, rationale });
            const res = await api.curriculumTag(studentId); setTag(res);
          })}>
          Tag curriculum version
        </button>
        <button type="button" className="btn-primary" disabled={busy || !studentId}
          onClick={() => act(() => api.generateStudyPlan({ student_id: Number(studentId) }))}>
          Generate study plan draft
        </button>
      </div>

      {tag?.tag ? (
        <p className="mt-2 text-xs text-slate-500">
          Tagged <span className="font-semibold text-ink">{tag.tag.curriculum_version}</span>
          {tag.tag.rationale ? ` — ${tag.tag.rationale}` : ""}
        </p>
      ) : null}

      <div className="mt-4">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Recent study plan drafts</p>
        {plans === null ? <Spinner label="Loading…" /> : !plans.length ? (
          <EmptyState icon={ClipboardList} title="No study plan drafts yet" />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                  {["Student", "Term", "Version", "Proposed subjects", "Still required", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plans.slice(0, 8).map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 align-top">
                    <td className="px-4 py-2.5 font-semibold text-ink">{p.student?.name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{p.term_label || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{p.curriculum_version || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{p.subjects.join(", ") || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{p.remaining_count}</td>
                    <td className="px-4 py-2.5"><Pill>{p.status}</Pill></td>
                    <td className="px-4 py-2.5">
                      {p.status === "Draft" ? (
                        <button type="button" className="btn-ghost" disabled={busy}
                          onClick={() => act(() => api.sendStudyPlan(p.id))}>
                          <Send className="h-4 w-4" /> Send to AC
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- BPMN 4 */
export function CourseworkReportPanel({ role }) {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [remarks, setRemarks] = useState({});

  const load = useCallback(() => {
    api.courseworkReports().then((res) => setItems(res.items || [])).catch((e) => setMsg({ tone: "error", text: e.message }));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(fn) {
    setBusy(true); setMsg(null);
    try { await fn(); load(); }
    catch (err) { setMsg({ tone: "error", text: err.message }); }
    finally { setBusy(false); }
  }

  if (items === null) return <Spinner label="Loading coursework reports..." />;

  return (
    <Card className="p-5">
      <SectionTitle
        title="Coursework status report to the Dean"
        icon={FileSpreadsheet}
        action={role !== "dean" ? (
          <button type="button" className="btn-primary" disabled={busy}
            onClick={() => act(() => api.generateCourseworkReport({}))}>
            Generate report
          </button>
        ) : null}
      />
      <p className="-mt-1 mb-3 text-xs text-slate-500">
        Completion issues and missing subjects for the active term, compiled for the Dean's review.
      </p>
      {msg ? <div className="mb-3"><Banner tone={msg.tone}>{msg.text}</Banner></div> : null}
      {!items.length ? (
        <EmptyState icon={FileSpreadsheet} title="No coursework reports yet" hint="Generate one to send to the Dean." />
      ) : (
        <div className="space-y-3">
          {items.slice(0, 5).map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-ink">
                  {item.term_label || "Active term"}{item.program ? ` · ${item.program.code}` : " · All programs"}
                </p>
                <Pill>{item.status}</Pill>
              </div>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-600">
                <span><span className="font-bold text-ink">{item.students_reviewed}</span> reviewed</span>
                <span><span className="font-bold text-ink">{item.completion_issue_count}</span> with completion issues</span>
                <span><span className="font-bold text-ink">{item.missing_subject_count}</span> missing subjects</span>
              </div>
              {item.dean_remarks ? (
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  <span className="font-bold">Dean:</span> {item.dean_remarks}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {role !== "dean" && item.status === "Draft" ? (
                  <button type="button" className="btn-ghost" disabled={busy}
                    onClick={() => act(() => api.sendCourseworkReport(item.id))}>
                    <Send className="h-4 w-4" /> Send to Dean
                  </button>
                ) : null}
                {role === "dean" && item.status === "Dean Review" ? (
                  <>
                    <input value={remarks[item.id] || ""} onChange={(e) => setRemarks((r) => ({ ...r, [item.id]: e.target.value }))}
                      placeholder="Remarks (required to return)" className="field-input max-w-xs" />
                    <button type="button" className="btn-primary" disabled={busy}
                      onClick={() => act(() => api.decideCourseworkReport(item.id, { decision: "acknowledge", remarks: remarks[item.id] || "" }))}>
                      Acknowledge
                    </button>
                    <button type="button" className="btn-ghost" disabled={busy}
                      onClick={() => act(() => api.decideCourseworkReport(item.id, { decision: "return", remarks: remarks[item.id] || "" }))}>
                      Return
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

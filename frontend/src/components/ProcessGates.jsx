import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle, Send, FileSpreadsheet, GraduationCap, ClipboardList, RefreshCw } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Button, DataTable, EmptyState, Field, InlineNotice, Input, SectionCard, Select, Spinner, StatusChip } from "./ui/index.js";

/* Panels for the process steps the BPMN models require but that previously had
   no screen: the Dean onboarding gate (BPMN 1), the derived study plan and
   curriculum version tagging (BPMN 2), and the coursework report routed to the
   Dean (BPMN 4). */

/** The message of the last step: a refused or failed call (`danger`). Empty when there is nothing to say. */
function Notice({ msg }) {
  if (!msg || !msg.text) return null;
  return <InlineNotice tone={msg.tone}>{msg.text}</InlineNotice>;
}

/** A remark from the person who reviewed the item (Dean, Coordinator). */
function Remark({ who, children }) {
  return (
    <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
      <span className="font-semibold">{who}:</span> {children}
    </p>
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
      .catch((err) => setMsg({ tone: "danger", text: err.message }));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(fn) {
    setBusy(true); setMsg(null);
    try { await fn(); load(); }
    catch (err) { setMsg({ tone: "danger", text: err.message }); }
    finally { setBusy(false); }
  }

  if (items === null) return <Spinner label="Loading onboarding reports..." />;

  return (
    <SectionCard
      title="Onboarding report & Dean approval"
      icon={GraduationCap}
      action={<Button variant="secondary" icon={RefreshCw} onClick={load}>Refresh</Button>}
    >
      <p className="text-sm text-slate-500">Each import batch is checked, reported to the Dean, and only then recorded as an admission completion. The checklist is derived from the import — it is not ticked by hand.</p>
      <Notice msg={msg} />
      {!items.length ? (
        role === "dean" ? (
          <EmptyState icon={FileSpreadsheet} title="No onboarding reports have been sent to you yet." hint="When Graduate School staff report an import batch, it appears here for your approval." />
        ) : (
          <EmptyState icon={FileSpreadsheet} title="No import batches yet" hint="Import a monitoring sheet to open an onboarding report." />
        )
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="space-y-3 rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="card-title">
                    {item.program_code} · {item.student_count} student{item.student_count === 1 ? "" : "s"}
                    {item.new_student_count ? ` · ${item.new_student_count} new` : ""}
                  </p>
                  <p className="meta">{item.source_file}</p>
                </div>
                <StatusChip status={item.status} dot={false} />
              </div>

              <ul className="space-y-1.5">
                {item.checklist.map((check) => (
                  <li key={check.label} className="flex items-start gap-2 text-sm">
                    {check.passed
                      ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                      : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />}
                    <span className="text-slate-600">
                      <span className="font-semibold text-ink">{check.label}</span> — {check.detail}
                    </span>
                  </li>
                ))}
              </ul>

              {item.dean_remarks ? <Remark who="Dean">{item.dean_remarks}</Remark> : null}

              <div className="flex flex-wrap items-center gap-2">
                {role !== "dean" && (item.status === "Draft" || item.status === "Returned") ? (
                  <Button
                    icon={Send}
                    disabled={busy || !item.checklist_complete}
                    onClick={() => act(() => api.submitOnboardingReview(item.id))}
                  >
                    Send onboarding report to Dean
                  </Button>
                ) : null}
                {role === "dean" && item.status === "Dean Review" ? (
                  <>
                    <Input
                      value={remarks[item.id] || ""}
                      onChange={(e) => setRemarks((r) => ({ ...r, [item.id]: e.target.value }))}
                      placeholder="Remarks (required to return)"
                      aria-label="Dean remarks (required to return)"
                      className="max-w-xs"
                    />
                    <Button
                      disabled={busy}
                      onClick={() => act(() => api.decideOnboardingReview(item.id, { decision: "approve", remarks: remarks[item.id] || "" }))}
                    >
                      Approve onboarding
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => act(() => api.decideOnboardingReview(item.id, { decision: "return", remarks: remarks[item.id] || "" }))}
                    >
                      Return
                    </Button>
                  </>
                ) : null}
                {item.admission_completed_at ? (
                  <span className="meta font-semibold text-brand-700">
                    Admission completion recorded {new Date(item.admission_completed_at).toLocaleDateString()}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

/* ---------------------------------------------------------------- BPMN 2 */
/** `studentId` (optional): the page already has a student chosen (Enrollment); then this panel works on that student
 *  and shows no picker of its own. `studentName` is shown in its place. Without it the panel has its own picker. */
export function StudyPlanPanel({ students = [], studentId: fixedStudentId, studentName }) {
  const [plans, setPlans] = useState(null);
  const [pickedStudentId, setStudentId] = useState("");
  const fixed = fixedStudentId !== undefined && fixedStudentId !== null && fixedStudentId !== "";
  const studentId = fixed ? String(fixedStudentId) : pickedStudentId;
  const [tag, setTag] = useState(null);
  const [version, setVersion] = useState("");
  const [rationale, setRationale] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [reviewRemarks, setReviewRemarks] = useState({});
  const { user } = useAuth();
  const role = user?.role;

  const load = useCallback(() => {
    api.studyPlans().then((res) => setPlans(res.items || [])).catch((e) => setMsg({ tone: "danger", text: e.message }));
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setRationale("");
    if (!studentId) { setTag(null); setVersion(""); return; }
    api.curriculumTag(studentId)
      .then((res) => { setTag(res); setVersion(res.tag?.curriculum_version || ""); })
      .catch((e) => setMsg({ tone: "danger", text: e.message }));
  }, [studentId]);

  async function act(fn) {
    setBusy(true); setMsg(null);
    try { await fn(); load(); }
    catch (err) { setMsg({ tone: "danger", text: err.message }); }
    finally { setBusy(false); }
  }

  const multipleVersions = (tag?.available_versions || []).length > 1;
  const studentOptions = students.map((s) => ({ value: String(s.id), label: `${s.name} · ${s.student_number}` }));
  const versionOptions = (tag?.available_versions || []).map((v) => ({ value: v, label: v }));

  const planColumns = [
    { key: "student", header: "Student", cell: (p) => <span className="font-semibold text-ink">{p.student?.name}</span> },
    { key: "term", header: "Term", cell: (p) => p.term_label || "—" },
    { key: "version", header: "Version", cell: (p) => p.curriculum_version || "—" },
    { key: "subjects", header: "Proposed subjects", cell: (p) => p.subjects.join(", ") || "—" },
    { key: "remaining", header: "Still required", cell: (p) => p.remaining_count },
    {
      key: "status",
      header: "Status",
      cell: (p) => (
        <>
          <StatusChip status={p.status} dot={false} />
          {p.coordinator_remarks ? (
            <p className="mt-1.5 max-w-xs rounded-xl bg-slate-50 px-2.5 py-1.5 text-xs font-normal text-slate-600">
              <span className="font-semibold">Coordinator:</span> {p.coordinator_remarks}
            </p>
          ) : null}
        </>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      cell: (p) => (
        <>
          {p.status === "Draft" ? (
            <Button variant="secondary" icon={Send} disabled={busy} onClick={() => act(() => api.sendStudyPlan(p.id))}>
              Send to AC
            </Button>
          ) : null}
          {p.status === "Returned for Revision" && role === "staff" ? (
            <Button variant="secondary" icon={Send} disabled={busy} onClick={() => act(() => api.sendStudyPlan(p.id))}>
              Send to AC again
            </Button>
          ) : null}
          {p.status === "Sent to Academic Coordinator" && role === "academic_coordinator" ? (
            <div className="space-y-2">
              <Input
                value={reviewRemarks[p.id] || ""}
                onChange={(e) => setReviewRemarks((r) => ({ ...r, [p.id]: e.target.value }))}
                placeholder="Remarks (required to return)"
                aria-label="Review remarks (required to return)"
                className="min-w-[200px]"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy}
                  onClick={() => act(() => api.reviewStudyPlan(p.id, { decision: "approve", remarks: (reviewRemarks[p.id] || "").trim() }))}
                >
                  Approve plan
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy || !(reviewRemarks[p.id] || "").trim()}
                  title={(reviewRemarks[p.id] || "").trim() ? "" : "Write a comment to return the plan"}
                  onClick={() => act(() => api.reviewStudyPlan(p.id, { decision: "return", remarks: (reviewRemarks[p.id] || "").trim() }))}
                >
                  Return with comment
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ),
    },
  ];

  return (
    <SectionCard
      title="Curriculum version & study plan draft"
      icon={ClipboardList}
    >
      <p className="text-sm text-slate-500">Tag the curriculum version the student is tracked against, then generate the study plan from the curriculum audit and send it to the Academic Coordinator. The plan is derived, never typed.</p>
      <Notice msg={msg} />

      {fixed ? (
        <p className="text-sm text-slate-700">
          Study plan for <span className="font-semibold text-ink">{studentName || "the selected student"}</span>
          <span className="meta"> · the student chosen at the top of the page</span>
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {!fixed ? (
          <Field label="Student">
            <Select
              aria-label="Student"
              options={studentOptions}
              placeholder="Select a student…"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
            />
          </Field>
        ) : null}
        <Field label="Curriculum version">
          <Select
            aria-label="Curriculum version"
            options={versionOptions}
            placeholder="Select a version…"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            disabled={!studentId}
          />
        </Field>
      </div>

      {multipleVersions ? (
        <Field label={<>Reason for this version <span className="text-red-600">· required, more than one version is published</span></>}>
          <Input
            aria-label="Reason for this version"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            placeholder="e.g. Entered under this curriculum; no bridging subjects required."
          />
        </Field>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={busy || !studentId || !version}
          onClick={() => act(async () => {
            await api.setCurriculumTag(studentId, { curriculum_version: version, rationale });
            const res = await api.curriculumTag(studentId); setTag(res);
          })}
        >
          Tag curriculum version
        </Button>
        <Button
          disabled={busy || !studentId}
          onClick={() => act(() => api.generateStudyPlan({ student_id: Number(studentId) }))}
        >
          Generate study plan draft
        </Button>
      </div>

      {tag?.tag ? (
        <p className="meta">
          Tagged <span className="font-semibold text-ink">{tag.tag.curriculum_version}</span>
          {tag.tag.rationale ? ` — ${tag.tag.rationale}` : ""}
        </p>
      ) : null}

      <div>
        <p className="eyebrow mb-2">Recent study plan drafts</p>
        {plans === null ? <Spinner label="Loading…" /> : !plans.length ? (
          <EmptyState icon={ClipboardList} title="No study plan drafts yet" />
        ) : (
          <DataTable
            caption="Recent study plan drafts"
            columns={planColumns}
            rows={plans.slice(0, 8)}
            minWidth="md"
            pageSize={0}
          />
        )}
      </div>
    </SectionCard>
  );
}

/* ---------------------------------------------------------------- BPMN 4 */
export function CourseworkReportPanel({ role }) {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [remarks, setRemarks] = useState({});

  const load = useCallback(() => {
    api.courseworkReports().then((res) => setItems(res.items || [])).catch((e) => setMsg({ tone: "danger", text: e.message }));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function act(fn) {
    setBusy(true); setMsg(null);
    try { await fn(); load(); }
    catch (err) { setMsg({ tone: "danger", text: err.message }); }
    finally { setBusy(false); }
  }

  if (items === null) return <Spinner label="Loading coursework reports..." />;

  return (
    <SectionCard
      title="Coursework status report to the Dean"
      icon={FileSpreadsheet}
      action={role !== "dean" ? (
        <Button disabled={busy} onClick={() => act(() => api.generateCourseworkReport({}))}>
          Generate report
        </Button>
      ) : null}
    >
      <p className="text-sm text-slate-500">Completion issues and missing subjects for the active term, compiled for the Dean's review.</p>
      <Notice msg={msg} />
      {!items.length ? (
        role === "dean" ? (
          <EmptyState icon={FileSpreadsheet} title="No coursework reports have been sent to you yet." hint="When Graduate School staff send a coursework status report, it appears here for your review." />
        ) : (
          <EmptyState icon={FileSpreadsheet} title="No coursework reports yet" hint="Generate one to send to the Dean." />
        )
      ) : (
        <div className="space-y-3">
          {items.slice(0, 5).map((item) => (
            <div key={item.id} className="space-y-2 rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="card-title">
                  {item.term_label || "Active term"}{item.program ? ` · ${item.program.code}` : " · All programs"}
                </p>
                <StatusChip status={item.status} dot={false} />
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                <span><span className="font-semibold text-ink">{item.students_reviewed}</span> reviewed</span>
                <span><span className="font-semibold text-ink">{item.completion_issue_count}</span> with completion issues</span>
                <span><span className="font-semibold text-ink">{item.missing_subject_count}</span> missing subjects</span>
              </div>
              {item.dean_remarks ? <Remark who="Dean">{item.dean_remarks}</Remark> : null}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {role !== "dean" && item.status === "Draft" ? (
                  <Button variant="secondary" icon={Send} disabled={busy} onClick={() => act(() => api.sendCourseworkReport(item.id))}>
                    Send to Dean
                  </Button>
                ) : null}
                {role === "dean" && item.status === "Dean Review" ? (
                  <>
                    <Input
                      value={remarks[item.id] || ""}
                      onChange={(e) => setRemarks((r) => ({ ...r, [item.id]: e.target.value }))}
                      placeholder="Remarks (required to return)"
                      aria-label="Dean remarks (required to return)"
                      className="max-w-xs"
                    />
                    <Button
                      disabled={busy}
                      onClick={() => act(() => api.decideCourseworkReport(item.id, { decision: "acknowledge", remarks: remarks[item.id] || "" }))}
                    >
                      Acknowledge
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => act(() => api.decideCourseworkReport(item.id, { decision: "return", remarks: remarks[item.id] || "" }))}
                    >
                      Return
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

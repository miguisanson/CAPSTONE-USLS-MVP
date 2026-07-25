import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Briefcase,
  Mail,
  GraduationCap,
  ClipboardCheck,
  FlaskConical,
  Users,
  CalendarCheck,
  ListTodo,
  Clock,
  FileText,
  AlertTriangle,
  Lightbulb,
  Bot,
  LogOut,
  BookPlus,
  UserPlus,
} from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, SectionTitle, Spinner, StatusBadge, EmptyState, ProgressBar } from "../components/ui";
import HistoryDisclosure from "../components/HistoryDisclosure";
import { initials, formatDate, relativeDays, SEVERITY } from "../lib/format";

export default function StudentDetail() {
  const { id } = useParams();
  const { data, loading, error } = useApi(() => api.student(id), [id]);

  if (loading) return <Spinner label="Loading student record…" />;
  if (error) return <EmptyState icon={AlertTriangle} title="Could not load student" hint={error} />;

  const {
    student,
    stages,
    stage_index,
    course_audit,
    research_case,
    documents_by_gate,
    panel,
    schedules,
    tasks,
    logs,
    recommendations = [],
    practicum_record,
    withdrawal_application,
    graduation_endorsement,
    graduation_eligibility,
    subject_enrollments = [],
  } = data;
  const auditAssistantParams = new URLSearchParams({
    student_id: String(student.id),
    student_label: student.search_label || student.name,
    q: `Is ${student.name} eligible to move to Proposal Development based on the course audit? Explain what is complete and what is missing.`,
  });

  return (
    <div className="space-y-5 animate-fade-up">
      <Link to="/students" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-brand-700 cursor-pointer">
        <ArrowLeft className="h-4 w-4" /> Back to students
      </Link>

      {/* Header */}
      <Card className="p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-brand-100 text-xl font-bold text-brand-700">
              {initials(student.name)}
            </span>
            <div>
              <h1 className="font-display text-2xl font-semibold text-ink">{student.name}</h1>
              <p className="text-sm text-slate-500">
                {student.student_number} · {student.program_name}
              </p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-500">
                <Mail className="h-4 w-4" /> {student.email}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {student.monitoring_new_student && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-3 py-1 text-xs font-bold text-brand-800 ring-1 ring-brand-200">
                <UserPlus className="h-3.5 w-3.5" /> New Student
              </span>
            )}
            {student.enrollment_tag && <StatusBadge value={student.enrollment_tag} dot={false} />}
            <StatusBadge value={student.standing} dot={false} />
            <StatusBadge value={student.risk_level} />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              <GraduationCap className="h-3.5 w-3.5" /> {student.adviser_name || "No adviser"}
            </span>
          </div>
        </div>

        {/* Lifecycle stepper */}
        <HistoryDisclosure className="mt-6" label="View stage history" hideLabel="Hide stage history" count={stages.length}>
          <section aria-label="Student lifecycle stage history">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Lifecycle progress</p>
            <div className="flex flex-wrap gap-1.5">
              {stages.map((stage, i) => {
                const done = i < stage_index;
                const current = i === stage_index;
                return (
                  <div
                    key={stage}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                      current
                        ? "bg-brand-600 text-white"
                        : done
                        ? "bg-brand-50 text-brand-700"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${current || done ? "bg-current" : "bg-slate-300"}`} />
                    {stage}
                  </div>
                );
              })}
            </div>
          </section>
        </HistoryDisclosure>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Main column */}
        <div className="space-y-5 lg:col-span-8">
          {/* Course audit */}
          <Card className="p-6">
            <SectionTitle
              title="Course audit"
              subtitle="Completed, current, and missing subjects vs curriculum"
              icon={ClipboardCheck}
              action={
                <div className="flex flex-wrap justify-end gap-2">
                  <Link
                    to={`/enrollment?program_id=${student.program_id}&student_id=${student.id}${data.current_term?.id ? `&term_id=${data.current_term.id}` : ""}`}
                    className="btn-ghost shrink-0"
                  >
                    <BookPlus className="h-4 w-4" /> Manage enrollment
                  </Link>
                  <Link to={`/assistant?${auditAssistantParams.toString()}`} className="btn-ghost shrink-0">
                    <Bot className="h-4 w-4" /> Ask eligibility
                  </Link>
                </div>
              }
            />
            <div className="mb-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-700">Coursework completion</span>
                  <span className="font-bold text-brand-700">{course_audit.completion_rate}%</span>
                </div>
                <ProgressBar value={course_audit.completion_rate} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <AuditStat label="Completed" value={course_audit.completed.length} tone="brand" />
              <AuditStat label="Current" value={course_audit.current.length} tone="blue" />
              <AuditStat label="Incomplete" value={course_audit.incomplete.length} tone="amber" />
              <AuditStat label="Missing" value={course_audit.missing.length} tone="red" />
            </div>

            {/* Units + per-category subtotals */}
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-700">Units completed</span>
                <span className="font-bold text-brand-700">
                  {course_audit.completed_units} / {course_audit.total_units} units ({course_audit.units_rate}%)
                </span>
              </div>
              <ProgressBar value={course_audit.units_rate} />
              {course_audit.by_category?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {course_audit.by_category.map((cat) => (
                    <span key={cat.category} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                      {cat.category}
                      <span className="text-slate-400">{cat.completed_units}/{cat.total_units}u</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Eligibility (unit-driven) */}
            {course_audit.eligibility && (
              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                  Eligibility (requires all {course_audit.total_units} units)
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["Comprehensive Exam", course_audit.eligibility.comprehensive],
                    ["Final Proposal", course_audit.eligibility.final_proposal],
                    ["Thesis / Title Defense", course_audit.eligibility.thesis],
                  ].map(([label, ok]) => (
                    <span
                      key={label}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
                        ok ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-slate-100 text-slate-500 ring-slate-200"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-brand-500" : "bg-slate-300"}`} />
                      {label} {ok ? "· Eligible" : "· Not yet"}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(course_audit.missing.length > 0 || course_audit.incomplete.length > 0) && (
              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Outstanding subjects</p>
                <ul className="space-y-1.5">
                  {[...course_audit.incomplete, ...course_audit.missing].slice(0, 8).map((row) => (
                    <li key={row.code} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">
                        <span className="font-semibold">{row.code}</span> · {row.title}
                      </span>
                      <StatusBadge value={row.status} dot={false} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {subject_enrollments.length > 0 && (
              <HistoryDisclosure className="mt-4" label="View enrollment history" hideLabel="Hide enrollment history" count={subject_enrollments.length}>
                <div className="max-h-64 overflow-auto rounded-xl border border-slate-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase text-slate-400">
                        <th className="px-3 py-2">Subject</th>
                        <th className="px-3 py-2">Semester</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subject_enrollments.map((item) => (
                        <tr key={item.id} className="border-b border-slate-50">
                          <td className="px-3 py-2">
                            <p className="font-semibold text-ink">{item.course_code}</p>
                            <p className="text-xs text-slate-500">{item.course_title}</p>
                          </td>
                          <td className="px-3 py-2 text-slate-600">{item.term_label}</td>
                          <td className="px-3 py-2">
                            <StatusBadge value={item.status} dot={false} />
                            {item.academic_record_effect && <p className="mt-1 text-xs font-semibold text-emerald-700">{item.academic_record_effect}</p>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </HistoryDisclosure>
            )}
          </Card>

          {/* Research case + documents */}
          <Card className="p-6">
            <SectionTitle title="Research case & evidence" subtitle="Milestone gate and required document checklist" icon={FlaskConical} />
            {research_case ? (
              <div className="mb-4 rounded-xl border border-brand-100 bg-brand-50/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{research_case.title}</p>
                    <p className="text-xs text-slate-500">
                      {research_case.case_type} · current gate: {research_case.current_gate}
                    </p>
                  </div>
                  <StatusBadge value={research_case.status} />
                </div>
              </div>
            ) : (
              <p className="mb-4 text-sm text-slate-500">No research case opened yet.</p>
            )}

            {Object.keys(documents_by_gate).length ? (
              <div className="space-y-4">
                {Object.entries(documents_by_gate).map(([gate, docs]) => (
                  <div key={gate}>
                    <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                      <FileText className="h-4 w-4 text-slate-400" /> {gate}
                    </p>
                    <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {docs.map((doc) => (
                        <li key={doc.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm">
                          <span className="truncate text-slate-600">{doc.item_name}</span>
                          <StatusBadge value={doc.status} dot={false} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No document checks recorded" />
            )}
          </Card>

          {/* Timeline */}
          <Card className="p-6">
            <SectionTitle title="Activity timeline" subtitle="What happened, by whom, and when" icon={Clock} />
            {logs.length ? (
              <HistoryDisclosure label="View logs" hideLabel="Hide logs" count={logs.length}>
                <ol className="relative space-y-4 border-l-2 border-slate-100 pl-5">
                  {logs.map((log) => (
                    <li key={log.id} className="relative">
                      <span className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-brand-500" />
                      <p className="text-sm font-semibold text-ink">{log.result}</p>
                      <p className="text-xs text-slate-500">
                        {log.actor_role} · next: {log.next_owner || "—"} · {formatDate(log.created_at)}
                      </p>
                      {log.notes && <p className="mt-1 text-xs leading-relaxed text-slate-400">{log.notes}</p>}
                    </li>
                  ))}
                </ol>
              </HistoryDisclosure>
            ) : (
              <EmptyState title="No recorded activity" />
            )}
          </Card>
        </div>

        {/* Side column */}
        <div className="space-y-5 lg:col-span-4">
          <WorkflowRecordsCard
            practicum={practicum_record}
            withdrawal={withdrawal_application}
            graduation={graduation_endorsement}
            eligibility={graduation_eligibility}
            hasPracticum={student.program_has_practicum}
          />

          <Card className="p-6">
            <SectionTitle title="Recommended actions" subtitle="Computed from this record" icon={Lightbulb} />
            {recommendations.length ? (
              <ul className="space-y-2.5">
                {recommendations.map((r, i) => {
                  const sev = SEVERITY[r.severity] || SEVERITY.low;
                  return (
                    <li key={i} className="overflow-hidden rounded-xl border border-slate-100">
                      <div className="flex">
                        <span className={`w-1 shrink-0 ${sev.bar}`} aria-hidden />
                        <div className="p-3">
                          <div className="mb-1 flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${sev.badge}`}>
                              {sev.label}
                            </span>
                            {typeof r.score === "number" && (
                              <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white" title="Priority score (0–100)">
                                {r.score}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-ink">{r.recommendation}</p>
                          <p className="mt-0.5 text-xs text-slate-500">Why: {r.trigger}</p>
                          <p className="mt-1 text-xs font-semibold text-brand-700">Owner: {r.owner}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState title="On track" hint="No recommended follow-ups for this student." />
            )}
          </Card>

          <Card className="p-6">
            <SectionTitle title="Open tasks" icon={ListTodo} />
            {tasks.length ? (
              <ul className="space-y-2.5">
                {tasks.map((task) => (
                  <li key={task.id} className="rounded-xl border border-slate-100 p-3">
                    <p className="text-sm font-semibold text-ink">{task.title}</p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="text-xs text-slate-500">{task.owner_role}</span>
                      <StatusBadge value={task.overdue ? "Overdue" : task.status} dot={false} />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">Due {formatDate(task.due_at)} · {relativeDays(task.due_at)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No tasks" />
            )}
          </Card>

          <Card className="p-6">
            <SectionTitle title="Panel" icon={Users} />
            {panel.length ? (
              <ul className="space-y-2.5">
                {panel.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{p.faculty_name}</p>
                      <p className="text-xs text-slate-500">{p.panel_role}</p>
                    </div>
                    <span className="rounded-lg bg-brand-50 px-2 py-1 text-xs font-bold text-brand-700">{p.score}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No panel assigned" />
            )}
          </Card>

          <Card className="p-6">
            <SectionTitle title="Defense schedule" icon={CalendarCheck} />
            {schedules.length ? (
              <ul className="space-y-2.5">
                {schedules.map((s) => (
                  <li key={s.id} className="rounded-xl border border-slate-100 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-ink">{formatDate(s.preferred_date)}</p>
                      <StatusBadge value={s.status} dot={false} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {s.mode} · {s.venue}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No schedule requests" />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function WorkflowRecordsCard({ practicum, withdrawal, graduation, eligibility, hasPracticum }) {
  const rows = [];
  if (hasPracticum) {
    rows.push({
      key: "practicum",
      icon: Briefcase,
      label: "Practicum",
      status: practicum?.status || "Missing",
      detail: practicum ? `${practicum.completed_hours}/${practicum.required_hours} hours · ${practicum.document_status}` : "No practicum record",
    });
  }
  rows.push({
    key: "withdrawal",
    icon: LogOut,
    label: "Withdrawal",
    status: withdrawal?.status || "No request",
    detail: withdrawal ? `Dean: ${withdrawal.dean_decision} · fees: ${withdrawal.fee_status}` : "No active withdrawal request",
  });
  rows.push({
    key: "graduation",
    icon: GraduationCap,
    label: "Graduation",
    status: graduation?.endorsement_status || eligibility?.status || "Needs verification",
    detail: graduation ? `${graduation.review_window} · ${graduation.endorsement_status}` : eligibility?.next_action || "No endorsement record",
  });
  return (
    <Card className="p-6">
      <SectionTitle title="Workflow status" icon={FileText} />
      <ul className="space-y-2.5">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <li key={row.key} className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                  <Icon className="h-4 w-4 text-brand-700" /> {row.label}
                </span>
                <StatusBadge value={row.status} dot={false} />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{row.detail}</p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function AuditStat({ label, value, tone }) {
  const tones = {
    brand: "text-brand-700 bg-brand-50",
    blue: "text-blue-700 bg-blue-50",
    amber: "text-amber-700 bg-amber-50",
    red: "text-red-700 bg-red-50",
  };
  return (
    <div className={`rounded-xl p-3 ${tones[tone]}`}>
      <p className="font-display text-2xl font-semibold leading-none">{value}</p>
      <p className="mt-1 text-xs font-semibold">{label}</p>
    </div>
  );
}

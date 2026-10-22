import { Link, useParams } from "react-router-dom";
import {
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
  UserRound,
} from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Button, Card, DataTable, EmptyState, HistoryPanel, PageHeader, SectionCard, Spinner, StatCard, StatusChip, Stepper } from "../components/ui/index.js";
import { ProgressBar } from "../components/ui";
import { formatDate, relativeDays, SEVERITY } from "../lib/format";
import { activityTitle } from "../lib/staffHome.js";

// The server's severity words stand in for status words on the recommendation chips.
const SEVERITY_TONE = { high: "danger", medium: "warning", low: "success" };

const ENROLLMENT_COLUMNS = [
  {
    key: "course_code",
    header: "Subject",
    cell: (item) => (
      <>
        <p className="font-semibold text-ink">{item.course_code}</p>
        <p className="meta">{item.course_title}</p>
      </>
    ),
  },
  { key: "term_label", header: "Semester" },
  {
    key: "status",
    header: "Status",
    cell: (item) => (
      <>
        <StatusChip status={item.status} dot={false} />
        {item.academic_record_effect && <p className="mt-1 text-xs font-semibold text-brand-700">{item.academic_record_effect}</p>}
      </>
    ),
  },
];

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
  // one step per lifecycle stage: done before the current one, current, then the ones still ahead
  const stageSteps = stages.map((stage, i) => ({
    key: stage,
    label: stage,
    state: i < stage_index ? "complete" : i === stage_index ? "current" : "upcoming",
  }));
  const logEntries = logs.map((log) => ({
    id: log.id,
    title: activityTitle(log.result),
    at: log.created_at,
    actor: log.actor_role,
    from: log.previous_status,
    to: log.new_status,
    note: [`Next: ${log.next_owner || "—"}`, log.notes].filter(Boolean).join("\n"),
  }));

  return (
    <div className="page-stack animate-fade-up">
      <PageHeader
        back={{ to: "/students", label: "Back to students" }}
        title={student.name}
        description={`${student.student_number} · ${student.program_name}`}
        icon={UserRound}
      />

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          {student.monitoring_new_student && (
            <StatusChip status="New Student" tone="success" dot={false} label={<><UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> New Student</>} />
          )}
          {student.enrollment_tag && <StatusChip status={student.enrollment_tag} dot={false} />}
          <StatusChip status={student.standing} dot={false} />
          <StatusChip status={student.risk_level} />
          <StatusChip
            status={student.adviser_name || "No adviser"}
            tone="neutral"
            dot={false}
            label={<><GraduationCap className="h-3.5 w-3.5" aria-hidden="true" /> {student.adviser_name || "No adviser"}</>}
          />
          <span className="meta inline-flex min-w-0 items-center gap-1.5 break-all sm:ml-2">
            <Mail className="h-4 w-4 shrink-0" aria-hidden="true" /> {student.email}
          </span>
        </div>

        <HistoryPanel className="mt-4" label="View stage history" hideLabel="Hide stage history" count={stages.length}>
          <section aria-label="Student lifecycle stage history">
            <Stepper title="Lifecycle progress" steps={stageSteps} />
          </section>
        </HistoryPanel>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Main column */}
        <div className="page-stack min-w-0">
          <SectionCard title="Course audit" subtitle="Completed, current, and missing subjects vs curriculum" icon={ClipboardCheck}>
            <div className="flex flex-wrap gap-2">
              <Button
                as={Link}
                to={`/enrollment?program_id=${student.program_id}&student_id=${student.id}${data.current_term?.id ? `&term_id=${data.current_term.id}` : ""}`}
                variant="secondary"
                icon={BookPlus}
              >
                Manage enrollment
              </Button>
              <Button as={Link} to={`/assistant?${auditAssistantParams.toString()}`} variant="secondary" icon={Bot}>
                Ask eligibility
              </Button>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-700">Coursework completion</span>
                <span className="font-semibold text-brand-700">{course_audit.completion_rate}%</span>
              </div>
              <ProgressBar value={course_audit.completion_rate} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard size="sm" label="Completed" value={course_audit.completed.length} tone="success" />
              <StatCard size="sm" label="Current" value={course_audit.current.length} tone="info" />
              <StatCard size="sm" label="Incomplete" value={course_audit.incomplete.length} tone="warning" />
              <StatCard size="sm" label="Missing" value={course_audit.missing.length} tone="danger" />
            </div>

            {/* Units + per-category subtotals */}
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-700">Units completed</span>
                <span className="font-semibold text-brand-700">
                  {course_audit.completed_units} / {course_audit.total_units} units ({course_audit.units_rate}%)
                </span>
              </div>
              <ProgressBar value={course_audit.units_rate} />
              {course_audit.by_category?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {course_audit.by_category.map((cat) => (
                    <span key={cat.category} className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                      {cat.category}
                      <span className="font-normal text-slate-500">{cat.completed_units}/{cat.total_units}u</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Eligibility (unit-driven) */}
            {course_audit.eligibility && (
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <p className="eyebrow mb-2">Eligibility (requires all {course_audit.total_units} units)</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["Comprehensive Exam", course_audit.eligibility.comprehensive],
                    ["Final Proposal", course_audit.eligibility.final_proposal],
                    ["Thesis / Title Defense", course_audit.eligibility.thesis],
                  ].map(([label, ok]) => (
                    <StatusChip key={label} status={ok ? "Eligible" : "Not yet"} tone="neutral" label={`${label} · ${ok ? "Eligible" : "Not yet"}`} />
                  ))}
                </div>
              </div>
            )}
            {(course_audit.missing.length > 0 || course_audit.incomplete.length > 0) && (
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                <p className="eyebrow mb-2">Outstanding subjects</p>
                <ul className="space-y-1.5">
                  {[...course_audit.incomplete, ...course_audit.missing].slice(0, 8).map((row) => (
                    <li key={row.code} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 text-slate-700">
                        <span className="font-semibold">{row.code}</span> · {row.title}
                      </span>
                      <StatusChip status={row.status} dot={false} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {subject_enrollments.length > 0 && (
              <HistoryPanel label="View enrollment history" hideLabel="Hide enrollment history" count={subject_enrollments.length}>
                <DataTable
                  caption="Subject enrollment history"
                  columns={ENROLLMENT_COLUMNS}
                  rows={subject_enrollments}
                  rowKey="id"
                  dense
                  stickyHeader
                  pageSize={0}
                />
              </HistoryPanel>
            )}
          </SectionCard>

          {/* Research case + documents */}
          <SectionCard title="Research case & evidence" subtitle="Milestone gate and required document checklist" icon={FlaskConical}>
            {research_case ? (
              <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">{research_case.title}</p>
                    <p className="meta">
                      {research_case.case_type} · current gate: {research_case.current_gate}
                    </p>
                  </div>
                  <StatusChip status={research_case.status} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No research case opened yet.</p>
            )}

            {Object.keys(documents_by_gate).length ? (
              <div className="space-y-4">
                {Object.entries(documents_by_gate).map(([gate, docs]) => (
                  <div key={gate}>
                    <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                      <FileText className="h-4 w-4 text-slate-500" aria-hidden="true" /> {gate}
                    </p>
                    <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {docs.map((doc) => (
                        <li key={doc.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm">
                          <span className="truncate text-slate-600">{doc.item_name}</span>
                          <StatusChip status={doc.status} dot={false} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState size="sm" title="No document checks recorded" />
            )}
          </SectionCard>

          {/* Timeline */}
          <SectionCard title="Activity timeline" subtitle="What happened, by whom, and when" icon={Clock}>
            {logs.length ? (
              <HistoryPanel entries={logEntries} label="View logs" hideLabel="Hide logs" />
            ) : (
              <EmptyState size="sm" title="No recorded activity" />
            )}
          </SectionCard>
        </div>

        {/* Side column */}
        <div className="page-stack min-w-0">
          <WorkflowRecordsCard
            practicum={practicum_record}
            withdrawal={withdrawal_application}
            graduation={graduation_endorsement}
            eligibility={graduation_eligibility}
            hasPracticum={student.program_has_practicum}
          />

          <SectionCard title="Recommended actions" subtitle="Computed from this record" icon={Lightbulb}>
            {recommendations.length ? (
              <ul className="space-y-2.5">
                {recommendations.map((r, i) => {
                  const sev = SEVERITY[r.severity] || SEVERITY.low;
                  return (
                    <li key={i} className="overflow-hidden rounded-xl border border-slate-100">
                      <div className="flex">
                        <span className={`w-1 shrink-0 ${sev.bar}`} aria-hidden="true" />
                        <div className="min-w-0 p-3">
                          <div className="mb-1 flex items-center gap-2">
                            <StatusChip status={sev.label} tone={SEVERITY_TONE[r.severity] || "success"} dot={false} size="sm" />
                            {typeof r.score === "number" && (
                              <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-2xs font-semibold text-white" title="Priority score (0–100)">
                                {r.score}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-ink">{r.recommendation}</p>
                          <p className="meta mt-0.5">Why: {r.trigger}</p>
                          <p className="mt-1 text-xs font-semibold text-brand-700">Owner: {r.owner}</p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState size="sm" title="On track" hint="No recommended follow-ups for this student." />
            )}
          </SectionCard>

          <SectionCard title="Open tasks" icon={ListTodo}>
            {tasks.length ? (
              <ul className="space-y-2.5">
                {tasks.map((task) => (
                  <li key={task.id} className="rounded-xl border border-slate-100 p-3">
                    <p className="text-sm font-semibold text-ink">{task.title}</p>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span className="meta">{task.owner_role}</span>
                      <StatusChip status={task.overdue ? "Overdue" : task.status} dot={false} />
                    </div>
                    <p className="meta mt-1">Due {formatDate(task.due_at)} · {relativeDays(task.due_at)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState size="sm" title="No tasks" />
            )}
          </SectionCard>

          <SectionCard title="Panel" icon={Users}>
            {panel.length ? (
              <ul className="space-y-2.5">
                {panel.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{p.faculty_name}</p>
                      <p className="meta">{p.panel_role}</p>
                    </div>
                    <span className="rounded-lg bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">{p.score}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState size="sm" title="No panel assigned" />
            )}
          </SectionCard>

          <SectionCard title="Defense schedule" icon={CalendarCheck}>
            {schedules.length ? (
              <ul className="space-y-2.5">
                {schedules.map((s) => (
                  <li key={s.id} className="rounded-xl border border-slate-100 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">{formatDate(s.preferred_date)}</p>
                      <StatusChip status={s.status} dot={false} />
                    </div>
                    <p className="meta mt-1">
                      {s.mode} · {s.venue}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState size="sm" title="No schedule requests" />
            )}
          </SectionCard>
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
    <SectionCard title="Workflow status" icon={FileText}>
      <ul className="space-y-2.5">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <li key={row.key} className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                  <Icon className="h-4 w-4 text-brand-700" aria-hidden="true" /> {row.label}
                </span>
                <StatusChip status={row.status} dot={false} />
              </div>
              <p className="meta mt-1 leading-relaxed">{row.detail}</p>
            </li>
          );
        })}
      </ul>
    </SectionCard>
  );
}

import { useEffect, useState } from "react";
import { GraduationCap, LogOut, Users, CalendarClock, BookOpen, Clock3, ClipboardCheck, AlertTriangle, LayoutDashboard, FileCheck, Printer } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { useAuth } from "../auth";
import { Card, SectionTitle, Spinner, StatusBadge, EmptyState, ErrorNote } from "../components/ui";
import { formatDate } from "../lib/format";
import { printDataTable } from "../lib/print";
import FacultyResearchWorkspace from "../components/FacultyResearchWorkspace";
import RoleSidebar from "../components/RoleSidebar";

const FACULTY_NAV = [
  { id: "overview", label: "Dashboard / Overview", icon: LayoutDashboard },
  { id: "grades", label: "Class Grades", icon: ClipboardCheck },
  { id: "research", label: "Advisees & Research", icon: FileCheck },
  { id: "panels", label: "Panel Assignments", icon: Users },
  { id: "availability", label: "My Availability", icon: Clock3 },
];

export default function FacultyPortal() {
  const { user, logout } = useAuth();
  const { data, loading, error, refetch } = useApi(() => api.facultyPortalContext(), []);
  const [view, setView] = useState("overview");

  const faculty = data?.faculty;
  const panels = data?.panels || [];
  const availability = data?.availability || [];

  return (
    <div className="min-h-screen bg-canvas lg:flex">
      <RoleSidebar roleLabel="Faculty Portal" items={FACULTY_NAV} active={view} onChange={setView} />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 lg:px-8">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white shadow-sm">
              <GraduationCap className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-sm font-semibold text-ink sm:text-base">USLS Graduate School</p>
              <p className="text-xs font-semibold uppercase text-brand-700">Faculty Portal</p>
            </div>
            <span className="ml-auto hidden rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 sm:inline-flex">
              {user?.full_name || "Faculty"}
            </span>
            <button
              type="button"
              onClick={logout}
              className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 lg:px-8 lg:py-8">
          <div className="space-y-5 animate-fade-up">
            {loading ? (
              <Card className="p-6"><Spinner label="Loading faculty portal..." /></Card>
            ) : error ? (
              <Card className="p-6"><ErrorNote message={error} /></Card>
            ) : (
              <>
                <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-brand-600">Signed in as faculty</p>
                  <h1 className="mt-1 font-display text-2xl font-semibold text-ink">{faculty?.name}</h1>
                  <p className="mt-1 text-sm text-slate-600">{faculty?.specialization}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusBadge value={faculty?.college || "College"} dot={false} />
                    <StatusBadge value={`${panels.length} panel${panels.length === 1 ? "" : "s"}`} dot={false} />
                  </div>
                </div>

                {view === "overview" && (
                  <FacultyOverview
                    alerts={data?.grade_alerts || []}
                    advisees={data?.advisees || []}
                    panels={panels}
                    availability={availability}
                    onNavigate={setView}
                  />
                )}

                {view === "grades" && (
                  <Card className="p-6">
                    <FacultyGrades subjects={data?.subjects || []} terms={data?.terms || []} alerts={data?.grade_alerts || []} />
                  </Card>
                )}

                {view === "research" && (
                  <FacultyResearchWorkspace advisees={data?.advisees || []} panels={panels} refetch={refetch} />
                )}

                {view === "panels" && (
                  <Card className="p-6">
                    <SectionTitle title="My panel assignments" subtitle="Students whose committee you sit on" icon={Users} />
                    {panels.length === 0 ? (
                      <EmptyState icon={Users} title="No panels yet" hint="You will appear here once the Research Coordinator matches you to a student's panel." />
                    ) : (
                      <div className="mt-3 space-y-3">
                        {panels.map((p, i) => (
                          <div key={i} className="rounded-xl border border-slate-200 p-4">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-semibold text-ink">{p.student?.name}</p>
                                <p className="text-xs text-slate-500">{p.student?.program_code} · {p.stage}</p>
                              </div>
                              <StatusBadge value={p.panel_role} dot={false} />
                            </div>
                            <p className="mt-2 flex items-start gap-1.5 text-sm text-slate-600">
                              <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                              <span>{p.research_title || "Research title pending"}</span>
                            </p>
                            {p.defense ? (
                              <p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-brand-700">
                                <CalendarClock className="h-4 w-4" />
                                {p.defense.defense_type} — {formatDate(p.defense.preferred_date)}
                                {p.defense.start_time ? ` · ${p.defense.start_time}` : ""}
                                {p.defense.mode ? ` · ${p.defense.mode}` : ""}
                                <StatusBadge value={p.defense.status} dot={false} />
                              </p>
                            ) : (
                              <p className="mt-2 text-xs text-slate-400">No defense scheduled yet.</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}

                {view === "availability" && (
                  <Card className="p-6">
                    <SectionTitle title="My availability" subtitle="Upcoming windows used for defense scheduling" icon={Clock3} />
                    {availability.length === 0 ? (
                      <EmptyState icon={Clock3} title="No availability recorded" hint="Availability windows are managed with the Graduate School office." />
                    ) : (
                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {availability.map((slot, i) => (
                          <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                            <CalendarClock className="h-4 w-4 text-brand-600" />
                            <span className="font-semibold text-ink">{formatDate(slot.date)}</span>
                            <span className="ml-auto text-slate-500">{slot.start}–{slot.end}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function FacultyOverview({ alerts, advisees, panels, availability, onNavigate }) {
  const stats = [
    { label: "Panel assignments", value: panels.length, view: "panels", icon: Users },
    { label: "Advisees", value: advisees.length, view: "research", icon: FileCheck },
    { label: "Availability windows", value: availability.length, view: "availability", icon: Clock3 },
  ];
  return (
    <div className="space-y-5">
      {alerts.length > 0 && (
        <Card className="p-6">
          <SectionTitle title="Grade submission alerts" subtitle="Outstanding grade submissions for your classes" icon={AlertTriangle} />
          <div className="mt-3 space-y-2">
            {alerts.map((alert) => (
              <div key={alert.term_label} className={`flex gap-2 rounded-xl border px-3 py-2 text-sm ${alert.coordinator_escalated ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{alert.missing_grades} grade{alert.missing_grades === 1 ? "" : "s"} missing for {alert.term_label}. Deadline: {formatDate(alert.deadline)}.{alert.coordinator_escalated ? " The Academic Coordinator has been alerted." : " Please submit before the deadline."}</span>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => onNavigate("grades")} className="btn-primary mt-4 cursor-pointer">Go to Class Grades</button>
        </Card>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <button key={stat.label} type="button" onClick={() => onNavigate(stat.view)} className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 text-left transition-colors hover:border-brand-200 hover:bg-brand-50">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon className="h-5 w-5" /></span>
              <p className="mt-3 font-display text-2xl font-semibold text-ink">{stat.value}</p>
              <p className="text-sm text-slate-500">{stat.label}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FacultyGrades({ subjects, terms, alerts }) {
  const activeTerm = terms.find((term) => term.is_active_planning_term) || terms[0];
  const [term, setTerm] = useState(activeTerm?.label || "");
  const [courseId, setCourseId] = useState(subjects[0]?.id || "");
  const [roster, setRoster] = useState(null);
  const [edits, setEdits] = useState({});
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!term && activeTerm) setTerm(activeTerm.label); }, [activeTerm, term]);
  useEffect(() => { if (!courseId && subjects.length) setCourseId(subjects[0].id); }, [courseId, subjects]);
  useEffect(() => {
    if (!courseId || !term) return;
    api.courseAuditRoster(courseId, term).then((res) => {
      setRoster(res);
      setEdits(Object.fromEntries(res.students.map((student) => [student.student_id, { grade: student.grade_value || "", remarks: student.remarks || "" }])));
    }).catch((err) => setNotice(err.message));
  }, [courseId, term]);

  function change(id, field, value) { setEdits((current) => ({ ...current, [id]: { ...current[id], [field]: value } })); }
  async function submit() {
    setSaving(true); setNotice("");
    try {
      const statuses = {}; const grades = {}; const gradeStatuses = {}; const remarks = {};
      roster.students.forEach((student) => {
        const value = (edits[student.student_id]?.grade || "").trim();
        const normalized = value.toUpperCase();
        statuses[student.student_id] = !value ? "Current" : normalized === "INC" ? "Incomplete" : ["F", "5", "5.0", "5.00"].includes(normalized) ? "Failed" : "Completed";
        grades[student.student_id] = value;
        gradeStatuses[student.student_id] = statuses[student.student_id] === "Completed" ? "Passed" : statuses[student.student_id];
        remarks[student.student_id] = edits[student.student_id]?.remarks || "";
      });
      const res = await api.saveCourseAudit({ course_id: Number(courseId), term, statuses, grades, grade_statuses: gradeStatuses, remarks });
      setNotice(res.message);
    } catch (err) { setNotice(err.message); } finally { setSaving(false); }
  }

  function printGrades() {
    if (!roster) return;
    printDataTable({
      title: `${roster.course.code} - ${roster.course.title} Grade List`,
      subtitle: term,
      columns: ["Student ID", "Student name", "Program", "Grade", "Remarks"],
      rows: roster.students.map((student) => [student.student_number, student.name, student.program_code, edits[student.student_id]?.grade || "No grade", edits[student.student_id]?.remarks || ""]),
    });
  }

  return <div>
    <SectionTitle title="Submit class grades" subtitle="Choose a subject, then enter each student's final grade and optional remarks." icon={ClipboardCheck} />
    {alerts.map((alert) => <div key={alert.term_label} className={`mt-3 flex gap-2 rounded-xl border px-3 py-2 text-sm ${alert.coordinator_escalated ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{alert.missing_grades} grade{alert.missing_grades === 1 ? "" : "s"} missing for {alert.term_label}. Deadline: {formatDate(alert.deadline)}.{alert.coordinator_escalated ? " The Academic Coordinator has been alerted." : " Please submit before the deadline."}</span></div>)}
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label><span className="field-label">Semester</span><select className="field-input cursor-pointer" value={term} onChange={(e) => setTerm(e.target.value)}>{terms.map((item) => <option key={item.id} value={item.label}>{item.label}</option>)}</select></label>
      <label><span className="field-label">Subject</span><select className="field-input cursor-pointer" value={courseId} onChange={(e) => setCourseId(e.target.value)}>{subjects.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.title}</option>)}</select></label>
    </div>
    {roster?.students?.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-slate-400"><th className="py-2">Student</th><th>Grade</th><th>Remarks</th></tr></thead><tbody>{roster.students.map((student) => <tr key={student.student_id} className="border-b border-slate-100"><td className="py-3 pr-3"><p className="font-semibold text-ink">{student.name}</p><p className="text-xs text-slate-500">{student.student_number}</p></td><td className="pr-3"><input className="field-input w-28" value={edits[student.student_id]?.grade || ""} onChange={(e) => change(student.student_id, "grade", e.target.value)} placeholder="1.25 / INC" /></td><td><input className="field-input" value={edits[student.student_id]?.remarks || ""} onChange={(e) => change(student.student_id, "remarks", e.target.value)} placeholder="Optional faculty remarks" /></td></tr>)}</tbody></table><div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={submit} disabled={saving} className="btn-primary cursor-pointer">{saving ? "Submitting..." : "Submit grades"}</button><button type="button" onClick={printGrades} className="btn-ghost cursor-pointer"><Printer className="h-4 w-4" /> Print grade list</button></div></div> : <EmptyState icon={ClipboardCheck} title="No students in this class" hint="The Academic Coordinator must add students to the subject roster first." />}
    {notice && <p className="mt-3 text-sm font-semibold text-brand-700">{notice}</p>}
  </div>;
}

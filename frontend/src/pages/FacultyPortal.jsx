import { useEffect, useState } from "react";
import { GraduationCap, LogOut, Users, CalendarClock, BookOpen, Clock3, ClipboardCheck, LayoutDashboard, FileCheck, Printer, Lock } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { useAuth } from "../auth";
import { Card, SectionTitle, Spinner, StatusBadge, EmptyState, ErrorNote } from "../components/ui";
import { formatDate } from "../lib/format";
import { printDataTable } from "../lib/print";
import FacultyResearchWorkspace from "../components/FacultyResearchWorkspace";
import RoleSidebar from "../components/RoleSidebar";

const FACULTY_NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { id: "overview", label: "Dashboard / Overview", icon: LayoutDashboard },
    ],
  },
  {
    label: "Assigned Workflows",
    items: [
      { id: "classes", number: 3, label: "Assigned Classes", icon: ClipboardCheck },
      { id: "research", number: 4, label: "Advisees & Research", icon: FileCheck },
      { id: "panels", number: 5, label: "Panel Assignments", icon: Users },
      { id: "availability", number: 6, label: "My Availability", icon: Clock3 },
    ],
  },
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
      <RoleSidebar roleLabel="Faculty Portal" groups={FACULTY_NAV_GROUPS} active={view} onChange={setView} />
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
                    advisees={data?.advisees || []}
                    panels={panels}
                    availability={availability}
                    onNavigate={setView}
                  />
                )}

                {view === "classes" && (
                  <Card className="p-6">
                    <FacultyClasses subjects={data?.subjects || []} terms={data?.terms || []} />
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

function FacultyOverview({ advisees, panels, availability, onNavigate }) {
  const stats = [
    { label: "Panel assignments", value: panels.length, view: "panels", icon: Users },
    { label: "Advisees", value: advisees.length, view: "research", icon: FileCheck },
    { label: "Availability windows", value: availability.length, view: "availability", icon: Clock3 },
  ];
  return (
    <div className="space-y-5">
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

function FacultyClasses({ subjects, terms }) {
  const activeTerm = terms.find((term) => term.is_active_planning_term) || terms[0];
  const [term, setTerm] = useState(activeTerm?.label || "");
  const [courseId, setCourseId] = useState(subjects[0]?.id || "");
  const [roster, setRoster] = useState(null);
  const [notice, setNotice] = useState("");

  useEffect(() => { if (!term && activeTerm) setTerm(activeTerm.label); }, [activeTerm, term]);
  useEffect(() => { if (!courseId && subjects.length) setCourseId(subjects[0].id); }, [courseId, subjects]);
  useEffect(() => {
    if (!courseId || !term) return;
    setNotice("");
    api.courseAuditRoster(courseId, term).then((res) => {
      setRoster(res);
    }).catch((err) => setNotice(err.message));
  }, [courseId, term]);

  function printRoster() {
    if (!roster) return;
    printDataTable({
      title: `${roster.course.code} - ${roster.course.title} Class Roster`,
      subtitle: term,
      columns: ["Student ID", "Student name", "Program", "Status", "Official grade", "Remarks"],
      rows: roster.students.map((student) => [student.student_number, student.name, student.program_code, student.status, student.grade_value || "No grade", student.remarks || ""]),
    });
  }

  return <div>
    <SectionTitle title="Assigned class rosters" subtitle="Review assigned subjects and students. Official grade data is read-only in the USLS portal." icon={ClipboardCheck} />
    <div className="mt-3 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <p>Grades and subject outcomes are encoded and maintained in their authorized source systems. The Monitoring Sheet is a synchronized, read-only view.</p>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label><span className="field-label">Semester</span><select className="field-input cursor-pointer" value={term} onChange={(e) => setTerm(e.target.value)}>{terms.map((item) => <option key={item.id} value={item.label}>{item.label}</option>)}</select></label>
      <label><span className="field-label">Subject</span><select className="field-input cursor-pointer" value={courseId} onChange={(e) => setCourseId(e.target.value)}>{subjects.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.title}</option>)}</select></label>
    </div>
    {roster?.students?.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-slate-400"><th className="py-2">Student</th><th>Status</th><th>Official grade</th><th>Remarks</th></tr></thead><tbody>{roster.students.map((student) => <tr key={student.student_id} className="border-b border-slate-100"><td className="py-3 pr-3"><p className="font-semibold text-ink">{student.name}</p><p className="text-xs text-slate-500">{student.student_number}</p></td><td className="pr-3"><StatusBadge value={student.status} dot={false} /></td><td className="pr-3 font-semibold text-slate-700">{student.grade_value || "No grade"}</td><td className="text-slate-500">{student.remarks || "—"}</td></tr>)}</tbody></table><div className="mt-4"><button type="button" onClick={printRoster} className="btn-ghost cursor-pointer"><Printer className="h-4 w-4" /> Print roster</button></div></div> : <EmptyState icon={ClipboardCheck} title="No students in this class" hint="The Academic Coordinator must add students through Enrollment first." />}
    {notice && <p className="mt-3 text-sm font-semibold text-red-700" role="alert">{notice}</p>}
  </div>;
}

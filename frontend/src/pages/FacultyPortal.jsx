import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { GraduationCap, LogOut, Users, CalendarClock, CalendarCheck2, CalendarDays, Eye, ShieldCheck, ExternalLink, X, BookOpen, Clock3, ClipboardCheck, LayoutDashboard, FileCheck, Printer, Lock } from "lucide-react";
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
  const [searchParams] = useSearchParams();

  const faculty = data?.faculty;
  const panels = data?.panels || [];
  const availability = data?.availability || [];
  const calendarNotice = searchParams.get("calendar");

  return (
    <div className="min-h-screen bg-canvas lg:flex">
      <RoleSidebar
        roleLabel="Faculty Portal"
        groups={FACULTY_NAV_GROUPS}
        active={view}
        onChange={setView}
        footer={faculty ? <FacultyCalendarConnection calendar={faculty.calendar} /> : null}
      />
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
                <div className="lg:hidden">
                  <FacultyCalendarConnection calendar={faculty?.calendar} />
                </div>
                {calendarNotice && (
                  <p
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                      calendarNotice === "connected"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                    role="status"
                  >
                    {calendarNotice === "connected"
                      ? "Google Calendar connected. Its busy periods are now used for defense scheduling."
                      : calendarNotice === "cancelled"
                        ? "Google Calendar connection was cancelled."
                        : "Google Calendar could not be connected. Please try again."}
                  </p>
                )}

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
                    <SectionTitle
                      title={faculty?.calendar?.connected ? "My connected calendar" : "My availability"}
                      subtitle={
                        faculty?.calendar?.connected
                          ? "Google Calendar busy periods that are excluded from defense scheduling"
                          : "Upcoming profile windows used for defense scheduling"
                      }
                      icon={Clock3}
                    />
                    {faculty?.calendar?.connected ? (
                      (faculty.calendar_events || []).length === 0 ? (
                        <EmptyState
                          icon={CalendarCheck2}
                          title="No busy periods in the next five weeks"
                          hint={faculty.calendar_event_status || "Your Google Calendar is connected and will be checked again when staff review defense dates."}
                        />
                      ) : (
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {(faculty.calendar_events || []).map((event, i) => (
                            <div key={`${event.date}-${event.start}-${i}`} className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                              <CalendarClock className="h-4 w-4 text-amber-700" />
                              <span className="font-semibold text-ink">{formatDate(event.date)}</span>
                              <span className="ml-auto text-slate-600">{event.start}â€“{event.end}</span>
                            </div>
                          ))}
                        </div>
                      )
                    ) : availability.length === 0 ? (
                      <EmptyState icon={Clock3} title="No availability recorded" hint="Connect Google Calendar or ask the Graduate School office to maintain profile availability." />
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

function FacultyCalendarConnection({ calendar }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewOpened, setPreviewOpened] = useState(false);
  const connected = Boolean(calendar?.connected);

  async function connectCalendar() {
    setBusy(true);
    setError("");
    try {
      const result = await api.googleCalendarAuthorization();
      if (result.mode === "preview") {
        setPreview(result);
        setBusy(false);
        return;
      }
      window.location.assign(result.authorization_url);
    } catch (err) {
      setError(err.message || "Could not start the Google Calendar connection.");
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-brand-200 bg-brand-50 p-3 shadow-sm" aria-label="Google Calendar connection">
      <div className="flex items-start gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-brand-700 ring-1 ring-brand-100">
          <CalendarCheck2 className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">Google Calendar</p>
          <p className={`mt-0.5 text-xs font-semibold ${connected ? "text-emerald-700" : previewOpened ? "text-brand-700" : "text-slate-500"}`}>
            {connected ? "Connected" : previewOpened ? "Integration preview opened" : "Not connected"}
          </p>
          {connected && calendar?.connected_email && (
            <p className="mt-0.5 truncate text-[11px] text-slate-500" title={calendar.connected_email}>{calendar.connected_email}</p>
          )}
        </div>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
        {connected
          ? "Busy classes, appointments, and personal events automatically block defense times."
          : "Connect once so staff checks your real busy times instead of the profile schedule."}
      </p>
      <button
        type="button"
        onClick={connectCalendar}
        disabled={busy}
        className="mt-3 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white transition-colors duration-200 hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 disabled:cursor-wait disabled:opacity-70"
      >
        <CalendarCheck2 className="h-4 w-4" />
        {busy ? "Opening Google..." : connected ? "Reconnect calendar" : "Connect Google Calendar"}
      </button>
      {error && <p className="mt-2 text-xs font-semibold leading-relaxed text-red-700" role="alert">{error}</p>}
      {preview && (
        <GoogleCalendarPreviewDialog
          preview={preview}
          opened={previewOpened}
          onOpened={() => setPreviewOpened(true)}
          onClose={() => setPreview(null)}
        />
      )}
    </section>
  );
}

function GoogleCalendarPreviewDialog({ preview, opened, onOpened, onClose }) {
  const primaryButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    primaryButtonRef.current?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = primaryButtonRef.current?.closest('[role="dialog"]');
      const focusable = dialog
        ? [...dialog.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')]
        : [];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  function openGoogleCalendar() {
    window.open(preview.calendar_url, "_blank", "noopener,noreferrer");
    onOpened();
  }

  const permissionIcons = [CalendarDays, Eye, ShieldCheck];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendar-preview-title"
        aria-describedby="calendar-preview-description"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="border-b border-slate-200 bg-gradient-to-r from-brand-800 to-brand-700 px-5 py-5 text-white">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/20">
              <CalendarCheck2 className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <span className="inline-flex rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ring-white/20">
                Integration preview
              </span>
              <h2 id="calendar-preview-title" className="mt-2 font-display text-xl font-semibold">
                Allow USLS Graduate School to use your calendar availability?
              </h2>
              <p id="calendar-preview-description" className="mt-1 text-sm leading-relaxed text-white/80">
                This previews the permission step faculty will complete when live Google OAuth is enabled.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg bg-white/10 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Close Google Calendar preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="space-y-4 px-5 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">How your calendar will be used</p>
            <div className="mt-3 space-y-2">
              {(preview.permissions || []).map((permission, index) => {
                const Icon = permissionIcons[index] || ShieldCheck;
                return (
                  <div key={permission} className="flex items-start gap-3 rounded-xl border border-slate-200 px-3.5 py-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <p className="pt-1 text-sm font-medium leading-relaxed text-slate-700">{permission}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Demo-safe preview</p>
            <p className="mt-1 text-xs leading-relaxed text-amber-900">
              Opening Google Calendar does not mark this account as connected and does not change Panel Matching or Defense Scheduling. The existing profile schedule remains active.
            </p>
          </div>

          {opened && (
            <p className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800" role="status">
              Google Calendar opened in a new tab. Return here to continue the system demonstration.
            </p>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="btn-ghost min-h-11 cursor-pointer justify-center px-4">
            Not now
          </button>
          <button
            ref={primaryButtonRef}
            type="button"
            onClick={openGoogleCalendar}
            className="btn-primary min-h-11 cursor-pointer justify-center px-4"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            {opened ? "Open Google Calendar again" : "Continue to Google Calendar"}
          </button>
        </footer>
      </section>
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

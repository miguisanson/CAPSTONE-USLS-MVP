import { GraduationCap, LogOut, Users, CalendarClock, BookOpen, Clock3 } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { useAuth } from "../auth";
import { Card, SectionTitle, Spinner, StatusBadge, EmptyState, ErrorNote } from "../components/ui";
import { formatDate } from "../lib/format";

export default function FacultyPortal() {
  const { user, logout } = useAuth();
  const { data, loading, error } = useApi(() => api.facultyPortalContext(), []);

  const faculty = data?.faculty;
  const panels = data?.panels || [];
  const availability = data?.availability || [];

  return (
    <div className="min-h-screen bg-canvas">
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
            </>
          )}
        </div>
      </main>
    </div>
  );
}

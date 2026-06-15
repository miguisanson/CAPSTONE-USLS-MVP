import { useMemo, useState } from "react";
import { BriefcaseBusiness, CalendarDays, Clock3, Link2Off, Search, UsersRound } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, EmptyState, Spinner, StatusBadge } from "../components/ui";
import { formatDate, initials } from "../lib/format";

export default function Faculty() {
  const { data, loading, error } = useApi(() => api.faculty(), []);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const faculty = data?.items || [];
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return faculty;
    return faculty.filter((item) =>
      [item.name, item.college, item.role, item.specialization].some((value) => value?.toLowerCase().includes(needle))
    );
  }, [faculty, query]);
  const selected = faculty.find((item) => item.id === selectedId) || filtered[0];

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Faculty</h1>
        <p className="mt-1 text-sm text-slate-500">Expertise, panel load, working hours, and dated availability used by panel matching and defense scheduling.</p>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <Spinner label="Loading faculty profiles..." />
        ) : error ? (
          <EmptyState icon={UsersRound} title="Could not load faculty" hint={error} />
        ) : (
          <div className="grid min-h-[620px] grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
            <section className="border-b border-slate-200 lg:border-b-0 lg:border-r">
              <div className="border-b border-slate-100 p-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} className="field-input pl-10" placeholder="Search faculty, college, or expertise" aria-label="Search faculty" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-3">Faculty</th>
                      <th className="px-3 py-3">Expertise</th>
                      <th className="px-3 py-3 text-right">Panel load</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item) => (
                      <tr key={item.id} onClick={() => setSelectedId(item.id)} className={`cursor-pointer border-b border-slate-50 transition-colors hover:bg-brand-50/50 ${selected?.id === item.id ? "bg-brand-50/70" : ""}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{initials(item.name)}</span>
                            <div>
                              <p className="font-semibold text-ink">{item.name}</p>
                              <p className="text-xs text-slate-500">{item.college}</p>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-64 px-3 py-3 text-slate-600">{item.specialization}</td>
                        <td className="px-3 py-3 text-right"><span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">{item.panel_load}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && <EmptyState icon={Search} title="No faculty match" hint="Try a broader search term." />}
              </div>
            </section>

            <aside className="p-5 lg:p-6">
              {selected ? <FacultyProfile faculty={selected} /> : <EmptyState icon={UsersRound} title="Choose a faculty profile" />}
            </aside>
          </div>
        )}
      </Card>
    </div>
  );
}

function FacultyProfile({ faculty }) {
  const activeDays = faculty.working_hours.filter((day) => day.enabled);
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-600 font-bold text-white">{initials(faculty.name)}</span>
        <div>
          <h2 className="text-lg font-semibold text-ink">{faculty.name}</h2>
          <p className="text-sm text-slate-500">{faculty.role}</p>
          <p className="mt-1 text-xs font-semibold text-brand-700">{faculty.college}</p>
        </div>
      </div>

      <ProfileSection icon={BriefcaseBusiness} title="Specialization">
        <p className="text-sm leading-relaxed text-slate-600">{faculty.specialization}</p>
        <div className="mt-2"><StatusBadge value={`${faculty.panel_load} active panel assignment${faculty.panel_load === 1 ? "" : "s"}`} dot={false} /></div>
      </ProfileSection>

      <ProfileSection icon={Clock3} title="Working hours">
        <div className="space-y-1.5">
          {faculty.working_hours.map((day) => (
            <div key={day.weekday} className="flex items-center justify-between text-sm">
              <span className={day.enabled ? "font-medium text-slate-700" : "text-slate-400"}>{day.day}</span>
              <span className={day.enabled ? "text-slate-600" : "font-medium text-slate-400"}>{day.enabled ? `${day.start}-${day.end}` : "Unavailable"}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">{activeDays.length} recurring workdays. Weekend slots require a dated override.</p>
      </ProfileSection>

      <ProfileSection icon={CalendarDays} title="Upcoming availability">
        {faculty.upcoming_availability.length ? (
          <div className="space-y-2">
            {faculty.upcoming_availability.slice(0, 6).map((slot, index) => (
              <div key={`${slot.date}-${slot.start}-${index}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="font-medium text-slate-700">{formatDate(slot.date)}</span>
                <span className="text-slate-500">{slot.start}-{slot.end}{slot.weekend_override ? " · Weekend override" : ""}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-slate-500">No dated availability recorded.</p>}
      </ProfileSection>

      <ProfileSection icon={Link2Off} title="Calendar connection">
        <p className="text-sm text-slate-600">Google Calendar is not connected. The scheduling engine currently uses recorded profile hours and availability slots.</p>
      </ProfileSection>
    </div>
  );
}

function ProfileSection({ icon: Icon, title, children }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-brand-700" />
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
      </div>
      {children}
    </section>
  );
}

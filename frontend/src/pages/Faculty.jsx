import { useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness, Building2, CalendarDays, ChevronLeft,
  ChevronRight, ExternalLink, FileSearch, Link2, Mail, Search, UsersRound, BookOpenCheck, Save,
  Pencil, Plus, Trash2, Microscope,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { useApi } from "../hooks";
import { Button, Card, DataTable, Field, InlineNotice, Input, Modal, PageHeader, SearchInput, Select, Spinner, StatusChip, Textarea } from "../components/ui/index.js";
import { initials } from "../lib/format";
import FacultyAssignmentProfile from "../components/FacultyAssignmentProfile";
import { useConfirm } from "../components/confirm";

const FACULTY_ROLE_OPTIONS = ["Faculty Adviser", "Panel Member", "Panel Chair", "Academic Coordinator", "Research Coordinator"];
const AVAILABILITY_OPTIONS = ["Available", "Unavailable", "Not entered", "Google Calendar connected"];
const STATUS_OPTIONS = ["Active", "Inactive"];

export default function Faculty() {
  const { user } = useAuth();
  const canManage = ["staff", "academic_coordinator"].includes(user?.role);
  const { data, loading, error, refetch } = useApi(() => api.faculty(), []);
  const [notice, setNotice] = useState("");
  const [formFor, setFormFor] = useState(null); // null = closed, "new" = add form, faculty object = edit form
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState(""); // "" = all departments
  const [availability, setAvailability] = useState(""); // "" = all availability
  const faculty = data?.items || [];
  const requestedId = Number(params.get("faculty")) || null;
  const [selectedId, setSelectedId] = useState(requestedId);

  useEffect(() => {
    if (requestedId) setSelectedId(requestedId);
  }, [requestedId]);

  const departments = useMemo(() => [...new Set(faculty.map((item) => item.college))].sort(), [faculty]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return faculty.filter((item) => {
      const matchesText = !needle || [item.name, item.college, item.role, item.specialization, item.email, item.account?.email, ...(item.matching_keywords || [])]
        .some((value) => value?.toLowerCase().includes(needle));
      return matchesText
        && (!department || item.college === department)
        && (!availability || item.availability_status === availability);
    });
  }, [faculty, query, department, availability]);
  const selected = faculty.find((item) => item.id === selectedId) || null;

  function selectFaculty(id) {
    setSelectedId(id);
    const next = new URLSearchParams(params);
    next.set("faculty", String(id));
    setParams(next, { replace: true });
  }

  function closeFaculty() {
    setSelectedId(null);
    const next = new URLSearchParams(params);
    next.delete("faculty");
    setParams(next, { replace: true });
  }

  const columns = [
    {
      key: "name",
      header: "Faculty",
      cell: (item) => (
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">{initials(item.name)}</span>
          <div className="min-w-0">
            <button type="button" onClick={() => selectFaculty(item.id)} className="block max-w-full cursor-pointer truncate text-left font-semibold text-ink hover:text-brand-700 hover:underline focus-visible:ring-2 focus-visible:ring-brand-400">{item.name}</button>
            <p className="meta truncate" title={item.account?.email || item.email}>{item.role} · {item.account?.email || item.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "college",
      header: "Department / specialization",
      hideBelow: "lg",
      className: "max-w-xs text-slate-600",
      cell: (item) => (
        <>
          <p className="meta truncate font-semibold" title={item.college}>{item.college}</p>
          <p className="line-clamp-2" title={item.specialization}>{item.specialization}</p>
        </>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (item) => (
        <div className="flex flex-col items-start gap-1">
          <StatusChip status={item.active ? "Active" : "Inactive"} dot={false} />
          <StatusChip status={item.account?.active ? "Active login" : "No account"} dot={false} />
        </div>
      ),
    },
    { key: "availability_status", header: "Availability", hideBelow: "md", cell: (item) => <AvailabilityBadge faculty={item} /> },
    {
      key: "panel_load",
      header: "Panel load",
      align: "right",
      cell: (item) => <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{item.panel_load}</span>,
    },
    canManage && {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (item) => (
        <Button variant="secondary" size="sm" icon={Pencil} onClick={() => { setNotice(""); setFormFor(item); }}>Edit</Button>
      ),
    },
  ].filter(Boolean);

  return (
    <div className="page-stack animate-fade-up">
      <PageHeader
        title="Faculty Profiles"
        description="Search the faculty directory, then open a profile to review expertise, login email, panel load, and the availability the faculty member has entered."
        actions={canManage ? <Button icon={Plus} onClick={() => { setNotice(""); setFormFor("new"); }}>Add faculty</Button> : null}
      />
      {notice && <InlineNotice tone="success">{notice}</InlineNotice>}

      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchInput
            value={query}
            onChange={setQuery}
            label="Search faculty"
            placeholder="Search by name, department, or specialization…"
            className="flex-1"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select aria-label="Filter by department" placeholder="All departments" value={department} onChange={(event) => setDepartment(event.target.value)} options={departments} />
            <Select aria-label="Filter by availability" placeholder="All availability" value={availability} onChange={(event) => setAvailability(event.target.value)} options={AVAILABILITY_OPTIONS} />
          </div>
        </div>
      </Card>

      {loading ? (
        <Card><Spinner label="Loading faculty profiles…" /></Card>
      ) : error ? (
        <InlineNotice tone="danger" title="Could not load faculty">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button variant="secondary" size="sm" onClick={refetch}>Try again</Button>
          </div>
        </InlineNotice>
      ) : (
        <div className="space-y-3">
          {filtered.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-500">Showing <span className="font-semibold text-ink">{filtered.length}</span> of <span className="font-semibold text-ink">{faculty.length}</span> faculty</p>
              <p className="meta">Select a faculty member to open their profile</p>
            </div>
          )}
          <DataTable
            caption="Faculty directory"
            columns={columns}
            rows={filtered}
            rowKey="id"
            onRowClick={(item) => selectFaculty(item.id)}
            minWidth="md"
            pageSize={0}
            empty={{ icon: Search, title: "No faculty match your filters", hint: "Try a broader search or change a filter." }}
          />
        </div>
      )}

      {formFor && <FacultyFormModal faculty={formFor === "new" ? null : formFor} onClose={() => setFormFor(null)} onSaved={async (message) => { setFormFor(null); setNotice(message); await refetch(); }} />}
      {selected && <FacultyProfileModal faculty={selected} courses={data?.courses || []} onSaved={refetch} onClose={closeFaculty} />}
    </div>
  );
}

function FacultyFormModal({ faculty, onClose, onSaved }) {
  const isNew = !faculty;
  const [form, setForm] = useState(() => ({
    full_name: faculty?.name || "",
    department: faculty?.college || "",
    specialization: faculty?.specialization || "",
    email: faculty?.email || "",
    status: faculty ? (faculty.active ? "Active" : "Inactive") : "Active",
    password: "",
    eligible_roles: faculty?.eligible_roles || ["Faculty Adviser", "Panel Member", "Panel Chair"],
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const toggleRole = (role) => set("eligible_roles", form.eligible_roles.includes(role) ? form.eligible_roles.filter((item) => item !== role) : [...form.eligible_roles, role]);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!form.full_name.trim() || !form.department.trim() || !form.specialization.trim() || !form.email.trim()) {
      setError("Enter the name, department, specialization, and email.");
      return;
    }
    if (!form.eligible_roles.length) {
      setError("Choose at least one role this faculty member can take.");
      return;
    }
    if (isNew && form.password.length < 8) {
      setError("The temporary password must be at least 8 characters.");
      return;
    }
    if (!isNew && form.password && form.password.length < 8) {
      setError("The new password must be at least 8 characters.");
      return;
    }
    const payload = {
      full_name: form.full_name.trim(),
      department: form.department.trim(),
      specialization: form.specialization.trim(),
      email: form.email.trim(),
      status: form.status,
      eligible_roles: form.eligible_roles,
    };
    setBusy(true);
    try {
      let res;
      if (isNew) res = await api.createFaculty({ ...payload, temporary_password: form.password });
      else res = await api.updateFaculty(faculty.id, form.password ? { ...payload, new_password: form.password } : payload);
      await onSaved(res.message || (isNew ? "Faculty member added." : "Faculty member updated."));
    } catch (err) {
      setError(err.message || "Could not save the faculty member.");
      setBusy(false);
    }
  }

  return (
    <Modal
      title={isNew ? "Add faculty" : `Edit ${faculty.name}`}
      size="md"
      onClose={onClose}
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" form="faculty-form" icon={Save} disabled={busy}>{busy ? "Saving..." : isNew ? "Add faculty" : "Save changes"}</Button>
        </>
      }
    >
      <form id="faculty-form" onSubmit={submit} className="space-y-4">
        {error && <InlineNotice tone="danger">{error}</InlineNotice>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name"><Input value={form.full_name} onChange={(event) => set("full_name", event.target.value)} /></Field>
          <Field label="Department"><Input value={form.department} onChange={(event) => set("department", event.target.value)} /></Field>
          <div className="sm:col-span-2"><Field label="Specialization"><Textarea rows={2} value={form.specialization} onChange={(event) => set("specialization", event.target.value)} /></Field></div>
          <Field label="Email (also the login)"><Input type="email" value={form.email} onChange={(event) => set("email", event.target.value)} /></Field>
          <Field label="Status"><Select placeholder="" value={form.status} onChange={(event) => set("status", event.target.value)} options={STATUS_OPTIONS} /></Field>
          <div className="sm:col-span-2">
            <Field label={isNew ? "Temporary password (at least 8 characters)" : "New password (leave blank to keep the current one)"}>
              <Input type="password" autoComplete="new-password" value={form.password} onChange={(event) => set("password", event.target.value)} />
            </Field>
          </div>
        </div>
        <div>
          <span className="field-label">Roles this person can take</span>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            {FACULTY_ROLE_OPTIONS.map((role) => (
              <label key={role} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition-colors duration-200 hover:bg-brand-50 max-sm:min-h-11">
                <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={form.eligible_roles.includes(role)} onChange={() => toggleRole(role)} />{role}
              </label>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}

function FacultyProfileModal({ faculty: initialFaculty, courses, onSaved, onClose }) {
  const { data: detail, loading: detailLoading, error: detailError } = useApi(
    () => api.facultyProfile(initialFaculty.id),
    [initialFaculty.id],
  );
  const faculty = detail?.faculty || initialFaculty;
  const calendar = faculty.calendar || {};
  const feedUrl = calendar.feed_url || `/api/faculty/${faculty.id}/calendar.ics`;
  const [showCvAssistant, setShowCvAssistant] = useState(false);
  return (
    <>
      <Modal
        title={faculty.name}
        subtitle={
          <>
            <span className="block">{faculty.role}</span>
            <span className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-slate-600"><Building2 className="h-3.5 w-3.5" aria-hidden="true" />{faculty.college}</span>
          </>
        }
        icon={<span className="text-sm font-semibold">{initials(faculty.name)}</span>}
        badge={
          <>
            <AvailabilityBadge faculty={faculty} />
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{faculty.panel_load} panel assignments</span>
          </>
        }
        size="xl"
        onClose={onClose}
        closeLabel="Close faculty profile"
      >
        {/* data-autofocus: the dialog opens at the top of its content, not on a control far down the page */}
        <div className="space-y-6 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0" tabIndex={-1} data-autofocus>
          {detailLoading && <p className="meta font-semibold" role="status">Refreshing calendar status and schedule...</p>}
          {detailError && <InlineNotice tone="warning" role="alert">Live calendar details could not be refreshed: {detailError}</InlineNotice>}
          <div className="grid gap-6 lg:grid-cols-3">
            <ProfileSection icon={BriefcaseBusiness} title="Specialization">
              <p className="text-sm leading-relaxed text-slate-600">{faculty.specialization}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">{(faculty.matching_keywords || []).slice(0, 8).map((keyword) => <span key={keyword} className="rounded-full bg-brand-50 px-2 py-1 text-2xs font-semibold text-brand-700">{keyword}</span>)}</div>
              <p className="meta mt-2">Panel Matching compares the student's paper with this text and with the expertise records below.</p>
              {faculty.cv_profile && <Button variant="secondary" icon={FileSearch} className="mt-3" onClick={() => setShowCvAssistant(true)}>Open CV reference assistant</Button>}
            </ProfileSection>

            <ProfileSection icon={BookOpenCheck} title="Preferred teaching subjects">
              <PreferenceEditor faculty={faculty} courses={courses} onSaved={onSaved} />
            </ProfileSection>

            <div className="space-y-6">
              <ProfileSection icon={Mail} title="Contact">
                <a className="text-sm font-medium text-brand-700 hover:underline" href={`mailto:${faculty.email}`}>{faculty.email}</a>
                <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="eyebrow">Faculty login</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{faculty.account?.email || faculty.email}</p>
                </div>
              </ProfileSection>
              <ProfileSection icon={UsersRound} title="Current assignments">
                <div className="mb-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-slate-600">Teaching load</span><span className="text-sm font-semibold text-ink">{faculty.teaching_load_units || 0}/{faculty.teaching_load_limit || 24} units</span></div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><span className="block h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, ((faculty.teaching_load_units || 0) / (faculty.teaching_load_limit || 24)) * 100)}%` }} /></div>
                </div>
                {(faculty.teaching_assignments || []).length ? <div className="mb-3 space-y-2">{faculty.teaching_assignments.slice(0, 4).map((assignment) => <div key={assignment.id} className="rounded-lg border border-slate-100 p-3"><p className="text-sm font-semibold text-ink">{assignment.course_code} · {assignment.units} units</p><p className="meta mt-1">{assignment.term_label} · {assignment.status}</p></div>)}</div> : null}
                {(faculty.current_assignments || []).length ? <div className="space-y-2">{faculty.current_assignments.slice(0, 3).map((assignment) => (
                  <div key={assignment.id} className="rounded-lg border border-slate-100 p-3"><div className="flex justify-between gap-2"><p className="text-sm font-semibold text-ink">{assignment.student_name}</p><span className="text-2xs font-semibold text-brand-700">{assignment.panel_role}</span></div><p className="meta mt-1 line-clamp-2">{assignment.research_title}</p></div>
                ))}</div> : <p className="text-sm text-slate-500">No current panel assignments.</p>}
              </ProfileSection>
            </div>

            <ProfileSection icon={Link2} title="Calendar connection">
              <div className={`rounded-xl border p-3 ${calendar.connected ? "border-brand-200 bg-brand-50" : "border-slate-200 bg-slate-50"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{calendar.provider || "Google Calendar"}</p>
                    <p className="mt-1 text-xs text-slate-600">{calendar.sync_status}</p>
                    {calendar.connected_email && <p className="meta mt-1 font-medium">{calendar.connected_email}</p>}
                  </div>
                  <StatusChip status={calendar.connected ? "Connected" : "Not connected"} dot={calendar.connected} />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-slate-600">
                  {calendar.connected
                    ? "Google busy periods are the source used by Defense Scheduling. Event names and details remain private."
                    : "This faculty member must connect Google Calendar from their own Faculty Portal. Until then, only the hours they enter in their own portal are used."}
                </p>
                <Button as="a" variant="secondary" icon={ExternalLink} className="mt-3 w-full justify-center" href={feedUrl} target="_blank" rel="noreferrer">View availability feed</Button>
              </div>
            </ProfileSection>
          </div>

          <ExpertiseEditor faculty={faculty} onChanged={onSaved} />

          <WeeklyCalendar faculty={faculty} />
        </div>
      </Modal>
      {showCvAssistant && <FacultyAssignmentProfile faculty={faculty} onClose={() => setShowCvAssistant(false)} />}
    </>
  );
}

const EXPERTISE_KIND_HINTS = {
  research_interest: "e.g. Learning analytics for graduate student engagement",
  publication: "Title of a paper, chapter, or conference presentation",
  past_advisee_title: "Title of a thesis, dissertation, or project paper this faculty advised",
  past_panel_title: "Title of a paper this faculty sat on the panel for",
  degree: "e.g. PhD in Educational Psychology",
};

function ExpertiseEditor({ faculty, onChanged }) {
  const confirm = useConfirm();
  const { data, loading, error, refetch } = useApi(() => api.facultyExpertise(faculty.id), [faculty.id]);
  const items = data?.items || [];
  const kinds = data?.kinds || [];
  const kindOptions = kinds.map((kind) => ({ value: kind.value, label: kind.label }));
  const blank = { kind: "research_interest", text: "", year: "" };
  const [draft, setDraft] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");

  useEffect(() => {
    setDraft(blank);
    setEditingId(null);
    setMessage("");
    setProblem("");
  }, [faculty.id]);

  async function run(action, success) {
    setBusy(true);
    setMessage("");
    setProblem("");
    try {
      await action();
      setMessage(success);
      await refetch();
      await onChanged?.();
    } catch (err) {
      setProblem(err.message || "Could not save the expertise record.");
    } finally {
      setBusy(false);
    }
  }

  const payload = (value) => ({ kind: value.kind, text: value.text, year: value.year === "" ? null : value.year });

  async function add(event) {
    event.preventDefault();
    await run(async () => {
      await api.addFacultyExpertise(faculty.id, payload(draft));
      setDraft({ ...blank, kind: draft.kind });
    }, "Expertise record added. Panel Matching uses it immediately.");
  }

  async function saveEdit(event) {
    event.preventDefault();
    await run(async () => {
      await api.updateFacultyExpertise(editingId, payload(editDraft));
      setEditingId(null);
    }, "Expertise record updated.");
  }

  async function remove(item) {
    const ok = await confirm({
      title: "Remove this expertise record?",
      message: `"${item.text}" will no longer be used when matching panels for ${faculty.name}.`,
      confirmLabel: "Remove record",
      tone: "danger",
    });
    if (ok) await run(() => api.deleteFacultyExpertise(item.id), "Expertise record removed.");
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditDraft({ kind: item.kind, text: item.text, year: item.year ?? "" });
    setMessage("");
    setProblem("");
  }

  return (
    <section aria-labelledby={`expertise-${faculty.id}`}>
      <div className="mb-2 flex items-center gap-2"><Microscope className="h-4 w-4 text-brand-700" /><h3 id={`expertise-${faculty.id}`} className="text-sm font-semibold text-ink">Expertise records</h3><span className="rounded-full bg-slate-100 px-2 py-0.5 text-2xs font-semibold text-slate-600">{items.length}</span></div>
      <p className="meta mb-3">Research interests, publications, past advisee and panel titles, and degrees. Panel Matching reads all of them, so the more accurate they are the better the panel recommendations. Records marked <span className="font-semibold text-amber-800">Demo data</span> are sample entries; editing one turns it into a manual entry.</p>
      {loading && !data ? <p className="meta" role="status">Loading expertise records…</p> : error ? <InlineNotice tone="danger">{error}</InlineNotice> : (
        <div className="space-y-2">
          {!items.length && <p className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500">No expertise records yet. Add the first one below.</p>}
          {items.map((item) => editingId === item.id ? (
            <form key={item.id} onSubmit={saveEdit} className="grid gap-2 rounded-lg border border-brand-200 bg-brand-50/40 p-3 sm:grid-cols-[170px_1fr_100px_auto]">
              <Select aria-label="Kind of record" placeholder="" value={editDraft.kind} onChange={(event) => setEditDraft({ ...editDraft, kind: event.target.value })} options={kindOptions} />
              <Textarea aria-label="Record text" rows={2} value={editDraft.text} onChange={(event) => setEditDraft({ ...editDraft, text: event.target.value })} />
              <Input aria-label="Year" type="number" placeholder="Year" value={editDraft.year} onChange={(event) => setEditDraft({ ...editDraft, year: event.target.value })} />
              <div className="flex items-start gap-2"><Button type="submit" size="sm" icon={Save} disabled={busy}>Save</Button><Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button></div>
            </form>
          ) : (
            <div key={item.id} className="flex items-start gap-3 rounded-lg border border-slate-100 p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusChip status={item.kind_label} tone="good" size="sm" dot={false} />
                  {item.year && <span className="micro">{item.year}</span>}
                  {item.source === "demo seed"
                    ? <StatusChip status="Demo data" tone="warn" size="sm" dot={false} />
                    : <StatusChip status="Manual entry" tone="muted" size="sm" dot={false} />}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-700">{item.text}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="icon" icon={Pencil} onClick={() => startEdit(item)} aria-label={`Edit record: ${item.text}`} />
                <Button variant="icon" icon={Trash2} onClick={() => remove(item)} aria-label={`Remove record: ${item.text}`} />
              </div>
            </div>
          ))}
          <form onSubmit={add} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[170px_1fr_100px_auto]">
            <Select aria-label="Kind of new record" placeholder="" value={draft.kind} onChange={(event) => setDraft({ ...draft, kind: event.target.value })} options={kindOptions} />
            <Input aria-label="Text of new record" value={draft.text} onChange={(event) => setDraft({ ...draft, text: event.target.value })} placeholder={EXPERTISE_KIND_HINTS[draft.kind] || "Describe the expertise"} required minLength={5} maxLength={600} />
            <Input aria-label="Year of new record" type="number" min="1950" value={draft.year} onChange={(event) => setDraft({ ...draft, year: event.target.value })} placeholder="Year" />
            <Button type="submit" icon={Plus} disabled={busy || draft.text.trim().length < 5}>Add record</Button>
          </form>
        </div>
      )}
      {message && <InlineNotice tone="success" className="mt-2">{message}</InlineNotice>}
      {problem && <InlineNotice tone="danger" className="mt-2">{problem}</InlineNotice>}
    </section>
  );
}

function PreferenceEditor({ faculty, courses, onSaved }) {
  const available = courses.filter((course) => course.college === faculty.college);
  const [selected, setSelected] = useState(() => new Set((faculty.preferred_subjects || []).map((item) => item.id)));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setSelected(new Set((faculty.preferred_subjects || []).map((item) => item.id)));
    setMessage("");
    setError("");
  }, [faculty.id, faculty.preferred_subjects?.map((item) => item.id).join(",")]);

  function toggle(id) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api.saveFacultyPreferences(faculty.id, [...selected]);
      setMessage(result.message);
      await onSaved?.();
    } catch (err) {
      setError(err.message || "Could not save preferred subjects.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="meta">These choices are ranked first when course assignments are generated. Availability and the 24-unit ceiling are still enforced.</p>
      <div className="mt-3 max-h-52 space-y-1 overflow-y-auto rounded-xl border border-slate-200 p-2">
        {available.map((course) => (
          <label key={course.id} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 transition-colors duration-200 hover:bg-brand-50">
            <input type="checkbox" checked={selected.has(course.id)} onChange={() => toggle(course.id)} className="mt-0.5 h-4 w-4 accent-brand-600" />
            <span><span className="block text-xs font-semibold text-ink">{course.code}</span><span className="micro block">{course.title} · {course.units} units</span></span>
          </label>
        ))}
        {!available.length && <p className="meta p-2">No curriculum subjects are available for this college.</p>}
      </div>
      <Button size="sm" icon={Save} className="mt-3" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save preferences"}</Button>
      {message && <InlineNotice tone="success" className="mt-2">{message}</InlineNotice>}
      {error && <InlineNotice tone="danger" className="mt-2">{error}</InlineNotice>}
    </div>
  );
}

const CALENDAR_START_HOUR = 8;
const CALENDAR_END_HOUR = 18;
const HOUR_HEIGHT = 52;

function WeeklyCalendar({ faculty }) {
  const calendarConnected = Boolean(faculty.calendar?.connected);
  const events = useMemo(() => [
    ...(faculty.upcoming_availability || []).map((event) => ({ ...event, title: "Available for defense", status: "available" })),
    ...(faculty.calendar_events || []).filter((event) => event.source === "google_calendar"),
  ], [faculty]);
  const hasHours = (faculty.working_hours || []).some((item) => item.enabled);
  const hasAnything = hasHours || events.length > 0;
  const firstEventDate = events.length ? dateFromIso([...events].sort((a, b) => a.date.localeCompare(b.date))[0].date) : new Date();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(firstEventDate));

  useEffect(() => setWeekStart(startOfWeek(firstEventDate)), [faculty.id]);

  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const weekEnd = days[6];
  const visibleEvents = events.filter((event) => {
    const eventDate = dateFromIso(event.date);
    return eventDate >= days[0] && eventDate <= weekEnd;
  });

  return (
    <section>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-brand-700" /><h3 className="card-title">Weekly availability & schedule</h3></div>
          <p className="meta mt-1">
            {calendarConnected
              ? "Weekly hours the faculty member entered, plus live Google Calendar busy periods."
              : "Weekly hours and available dates the faculty member entered. Nothing is assumed."}
          </p>
        </div>
        {hasAnything && <div className="flex items-center gap-1.5">
          <Button variant="icon" icon={ChevronLeft} onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week" />
          <Button variant="secondary" onClick={() => setWeekStart(startOfWeek(new Date()))}>Today</Button>
          <Button variant="icon" icon={ChevronRight} onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week" />
        </div>}
      </div>

      {!hasAnything && (
        <InlineNotice tone="warning" title="Not entered">
          The faculty member enters their weekly hours in their own portal. Until then, Defense Scheduling does not assume any free time for them.
        </InlineNotice>
      )}

      {hasAnything && <>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700">{formatWeekRange(weekStart, weekEnd)}</p>
        <div className="flex flex-wrap gap-3 text-2xs font-medium text-slate-500">
          <Legend color="border-brand-300 bg-brand-50" label="Weekly hours entered" />
          <Legend color="border-brand-600 bg-brand-500" label="Available slot" />
          <Legend color="border-blue-600 bg-blue-500" label="Blocked / busy" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div className="min-w-[920px]">
          <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-slate-200 bg-slate-50">
            <div className="border-r border-slate-200" />
            {days.map((day) => <div key={day.toISOString()} className="border-r border-slate-200 px-2 py-2.5 text-center last:border-r-0"><p className="eyebrow">{day.toLocaleDateString("en-US", { weekday: "short" })}</p><p className={`mt-0.5 text-sm font-semibold ${isToday(day) ? "text-brand-700" : "text-slate-700"}`}>{day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p></div>)}
          </div>
          <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))]">
            <div className="relative border-r border-slate-200" style={{ height: (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * HOUR_HEIGHT }}>
              {Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR + 1 }, (_, index) => <span key={index} className="absolute right-2 -translate-y-1/2 text-2xs font-medium text-slate-500" style={{ top: index * HOUR_HEIGHT }}>{formatHour(CALENDAR_START_HOUR + index)}</span>)}
            </div>
            {days.map((day, dayIndex) => {
              const workingDay = faculty.working_hours?.find((item) => item.weekday === dayIndex);
              const dayEvents = visibleEvents.filter((event) => sameDate(dateFromIso(event.date), day));
              return (
                <div key={day.toISOString()} className="relative border-r border-slate-200 last:border-r-0" style={{ height: (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * HOUR_HEIGHT }}>
                  {Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR }, (_, index) => <div key={index} className="absolute inset-x-0 border-t border-slate-100" style={{ top: index * HOUR_HEIGHT }} />)}
                  {workingDay?.enabled && <CalendarBlock event={{ start: workingDay.start, end: workingDay.end, title: "Weekly hours", status: "working" }} />}
                  {dayEvents.map((event, index) => <CalendarBlock key={`${event.date}-${event.start}-${event.title}-${index}`} event={event} index={index} />)}
                  {!workingDay?.enabled && <p className="absolute inset-x-2 top-3 text-center text-2xs font-semibold text-slate-400">No hours</p>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="meta mt-2">
        {calendarConnected
          ? "Defense Scheduling excludes every blue Google Calendar busy block. Event details stay private."
          : "Times are Philippine time."}
      </p>
      </>}
    </section>
  );
}

function CalendarBlock({ event, index = 0 }) {
  const start = minutesFromTime(event.start);
  const end = minutesFromTime(event.end);
  const visibleStart = Math.max(start, CALENDAR_START_HOUR * 60);
  const visibleEnd = Math.min(end, CALENDAR_END_HOUR * 60);
  if (visibleEnd <= visibleStart) return null;
  const top = ((visibleStart - CALENDAR_START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const height = Math.max(22, ((visibleEnd - visibleStart) / 60) * HOUR_HEIGHT);
  const isWorking = event.status === "working";
  const isAvailable = event.status === "available";
  const color = isWorking ? "border-brand-300 bg-brand-50/70 text-brand-800" : isAvailable ? "border-brand-600 bg-brand-500 text-white" : "border-blue-600 bg-blue-500 text-white";
  return (
    <div className={`absolute overflow-hidden rounded-md border px-1.5 py-1 text-2xs ${isWorking ? "z-0" : "z-10"} ${color}`} style={{ top, height, left: isWorking ? 4 : 7 + (index % 2) * 4, right: isWorking ? 4 : 7 }} title={`${event.title}: ${event.start}–${event.end}`}>
      <p className="truncate font-semibold">{event.title}</p>
      {height >= 36 && <p className={`truncate ${isWorking ? "text-brand-700" : "text-white/85"}`}>{event.start}–{event.end}</p>}
    </div>
  );
}

function Legend({ color, label }) {
  return <span className="inline-flex items-center gap-1.5"><i className={`h-2.5 w-2.5 rounded-md border ${color}`} />{label}</span>;
}

function minutesFromTime(value) {
  const [hour, minute] = (value || "00:00").split(":").map(Number);
  return hour * 60 + minute;
}

function dateFromIso(value) {
  return new Date(`${value}T00:00:00`);
}

function startOfWeek(value) {
  const day = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const offset = day.getDay() === 0 ? -6 : 1 - day.getDay();
  day.setDate(day.getDate() + offset);
  return day;
}

function addDays(value, amount) {
  const result = new Date(value);
  result.setDate(result.getDate() + amount);
  return result;
}

function sameDate(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isToday(value) {
  return sameDate(value, new Date());
}

function formatHour(hour) {
  const normalized = hour % 12 || 12;
  return `${normalized} ${hour < 12 ? "AM" : "PM"}`;
}

function formatWeekRange(start, end) {
  const startLabel = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

// "Not entered" / "Available" / ... plus when the faculty member last saved their hours.
function AvailabilityBadge({ faculty }) {
  const status = faculty.availability_status || (faculty.availability_entered ? "Entered" : "Not entered");
  const updated = faculty.availability_entered && faculty.availability_updated_at ? formatUpdated(faculty.availability_updated_at) : "";
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <StatusChip status={status} dot={false} />
      {updated && <span className="micro font-medium">updated {updated}</span>}
    </span>
  );
}

function formatUpdated(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ProfileSection({ icon: Icon, title, children }) {
  return <section><div className="mb-2 flex items-center gap-2"><Icon className="h-4 w-4 text-brand-700" /><h3 className="text-sm font-semibold text-ink">{title}</h3></div>{children}</section>;
}

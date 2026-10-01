import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Download, FileSearch, Info, Search } from "lucide-react";
import { Card } from "./ui";

// Subject-needs report (Course Adjustments).
// One row per subject. Two different numbers per row:
//   Needing next  - students for whom the subject is in their next semester group (what to offer).
//   Not taken yet - everyone who still has to take it at some point (the whole backlog).
// The student names sit behind "Show students" so the page stays readable.

export default function SubjectNeedsReport({ report, termLabel = "" }) {
  const [query, setQuery] = useState("");
  const [showLater, setShowLater] = useState(false);
  const rows = report.rows || [];
  const reviewed = report.summary?.students_reviewed || 0;
  const needle = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!needle) return rows;
    return rows.filter((row) => rowMatches(row, needle));
  }, [rows, needle]);
  const dueRows = matches.filter((row) => row.need_count > 0);
  const laterRows = matches.filter((row) => row.need_count === 0 && row.not_taken_count > 0);
  const laterOpen = showLater || (needle && laterRows.length > 0);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 shrink-0 text-brand-600" />
            <h2 className="text-lg font-semibold text-ink">Subject-needs report</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            <span className="font-semibold text-ink">{report.program?.code}</span>
            {report.program?.name ? ` · ${report.program.name}` : ""}
            {termLabel ? ` · planning for ${termLabel}` : ""}
            {` · generated ${formatGeneratedAt(report.generated_at)}`}
          </p>
        </div>
        <button type="button" onClick={() => downloadCsv(report)} className="btn-ghost shrink-0 self-start">
          <Download className="h-4 w-4" /> Download CSV
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4 md:grid-cols-2">
        <Meaning tone="brand" title="Needing next term">
          The subject is in the student&apos;s next semester group, or the student must retake it after failing,
          dropping or withdrawing. This is the number to plan an offering from.
        </Meaning>
        <Meaning tone="slate" title="Not taken yet">
          Everyone who still has to take the subject at some point: not completed and not being taken now.
          Always at least as large as &quot;needing next term&quot;.
        </Meaning>
      </div>

      <div className="grid grid-cols-2 gap-3 px-5 py-4 lg:grid-cols-4">
        <Tile label="Students reviewed" value={reviewed} hint="Active students who will need subjects" />
        <Tile label="Subjects needed next term" value={report.summary?.subjects_with_need ?? 0} hint="At least one student is due" />
        <Tile label="Student seats needed" value={report.summary?.student_subject_needs ?? 0} hint="Each student counted per subject" />
        <Tile label="Subjects with a backlog" value={report.summary?.subjects_not_taken ?? 0} hint="Anyone has not taken it yet" />
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-3 sm:flex-row sm:items-center">
        <label className="relative block min-w-0 flex-1 sm:max-w-sm">
          <span className="sr-only">Search subjects or students</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a subject or a student"
            className="field-input w-full pl-9"
          />
        </label>
        <p className="text-xs text-slate-500">
          Group: <span className="font-semibold text-slate-700">{report.program?.code}</span> · sorted by students needing next term
        </p>
      </div>

      {dueRows.length === 0 && laterRows.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-brand-500" />
          <p className="mt-2 font-semibold text-ink">{needle ? "Nothing matches that search" : "No subject is waiting on any student"}</p>
          <p className="mt-1 text-sm text-slate-500">
            {needle ? "Try a subject code, a title or a student name." : "Every reviewed student has completed, or is taking, every subject."}
          </p>
        </div>
      ) : (
        <>
          <SectionLabel count={dueRows.length}>Needed next term</SectionLabel>
          {dueRows.length ? (
            <ul className="divide-y divide-slate-100">
              {dueRows.map((row) => <SubjectRow key={row.course.id} row={row} reviewed={reviewed} needle={needle} />)}
            </ul>
          ) : (
            <p className="px-5 pb-4 text-sm text-slate-500">No student is due for a subject next term.</p>
          )}
          {laterRows.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setShowLater((value) => !value)}
                aria-expanded={laterOpen}
                className="flex w-full cursor-pointer items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-left hover:bg-slate-100/70"
              >
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Later in the curriculum · {laterRows.length} subject{laterRows.length === 1 ? "" : "s"} nobody needs yet
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${laterOpen ? "rotate-180" : ""}`} />
              </button>
              {laterOpen && (
                <ul className="divide-y divide-slate-100">
                  {laterRows.map((row) => <SubjectRow key={row.course.id} row={row} reviewed={reviewed} needle={needle} />)}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </Card>
  );
}

function Meaning({ title, tone, children }) {
  const dot = tone === "brand" ? "bg-brand-500" : "bg-slate-400";
  return (
    <div className="flex gap-2.5 text-xs leading-relaxed text-slate-600">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <p>
        <span className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${dot}`} />
        <span className="font-bold text-ink">{title}.</span> {children}
      </p>
    </div>
  );
}

function Tile({ label, value, hint }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500" title={label}>{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold text-brand-700">{value}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{hint}</p>
    </div>
  );
}

function SectionLabel({ children, count }) {
  return (
    <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-2.5">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{children} · {count} subject{count === 1 ? "" : "s"}</p>
    </div>
  );
}

function SubjectRow({ row, reviewed, needle }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState("due");
  const students = row.students || [];
  const dueStudents = students.filter((student) => student.due_next);
  const hasDue = dueStudents.length > 0;
  const active = scope === "due" && hasDue ? "due" : "all";
  const shown = (active === "due" ? dueStudents : students).filter((student) => !needle || studentMatches(student, needle) || courseMatches(row, needle));
  const pct = reviewed ? Math.max(row.need_count ? 4 : 0, Math.round((row.need_count / reviewed) * 100)) : 0;
  const expanded = open || (needle && students.some((student) => studentMatches(student, needle)) && !courseMatches(row, needle));

  return (
    <li className="px-5 py-3">
      <div className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_auto_auto] md:items-center">
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink" title={subjectLabel(row.course)}>
            {row.course.code}
            {showTitle(row.course) && <span className="font-normal text-slate-600"> · {row.course.title}</span>}
          </p>
          <p className="text-xs text-slate-500">
            {row.course.units} unit{row.course.units === 1 ? "" : "s"}
            {row.course.category ? ` · ${row.course.category}` : ""}
            {row.course.recommended_term ? ` · ${row.course.recommended_term}` : ""}
          </p>
        </div>
        <div className="flex min-w-0 items-center gap-3" title={`${row.need_count} of ${reviewed} reviewed students need it next term`}>
          <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${row.need_count} of ${reviewed} students`}>
            <span className="block h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
          </span>
          <span className="w-16 shrink-0 text-right text-xs text-slate-500">of {reviewed}</span>
        </div>
        <div className="flex items-center gap-4 md:justify-end">
          <Count label="Needing next" value={row.need_count} strong />
          <Count label="Not taken yet" value={row.not_taken_count} />
          {row.retake_count > 0 && <Count label="Retakes" value={row.retake_count} warn />}
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={expanded}
          className="btn-ghost justify-center px-3 py-1.5 text-xs"
        >
          {expanded ? "Hide students" : "Show students"}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {expanded && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
            {hasDue && (
              <ScopeTab active={active === "due"} onClick={() => setScope("due")}>Needing next term ({dueStudents.length})</ScopeTab>
            )}
            <ScopeTab active={active === "all"} onClick={() => setScope("all")}>All who have not taken it ({students.length})</ScopeTab>
          </div>
          {shown.length ? (
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full table-fixed text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="w-[38%] px-3 py-2">Student</th>
                    <th className="hidden w-[24%] px-3 py-2 sm:table-cell">Student no.</th>
                    <th className="w-[16%] px-3 py-2">Year</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {shown.map((student) => (
                    <tr key={student.id}>
                      <td className="px-3 py-2">
                        <p className="truncate font-semibold text-ink" title={student.name}>{student.name}</p>
                        <p className="truncate text-[11px] text-slate-400 sm:hidden">{student.student_number}</p>
                      </td>
                      <td className="hidden truncate px-3 py-2 text-slate-600 sm:table-cell">{student.student_number}</td>
                      <td className="truncate px-3 py-2 text-slate-600">{student.course_year_label || "—"}</td>
                      <td className="px-3 py-2"><NeedStatus student={student} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-3 py-3 text-sm text-slate-500">No student matches this search.</p>
          )}
        </div>
      )}
    </li>
  );
}

function Count({ label, value, strong = false, warn = false }) {
  const colour = warn ? "text-amber-700" : strong ? "text-brand-700" : "text-slate-700";
  return (
    <div className="text-center">
      <p className={`font-display text-lg font-semibold leading-none ${colour}`}>{value}</p>
      <p className="mt-1 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}

function ScopeTab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
    >
      {children}
    </button>
  );
}

function NeedStatus({ student }) {
  const retake = student.reason && student.reason !== "Not taken";
  const label = retake ? `${student.reason} · retake` : student.due_next ? "Due next term" : "Later";
  const tone = retake ? "bg-amber-50 text-amber-800 ring-amber-200" : student.due_next ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-slate-100 text-slate-600 ring-slate-200";
  return <span className={`inline-flex max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tone}`} title={label}>{label}</span>;
}

function showTitle(course) {
  return Boolean(course.title) && course.title !== course.code;
}

function subjectLabel(course) {
  return showTitle(course) ? `${course.code} · ${course.title}` : course.code;
}

function courseMatches(row, needle) {
  return `${row.course.code} ${row.course.title}`.toLowerCase().includes(needle);
}

function studentMatches(student, needle) {
  return `${student.name} ${student.student_number}`.toLowerCase().includes(needle);
}

function rowMatches(row, needle) {
  return courseMatches(row, needle) || (row.students || []).some((student) => studentMatches(student, needle));
}

function formatGeneratedAt(value) {
  if (!value) return "now";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

// One line per student per subject, so the file opens cleanly in Excel and can be filtered or pivoted.
function downloadCsv(report) {
  const header = [
    "Program", "Subject code", "Subject title", "Units", "Needing next term (students)", "Not taken yet (students)",
    "Student number", "Student name", "Year", "Due next term", "Status",
  ];
  const lines = [];
  (report.rows || []).forEach((row) => {
    (row.students || []).forEach((student) => {
      lines.push([
        report.program?.code || "", row.course.code, row.course.title, row.course.units, row.need_count, row.not_taken_count,
        student.student_number, student.name, student.course_year_label || "", student.due_next ? "Yes" : "No",
        student.reason && student.reason !== "Not taken" ? `${student.reason} (retake)` : "Not taken",
      ]);
    });
  });
  const csv = [header, ...lines].map((line) => line.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${(report.program?.code || "program").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-subject-needs.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

import { useState } from "react";
import { StatusChip } from "./ui/index.js";
import { csvCell, downloadBlob } from "../lib/format";

// Subject-needs figures for Course Adjustments (I-117: they used to be a second list of the same subjects).
// Two different numbers per subject:
//   Needing next term - students for whom the subject is in their next semester group (what to offer).
//   Not taken yet     - everyone who still has to take it at some point (the whole backlog).
// The page folds them into its one subject table; the student names sit in the row's Details drawer.

/** One row per curriculum subject: the plan's demand row plus that subject's line of the report (none = nobody needs it). */
export function mergeSubjectNeeds(demandRows = [], report = null) {
  const byCourse = new Map((report?.rows || []).map((row) => [row.course.id, row]));
  return demandRows
    .map((row) => {
      const mine = byCourse.get(row.course.id);
      return {
        ...row,
        needs: {
          need: mine ? mine.need_count : row.demand_count || 0,
          notTaken: mine ? mine.not_taken_count : 0,
          retakes: mine ? mine.retake_count : 0,
          students: mine ? mine.students || [] : [],
        },
      };
    })
    .sort((a, b) => b.needs.need - a.needs.need || b.needs.notTaken - a.needs.notTaken || a.course.code.localeCompare(b.course.code));
}

/** "due" = needed next term; "later" = nobody needs it next term but someone has not taken it; "none" = nobody. */
export function needGroup(row) {
  if (row.needs.need > 0) return "due";
  return row.needs.notTaken > 0 ? "later" : "none";
}

/** The two meanings, once, above the table. */
export function NeedsMeaning() {
  return (
    <p className="meta leading-relaxed">
      <span className="font-semibold text-ink">Needing next term:</span> the subject is in the student&apos;s next semester group, or the student
      must retake it. This is the number to plan an offering from.{" "}
      <span className="font-semibold text-ink">Not taken yet:</span> everyone who still has to take it at some point; never smaller than the first number.{" "}
      One affected student is enough to offer a subject; open Details on a row to see the students, who would be delayed if it is withheld, and who could teach it.
    </p>
  );
}

/** The report's four figures as one line. */
export function SubjectNeedsSummary({ summary = {} }) {
  const reviewed = summary.students_reviewed ?? 0;
  const parts = [
    [reviewed, reviewed === 1 ? "student reviewed" : "students reviewed"],
    [summary.subjects_with_need ?? 0, "subjects needed next term"],
    [summary.student_subject_needs ?? 0, "student seats needed"],
    [summary.subjects_not_taken ?? 0, "subjects with a backlog"],
  ];
  return (
    <p className="text-sm text-slate-600">
      {parts.map(([value, label], index) => (
        <span key={label}>
          {index > 0 && <span className="text-slate-400"> · </span>}
          <span className="font-semibold text-ink">{value}</span> {label}
        </span>
      ))}
    </p>
  );
}

/** The students behind a subject: who needs it next term, and everyone who has not taken it. Used in the Details drawer. */
export function SubjectStudents({ students = [], delayedIds = new Set() }) {
  const [scope, setScope] = useState("due");
  const due = students.filter((student) => student.due_next);
  const active = scope === "due" && due.length ? "due" : "all";
  const shown = active === "due" ? due : students;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {due.length > 0 && <ScopeTab active={active === "due"} onClick={() => setScope("due")}>Needing next term ({due.length})</ScopeTab>}
        <ScopeTab active={active === "all"} onClick={() => setScope("all")}>All who have not taken it ({students.length})</ScopeTab>
      </div>
      {shown.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Nobody still has to take this subject.</p>
      ) : (
        <ul className="mt-2 grid grid-cols-1 gap-1.5">
          {shown.map((student) => {
            const delayed = delayedIds.has(student.id);
            return (
              <li key={student.id} className={`flex min-w-0 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs ${delayed ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"}`}>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink" title={`${student.name} (${student.student_number})`}>
                    {student.name} <span className="font-normal text-slate-500">({student.student_number})</span>
                  </p>
                  <p className={`truncate ${delayed ? "text-amber-800" : "text-slate-600"}`}>
                    {student.course_year_label || "Year not recorded"}
                    {delayed ? " · delayed if not offered" : ""}
                  </p>
                </div>
                <NeedStatus student={student} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ScopeTab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-200 max-sm:min-h-11 ${active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
    >
      {children}
    </button>
  );
}

function needLabel(student) {
  const retake = student.reason && student.reason !== "Not taken";
  return retake ? `${student.reason} · retake` : student.due_next ? "Due next term" : "Later";
}

function NeedStatus({ student }) {
  const retake = student.reason && student.reason !== "Not taken";
  const label = needLabel(student);
  // these are this report's own words, so the tone goes in as the hint StatusChip uses for a word it does not know
  return <StatusChip status={label} tone={retake ? "warn" : student.due_next ? "good" : "muted"} dot={false} size="sm" className="max-w-[45%] shrink-0 truncate" title={label} />;
}

export function courseMatches(row, needle) {
  return `${row.course.code} ${row.course.title}`.toLowerCase().includes(needle);
}

export function studentMatches(student, needle) {
  return `${student.name} ${student.student_number}`.toLowerCase().includes(needle);
}

export function formatGeneratedAt(value) {
  if (!value) return "now";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

// One line per student per subject, so the file opens cleanly in Excel and can be filtered or pivoted.
export function downloadSubjectNeedsCsv(report) {
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
  downloadBlob(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }), `${(report.program?.code || "program").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-subject-needs.csv`);
}

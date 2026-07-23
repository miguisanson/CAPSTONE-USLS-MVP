import { useEffect, useState } from "react";
import { AlertTriangle, Download, Lock, UsersRound } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, EmptyState, Spinner, StatusBadge } from "../components/ui";

export default function EnrollmentClassList() {
  const { data: meta } = useApi(() => api.meta(), []);
  const [programId, setProgramId] = useState("");
  const [termId, setTermId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    api.monitoringClassList({
      program_id: programId || undefined,
      term_id: termId || undefined,
      course_id: courseId && courseId !== "all" ? courseId : undefined,
      view: courseId === "all" ? "all" : undefined,
    })
      .then((result) => {
        setData(result);
        setProgramId(String(result.program?.id || ""));
        setTermId(String(result.term?.id || ""));
        setCourseId(result.view === "all" ? "all" : String(result.selected_course_id || ""));
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [programId, termId, courseId]);

  function keepAllViewOrReset() {
    setCourseId((current) => current === "all" ? "all" : "");
  }

  function exportCsv() {
    if (!data) return;
    const rows = data.view === "all"
      ? (data.class_lists || []).flatMap((classList) =>
          (classList.students || []).map((student) => ({
            ...student,
            course_code: classList.offering?.course_code || student.course_code,
            faculty_name: classList.offering?.faculty_name || "",
          }))
        )
      : (data.students || []).map((student) => ({
          ...student,
          course_code: data.selected_offering?.course_code || student.course_code,
          faculty_name: data.selected_offering?.faculty_name || "",
        }));
    const lines = [
      ["Subject", "Faculty", "Student", "IDNO", "Program", "Status", "Enrolled at", "Source"]
        .map(csvCell)
        .join(","),
    ];
    rows.forEach((student) => {
      lines.push([
        student.course_code,
        student.faculty_name,
        displayStudentName(student),
        student.student_number,
        student.program_code,
        student.status,
        student.enrolled_at || "",
        student.source_reference || "",
      ].map(csvCell).join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = data.view === "all"
      ? `class-lists-all-${data.program?.code || "enrollment"}.csv`
      : `class-list-${data.selected_offering?.course_code || data.program?.code || "enrollment"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Enrollment record</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink">Enrollment Class List</h1>
        <p className="mt-1 text-sm text-slate-500">
          Read-only class rosters synchronized automatically with confirmed Enrollment records.
        </p>
      </div>

      <Card className="p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select
            value={programId}
            onChange={(event) => {
              setProgramId(event.target.value);
              keepAllViewOrReset();
            }}
            className="field-input cursor-pointer"
            aria-label="Program"
          >
            {(meta?.programs || []).map((program) => (
              <option key={program.id} value={program.id}>
                {program.code} — {program.name}
              </option>
            ))}
          </select>
          <select
            value={termId}
            onChange={(event) => {
              setTermId(event.target.value);
              keepAllViewOrReset();
            }}
            className="field-input cursor-pointer"
            aria-label="Semester"
          >
            {(data?.terms || meta?.terms || []).map((term) => (
              <option key={term.id} value={term.id}>
                {term.label}{term.relative_label ? ` (${term.relative_label})` : ""}
              </option>
            ))}
          </select>
          <select
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
            className="field-input cursor-pointer"
            aria-label="Class list view"
          >
            <option value="all">All class lists</option>
            {(data?.offerings || []).map((offering) => (
              <option key={offering.course_id} value={offering.course_id}>
                {offering.course_code} — {offering.course_title}
              </option>
            ))}
          </select>
          <button type="button" onClick={exportCsv} className="btn-ghost cursor-pointer" disabled={!data}>
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </Card>

      <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <p>
          <span className="font-semibold text-ink">Read-only roster.</span> Confirm or change enrollment in the Enrollment workspace; this list updates automatically.
        </p>
      </div>

      {loading ? (
        <Spinner label="Loading enrollment class list…" />
      ) : error ? (
        <EmptyState icon={AlertTriangle} title="Could not load the class list" hint={error} />
      ) : data?.view === "all" ? (
        <AllClassListsPanel data={data} />
      ) : (
        <ClassListPanel data={data} />
      )}
    </div>
  );
}

function ClassListPanel({ data }) {
  if (!data?.offerings?.length) {
    return (
      <EmptyState
        icon={UsersRound}
        title="No classes offered this semester"
        hint="Add a subject under Course Adjustments → Offering setup, then enroll students to build its class list."
      />
    );
  }
  const offering = data.selected_offering;
  return (
    <Card className="overflow-hidden p-0">
      <ClassListHeader
        offering={offering}
        listed={data.summary?.students_in_selected_class || 0}
        active={data.summary?.active_students || 0}
        eyebrow="Enrollment-synchronized class list"
      />
      {!data.students?.length ? (
        <EmptyState
          icon={UsersRound}
          title="No students enrolled in this class"
          hint="Students appear here automatically after Enrollment or an imported class list is confirmed."
        />
      ) : (
        <RosterTable students={data.students} />
      )}
    </Card>
  );
}

function AllClassListsPanel({ data }) {
  if (!data?.offerings?.length) {
    return (
      <EmptyState
        icon={UsersRound}
        title="No classes offered this semester"
        hint="Add a subject under Course Adjustments → Offering setup, then enroll students to build its class list."
      />
    );
  }
  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-brand-700">All class lists</p>
            <h2 className="mt-1 font-display text-lg font-semibold text-ink">
              {data.program?.code} · {data.term?.label}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Every offered class is expanded below for one-page review.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <SummaryPill>{data.summary?.offered_classes || 0} classes</SummaryPill>
            <SummaryPill tone="brand">{data.summary?.class_list_entries || 0} roster entries</SummaryPill>
            <SummaryPill>{data.summary?.unique_students || 0} students</SummaryPill>
          </div>
        </div>
      </Card>

      {(data.class_lists || []).map((classList) => (
        <Card key={classList.offering.course_id} className="overflow-hidden p-0">
          <ClassListHeader
            offering={classList.offering}
            listed={classList.summary?.listed || 0}
            active={classList.summary?.active || 0}
          />
          {classList.students?.length ? (
            <RosterTable students={classList.students} compact />
          ) : (
            <p className="px-5 py-5 text-sm text-slate-500">No students enrolled in this class.</p>
          )}
        </Card>
      ))}
    </div>
  );
}

function ClassListHeader({ offering, listed, active, eyebrow = "" }) {
  return (
    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5 sm:py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {eyebrow && (
            <p className="text-xs font-bold uppercase tracking-wide text-brand-700">{eyebrow}</p>
          )}
          <h3 className={`${eyebrow ? "mt-1 text-lg" : "text-base"} font-display font-semibold text-ink`}>
            {offering?.course_code} — {offering?.course_title}
          </h3>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            {[
              offering?.faculty_name || "Faculty not assigned",
              offering?.schedule || "Schedule not set",
              offering?.section ? `Section ${offering.section}` : "Section not set",
            ].join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 text-xs">
          <SummaryPill>{listed} listed</SummaryPill>
          <SummaryPill tone="brand">{active} active</SummaryPill>
        </div>
      </div>
    </div>
  );
}

function SummaryPill({ children, tone = "neutral" }) {
  return (
    <span className={`rounded-lg border px-3 py-2 font-semibold ${
      tone === "brand"
        ? "border-brand-200 bg-brand-50 text-brand-700"
        : "border-slate-200 bg-white text-slate-700"
    }`}>
      {children}
    </span>
  );
}

function RosterTable({ students, compact = false }) {
  const rowPadding = compact ? "py-2.5" : "py-3";
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-200 bg-white text-left text-xs font-bold uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 sm:px-5">Student</th>
            <th className="px-4 py-3">IDNO</th>
            <th className="px-4 py-3">Program</th>
            <th className="px-4 py-3">Enrollment status</th>
            <th className="px-4 py-3">Enrolled</th>
            <th className="px-4 py-3">Source</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {students.map((student) => (
            <tr key={student.subject_enrollment_id} className="transition-colors hover:bg-slate-50">
              <td className={`whitespace-nowrap px-4 font-semibold text-ink sm:px-5 ${rowPadding}`}>
                {displayStudentName(student)}
              </td>
              <td className={`whitespace-nowrap px-4 text-slate-600 ${rowPadding}`}>{student.student_number}</td>
              <td className={`whitespace-nowrap px-4 text-slate-600 ${rowPadding}`}>{student.program_code}</td>
              <td className={`whitespace-nowrap px-4 ${rowPadding}`}><StatusBadge value={student.status} /></td>
              <td className={`whitespace-nowrap px-4 text-slate-600 ${rowPadding}`}>{formatDate(student.enrolled_at)}</td>
              <td className={`max-w-xs px-4 text-slate-600 ${rowPadding}`}>
                {student.source_reference || "Enrollment workspace"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function displayStudentName(student) {
  if (student.last_name || student.first_name) {
    return `${student.last_name || ""}, ${student.first_name || ""}`.replace(/^, /, "").trim();
  }
  return student.name || "Unnamed student";
}

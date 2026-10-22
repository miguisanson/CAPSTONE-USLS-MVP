import { useEffect, useState } from "react";
import { AlertTriangle, BookOpenCheck, Download, Lock, UsersRound } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Button, Card, DataTable, EmptyState, InlineNotice, PageHeader, Select, Spinner, StatusChip } from "../components/ui/index.js";
import { csvCell, downloadBlob, formatDate } from "../lib/format";
import { PAGE } from "../lib/labels.js";

const NO_CLASS_EMPTY = {
  icon: UsersRound,
  title: "No classes offered this semester",
  hint: "Add a subject under Course Adjustments → Offering setup, then enroll students to build its class list.",
};

const ROSTER_EMPTY = {
  icon: UsersRound,
  title: "No students enrolled in this class",
  hint: "Students appear here automatically after Enrollment or an imported class list is confirmed.",
};

const ROSTER_COLUMNS = [
  { key: "name", header: "Student", cell: (student) => <span className="whitespace-nowrap font-semibold text-ink">{displayStudentName(student)}</span> },
  { key: "student_number", header: "IDNO", className: "whitespace-nowrap text-slate-600" },
  { key: "program_code", header: "Program", className: "whitespace-nowrap text-slate-600" },
  { key: "status", header: "Enrollment status", cell: (student) => <StatusChip status={student.status} />, className: "whitespace-nowrap" },
  { key: "enrolled_at", header: "Enrolled", cell: (student) => formatDate(student.enrolled_at), className: "whitespace-nowrap text-slate-600" },
  { key: "source_reference", header: "Source", cell: (student) => student.source_reference || "Enrollment workspace", className: "max-w-xs text-slate-600" },
];

export default function EnrollmentClassList() {
  const { data: meta } = useApi(() => api.meta(), []);
  const [programId, setProgramId] = useState("");
  const [termId, setTermId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Changing a filter quickly sends several requests; only the newest answer may update the page.
    let current = true;
    setLoading(true);
    setError("");
    api.monitoringClassList({
      program_id: programId || undefined,
      term_id: termId || undefined,
      course_id: courseId && courseId !== "all" ? courseId : undefined,
      view: courseId === "all" ? "all" : undefined,
    })
      .then((result) => {
        if (!current) return;
        setData(result);
        setProgramId(String(result.program?.id || ""));
        setTermId(String(result.term?.id || ""));
        setCourseId(result.view === "all" ? "all" : String(result.selected_course_id || ""));
      })
      .catch((requestError) => current && setError(requestError.message))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [programId, termId, courseId]);

  function keepAllViewOrReset() {
    setCourseId((value) => (value === "all" ? "all" : ""));
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
    const lines = [["Subject", "Faculty", "Student", "IDNO", "Program", "Status", "Enrolled at", "Source"].map(csvCell).join(",")];
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
    // The byte-order mark makes Excel read names such as "Niño" as UTF-8.
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    downloadBlob(
      blob,
      data.view === "all"
        ? `class-lists-all-${data.program?.code || "enrollment"}.csv`
        : `class-list-${data.selected_offering?.course_code || data.program?.code || "enrollment"}.csv`,
    );
  }

  const programOptions = (meta?.programs || []).map((program) => ({ value: String(program.id), label: `${program.code} — ${program.name}` }));
  const termOptions = (data?.terms || meta?.terms || []).map((term) => ({
    value: String(term.id),
    label: `${term.label}${term.relative_label ? ` (${term.relative_label})` : ""}`,
  }));
  const viewOptions = [
    { value: "all", label: "All class lists" },
    ...(data?.offerings || []).map((offering) => ({ value: String(offering.course_id), label: `${offering.course_code} — ${offering.course_title}` })),
  ];

  return (
    <div className="page-stack animate-fade-up">
      <PageHeader
        icon={BookOpenCheck}
        title={PAGE.enrollmentClassList}
        description="Read-only class rosters synchronized automatically with confirmed Enrollment records."
      />

      <Card>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            aria-label="Program"
            placeholder=""
            value={programId}
            options={programOptions}
            onChange={(event) => {
              setProgramId(event.target.value);
              keepAllViewOrReset();
            }}
          />
          <Select
            aria-label="Semester"
            placeholder=""
            value={termId}
            options={termOptions}
            onChange={(event) => {
              setTermId(event.target.value);
              keepAllViewOrReset();
            }}
          />
          <Select aria-label="Class list view" placeholder="" value={courseId} options={viewOptions} onChange={(event) => setCourseId(event.target.value)} />
          <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={!data}>
            Export CSV
          </Button>
        </div>
      </Card>

      <InlineNotice tone="neutral" icon={Lock} title="Read-only roster.">
        Confirm or change enrollment in the Enrollment workspace; this list updates automatically.
      </InlineNotice>

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
  if (!data?.offerings?.length) return <EmptyState {...NO_CLASS_EMPTY} />;
  return (
    <Card pad="none" className="overflow-hidden">
      <ClassListHeader
        offering={data.selected_offering}
        listed={data.summary?.students_in_selected_class || 0}
        active={data.summary?.active_students || 0}
        eyebrow="Enrollment-synchronized class list"
      />
      <div className="p-3 sm:p-4">
        <RosterTable students={data.students || []} caption={`Students enrolled in ${data.selected_offering?.course_code || "this class"}`} />
      </div>
    </Card>
  );
}

function AllClassListsPanel({ data }) {
  if (!data?.offerings?.length) return <EmptyState {...NO_CLASS_EMPTY} />;
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">All class lists</p>
            <h2 className="section-title mt-1">
              {data.program?.code} · {data.term?.label}
            </h2>
            <p className="mt-1 text-sm text-slate-500">Every offered class is expanded below for one-page review.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <SummaryPill>{count(data.summary?.offered_classes, "class", "classes")}</SummaryPill>
            <SummaryPill tone="brand">{count(data.summary?.class_list_entries, "roster entry", "roster entries")}</SummaryPill>
            <SummaryPill>{count(data.summary?.unique_students, "student", "students")}</SummaryPill>
          </div>
        </div>
      </Card>

      {(data.class_lists || []).map((classList) => (
        <Card key={classList.offering.course_id} pad="none" className="overflow-hidden">
          <ClassListHeader offering={classList.offering} listed={classList.summary?.listed || 0} active={classList.summary?.active || 0} />
          <div className="p-3 sm:p-4">
            <RosterTable students={classList.students || []} dense caption={`Students enrolled in ${classList.offering?.course_code}`} />
          </div>
        </Card>
      ))}
    </div>
  );
}

function ClassListHeader({ offering, listed, active, eyebrow = "" }) {
  return (
    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5 sm:py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h3 className={eyebrow ? "section-title mt-1" : "card-title"}>
            {offering?.course_code} — {offering?.course_title}
          </h3>
          <p className="meta mt-1 sm:text-sm">
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
    <span className={`rounded-lg border px-3 py-2 font-semibold ${tone === "brand" ? "border-brand-200 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-700"}`}>
      {children}
    </span>
  );
}

// A class list is reviewed on one page, so it is never split into pages (pageSize 0).
function RosterTable({ students, dense = false, caption }) {
  return (
    <DataTable
      caption={caption}
      columns={ROSTER_COLUMNS}
      rows={students}
      rowKey="subject_enrollment_id"
      minWidth="md"
      dense={dense}
      pageSize={0}
      empty={ROSTER_EMPTY}
    />
  );
}

function displayStudentName(student) {
  if (student.last_name || student.first_name) {
    return `${student.last_name || ""}, ${student.first_name || ""}`.replace(/^, /, "").trim();
  }
  return student.name || "Unnamed student";
}

function count(value, one, many) {
  const n = value || 0;
  return `${n} ${n === 1 ? one : many}`;
}

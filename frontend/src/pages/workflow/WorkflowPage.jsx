import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  UserPlus,
  ClipboardCheck,
  FileCheck,
  Users,
  CalendarCheck,
  Briefcase,
  GraduationCap,
  CheckCircle2,
  Info,
  AlertTriangle,
  CalendarDays,
  UserRoundCheck,
  History,
  HelpCircle,
} from "lucide-react";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { Button, Card, EmptyState, InlineNotice, PageHeader, SectionTitle, SkeletonBoard, Spinner, Tabs } from "../../components/ui/index.js";
import StudentPicker from "../../components/StudentPicker";
import { useAuth } from "../../auth";
import { OnboardingGatePanel } from "../../components/ProcessGates";
import PolicyRules from "../../components/PolicyRules";
import AdviserAppointments from "../AdviserAppointments";
import CalendarPage from "../../components/calendar/CalendarPage";
import ProcessBoardPage from "../../components/ProcessBoardPage";
import { PROCESS_SLUGS } from "../../components/processConfig";
import { CourseAuditPanel } from "./CourseAudit";
import { DefenseSchedulingForm } from "./DefenseScheduling";
import { GraduationRoster } from "./GraduationRoster";
import { HandoffPanel } from "./HandoffImport";
import { PanelMatchingForm } from "./PanelMatching";
import { PracticumRoster } from "./Practicum";
import { ResearchGateForm } from "./ResearchGate";
import ResearchGateOverview from "./ResearchGateOverview";
import { WorkflowSupportModal } from "./shared";

// Which business-rules process each workflow screen applies.
const RULE_PROCESS_BY_SLUG = {
  "research-gate": "research",
  "panel-matching": "defense",
  "defense-scheduling": "defense",
  practicum: "practicum",
  graduation: "graduation",
};

const ICONS = {
  "student-handoff": UserPlus,
  "course-audit": ClipboardCheck,
  "research-gate": FileCheck,
  "panel-matching": Users,
  "defense-scheduling": CalendarCheck,
  practicum: Briefcase,
  graduation: GraduationCap,
};

// Pages that are a staged board: they report what happened in the board notice (not a banner) and load as a skeleton board.
const BOARD_SLUGS = new Set(["practicum", "graduation"]);

// One more sentence for the page description (it used to be a loose line under the header).
const PAGE_NOTE = {
  practicum: "Practicum applies to Psychology and MSGC students only; other programs are not listed.",
  graduation: "The Academic Coordinator checks coursework, the Research Coordinator validates research evidence, Graduate School staff prepare the list, and the Dean owns the endorsement and export.",
};

const NEEDS_STUDENT = {
  "student-handoff": false,
  "course-audit": false,
  "research-gate": true,
  "panel-matching": true,
  "defense-scheduling": true,
  practicum: false,
  graduation: false,
};

// The defense calendar and adviser designation are steps of the research flow, not processes of their
// own: they open as tabs inside Research Gate and Defense Scheduling (?view=adviser / ?view=calendar).
const SUBVIEW_TABS = {
  "research-gate": [
    { key: "", label: "Research Gate", icon: FileCheck },
    { key: "adviser", label: "Adviser designation", icon: UserRoundCheck },
  ],
  "defense-scheduling": [
    { key: "", label: "Scheduling", icon: CalendarCheck },
    { key: "calendar", label: "Calendar", icon: CalendarDays },
  ],
};

// Leave of Absence, Readmission, AWOL & Residency and Withdrawal are one page template
// (ProcessBoardPage) with a different process. Every other workflow keeps its own screen.
export default function WorkflowPage() {
  const { slug } = useParams();
  if (PROCESS_SLUGS.includes(slug)) return <ProcessBoardPage key={slug} slug={slug} />;
  return <SingleWorkflowPage key={slug} />;
}

function SingleWorkflowPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: meta } = useApi(() => api.meta(), []);
  const [studentId, setStudentId] = useState(() => {
    const value = searchParams.get("student_id"); // only an explicit link carries a student over (I-207, AD12)
    return value ? Number(value) : null;
  });
  const [studentLabel, setStudentLabel] = useState("");
  const [onboardingKey, setOnboardingKey] = useState(0); // I-011: remounting reloads the onboarding report panel after an import
  const [specialization, setSpecialization] = useState("");
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [supportModal, setSupportModal] = useState("");

  // The query string keeps the chosen student for this page and makes the view shareable. Nothing is remembered
  // across pages: the links that should carry a student (Research Gate list, "Open matching", calendar) say so in the URL.
  useEffect(() => {
    setSpecialization("");
    setResult(null);
    setSubmitError("");
  }, [slug]);

  useEffect(() => {
    if (studentId) {
      if (searchParams.get("student_id") !== String(studentId)) {
        const next = new URLSearchParams(searchParams);
        next.set("student_id", String(studentId));
        setSearchParams(next, { replace: true });
      }
    }
  }, [slug, studentId, searchParams, setSearchParams]);

  const { data: context, loading, error, refetch } = useApi(
    () => api.transactionContext(slug, { student_id: studentId, specialization }),
    [slug, studentId, specialization]
  );

  const tx = context?.transaction || meta?.transactions?.find((t) => t.slug === slug);
  const Icon = ICONS[slug] || FileCheck;
  const needsStudent = NEEDS_STUDENT[slug];
  const subviewTabs = SUBVIEW_TABS[slug] || null;
  const subview = subviewTabs && subviewTabs.some((tab) => tab.key && tab.key === searchParams.get("view")) ? searchParams.get("view") : "";

  function changeSubview(key) {
    const next = new URLSearchParams(searchParams);
    if (key) next.set("view", key);
    else next.delete("view");
    setSearchParams(next, { replace: true });
  }

  // A link such as "Open in Defense Scheduling" from the calendar tab changes only the URL:
  // follow the student it names.
  const urlStudentId = searchParams.get("student_id");
  useEffect(() => {
    if (urlStudentId && Number(urlStudentId) !== studentId) {
      setStudentId(Number(urlStudentId));
      setStudentLabel("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlStudentId]);

  useEffect(() => {
    if (!studentLabel && context?.selected_student?.search_label) {
      setStudentLabel(context.selected_student.search_label);
    }
  }, [context, studentLabel]);

  // `strict` is for a caller that shows the outcome itself (a step dialog and the board notice): it gets the answer back, or the
  // refusal is thrown, and this page puts nothing on screen.
  async function submit(payload, { strict = false } = {}) {
    setSubmitting(true);
    setSubmitError("");
    setResult(null);
    try {
      const res = await api.submitTransaction(slug, payload);
      if (!strict) setResult(res);
      await refetch();
      return strict ? res : true;
    } catch (err) {
      const message = err.message || "Could not save. Please review the form.";
      if (strict) throw new Error(message);
      setSubmitError(message);
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  if (!tx) return <Spinner label="Loading workflow…" />;

  const formProps = {
    meta,
    context,
    studentId,
    studentLabel,
    setStudentId,
    setStudentLabel,
    specialization,
    setSpecialization,
    submit,
    submitting,
    refreshing: loading,
    result,
    submitError,
    clearSubmitFeedback: () => {
      setResult(null);
      setSubmitError("");
    },
    refetch,
    accountRole: user?.role,
  };

  return (
    <div className="page-stack animate-fade-up">
      <PageHeader
        title={tx.title}
        description={[tx.short, PAGE_NOTE[slug]].filter(Boolean).join(" ")}
        forms={slug === "research-gate" && subview === "adviser" ? "adviser-designation" : slug}
        icon={Icon}
        actions={(
          <>
            <Button variant="secondary" icon={HelpCircle} onClick={() => setSupportModal("guide")}>How this works</Button>
            <Button variant="secondary" icon={History} onClick={() => setSupportModal("activity")}>View recent activity</Button>
          </>
        )}
      />

      <PolicyRules process={RULE_PROCESS_BY_SLUG[slug]} />

      {subviewTabs && <Tabs label="Views" tabs={subviewTabs} value={subview} onChange={changeSubview} />}

      {!BOARD_SLUGS.has(slug) && slug !== "defense-scheduling" && result && <InlineNotice tone="success" icon={CheckCircle2}>{result.message}</InlineNotice>}
      {!BOARD_SLUGS.has(slug) && slug !== "defense-scheduling" && submitError && <InlineNotice tone="danger">{submitError}</InlineNotice>}

      <div className="page-stack">
        {subview === "adviser" && <AdviserAppointments role={user?.role} embedded />}
        {subview === "calendar" && (
          <CalendarPage scope="staff" embedded title="Defense calendar" description="All defenses with stage, status, panel and venue, plus the protocol deadlines. Open a defense to reschedule it in the Scheduling tab." />
        )}
        {!subview && slug === "research-gate" && (
          <ResearchGateOverview
            selectedId={studentId}
            onOpen={(student) => {
              setStudentId(student.id);
              setStudentLabel("");
              setResult(null);
              window.setTimeout(() => document.getElementById("workflow-student")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
            }}
          />
        )}
        {!subview && needsStudent && (
          <Card pad="lg" id="workflow-student" className="scroll-mt-24">
            <SectionTitle title="Choose a student" subtitle="Pick the record this action applies to" icon={Users} />
            <StudentPicker
              value={studentId}
              selectedLabel={studentLabel}
              meta={meta}
              onChange={(id, label) => {
                setStudentId(id);
                setStudentLabel(label || "");
                setResult(null);
                if (!id) {
                  const next = new URLSearchParams(searchParams);
                  next.delete("student_id");
                  setSearchParams(next, { replace: true });
                }
              }}
            />
          </Card>
        )}

        {subview ? null : needsStudent && !studentId ? (
          <Card pad="lg">
            <EmptyState icon={Info} title="Select a student to begin" hint="Search above to load this student's current monitoring data." />
          </Card>
        ) : loading && !context ? (
          BOARD_SLUGS.has(slug) ? (
            <SkeletonBoard columns={4} label="Loading board" />
          ) : (
            <Card pad="lg">
              <Spinner label="Loading workflow data…" />
            </Card>
          )
        ) : error && !context ? (
          <Card pad="lg">
            <EmptyState icon={AlertTriangle} title="Could not load workflow" hint={error} />
          </Card>
        ) : slug === "research-gate" ? (
          <ResearchGateForm {...formProps} />
        ) : slug === "practicum" ? (
          <PracticumRoster {...formProps} />
        ) : slug === "defense-scheduling" ? (
          <DefenseSchedulingForm {...formProps} />
        ) : slug === "graduation" ? (
          <GraduationRoster {...formProps} />
        ) : (
          <Card pad="lg">
            {slug === "student-handoff" && <HandoffPanel {...formProps} onImported={() => setOnboardingKey((k) => k + 1)} />}
            {slug === "course-audit" && <CourseAuditPanel meta={meta} />}
            {slug === "panel-matching" && <PanelMatchingForm {...formProps} />}
          </Card>
        )}

        {/* BPMN 1 Admission: the onboarding report and the Dean's approval
            gate that turns an import batch into a recorded admission completion. */}
        {!subview && slug === "student-handoff" ? (
          <div><OnboardingGatePanel key={onboardingKey} role={user?.role} /></div>
        ) : null}
      </div>
      {supportModal && (
        <WorkflowSupportModal
          slug={slug}
          mode={supportModal}
          logs={context?.recent_logs || []}
          summary={workflowGuidance(slug)}
          actor={tx.actor}
          data={tx.data}
          policyQuestions={context?.deployment_policy_questions || []}
          onClose={() => setSupportModal("")}
        />
      )}
    </div>
  );
}

function workflowGuidance(slug) {
  const map = {
    "student-handoff":
      "Official source data arrives as a file. Upload the AC Student Monitoring sheet and the platform creates each student, their program and curriculum, and marks the subjects already completed automatically — no manual typing. A NOTE of LOA, AWOL or withdrawn on a new student is taken in as their standing. Subjects a student is enrolled in this semester come from the class list (Enrollment), not from this sheet.",
    "course-audit":
      "Run at the end of the semester. Pick a subject to see its enrolled students, then tick who completed it. Saving updates each student's course audit and missing count; a student who clears all subjects advances to Proposal Development.",
    "research-gate":
      "Reads the student's stored PDF evidence for the selected gate. The Academic Coordinator endorses Form 1; the panel chair, or Graduate School staff or the Research Coordinator for the panel, records each defense verdict (Passed; Passed with minor revisions; Provisional pass, revisions or re-defense; Deferred; Failed) and the stage completes only when its follow-up is done. Staff cannot manually mark an absent document as received.",
    "panel-matching":
      "Opens after the Academic Coordinator has endorsed Form 1. The Research Coordinator nominates the panel: the system reads the uploaded papers, ranks faculty expertise with availability and current panel load, and the panel size follows the paper type (the external panelist joins from the proposal defense). The student's adviser cannot sit on the panel. The proposal panel carries to the final defense unless changed with a reason.",
    "defense-scheduling":
      "Opens only after panel matching. GS staff and the Research Coordinator book the defense for the student's current stage only. Title defense needs 14 days after the Form 1 endorsement; proposal and final need 14 days after the panel received the manuscript. Past slots are refused, an override needs a recorded reason, and a booking is moved or cancelled with a reason instead of being overwritten.",
    practicum:
      "Available only to Psychology and Master of Science in Guidance and Counseling (MSGC) students. Staff record MOA receipt, review certificates and hours, request additional certificates when hours are short, and route completed reports to the Dean.",
    graduation:
      "This is the Graduate School monitoring and endorsement layer. It checks coursework, research completion evidence, practicum when required, and pending tasks before staff send the endorsement list for Dean review and export.",
  };
  return map[slug] || "";
}

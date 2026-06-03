import {
  Activity,
  AlertTriangle,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  GitPullRequestArrow,
  GraduationCap,
  Search,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { handleApiError } from "../api/client";
import { studentsApi, transactionsApi, usersApi } from "../api/endpoints";
import { useAuth } from "../app/AuthContext";
import { EmptyState } from "../components/EmptyState";
import { LoadingBlock } from "../components/LoadingBlock";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { KpiCard } from "../components/ui/KpiCard";
import { PageHeader } from "../components/ui/PageHeader";
import { SectionTitle } from "../components/ui/SectionTitle";
import type {
  CompletionTransactionModel,
  CourseworkTransactionModel,
  FollowUpTransactionModel,
  LifecycleTransactionModel,
  ResearchTransactionModel,
  RoleName,
  SchedulingTransactionModel,
  StudentListItem,
  TaskDecision,
  TransactionComponentDefinition,
  TransactionRecordPayload,
  UserAccount,
} from "../types/domain";
import { formatDate, formatDateTime, readableEnum } from "../utils/format";
import { alertStatusTone, scheduleStatusTone, stageTone, taskStatusTone } from "../utils/presentation";

type ComponentKey = TransactionComponentDefinition["key"];

type Models = {
  lifecycle?: LifecycleTransactionModel;
  coursework?: CourseworkTransactionModel;
  research?: ResearchTransactionModel;
  scheduling?: SchedulingTransactionModel;
  completion?: CompletionTransactionModel;
  followUp?: FollowUpTransactionModel;
};

const componentIcons: Record<ComponentKey, typeof Activity> = {
  lifecycle: GitPullRequestArrow,
  coursework: BookOpenCheck,
  research: FileCheck2,
  scheduling: CalendarClock,
  completion: GraduationCap,
  followUp: AlertTriangle,
};

const actorRoles: RoleName[] = [
  "ADMIN",
  "GRADUATE_SCHOOL_STAFF",
  "ACADEMIC_COORDINATOR",
  "RESEARCH_COORDINATOR",
  "ADVISER",
  "PANEL_MEMBER",
  "STUDENT",
];

const decisions: TaskDecision[] = ["APPROVE", "REVISE", "RETURN"];

const defaultStudentProfile = {
  studentNumber: "",
  firstName: "",
  lastName: "",
  email: "",
  programCode: "MSCS",
};

const compactStudentLabel = (student: StudentListItem) =>
  `${student.studentNumber} - ${student.firstName} ${student.lastName}`;

const splitLines = (value: string): string[] =>
  value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);

export const TransactionsPage = () => {
  const { user } = useAuth();
  const isStudent = (user?.roles ?? []).includes("STUDENT");
  const [definitions, setDefinitions] = useState<TransactionComponentDefinition[]>([]);
  const [activeComponent, setActiveComponent] = useState<ComponentKey>("lifecycle");
  const [models, setModels] = useState<Models>({});
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [transactionKey, setTransactionKey] = useState("STUDENT_HANDOFF");
  const [studentId, setStudentId] = useState<number | "">("");
  const [actorRole, setActorRole] = useState<RoleName>((user?.roles[0] as RoleName | undefined) ?? "GRADUATE_SCHOOL_STAFF");
  const [sourceReference, setSourceReference] = useState("");
  const [statusResult, setStatusResult] = useState("");
  const [missingItems, setMissingItems] = useState("");
  const [decisionOutcome, setDecisionOutcome] = useState<TaskDecision | "">("");
  const [nextOwnerRole, setNextOwnerRole] = useState<RoleName>("GRADUATE_SCHOOL_STAFF");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [notes, setNotes] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [studentProfile, setStudentProfile] = useState(defaultStudentProfile);
  const [adviserUserId, setAdviserUserId] = useState<number | "">("");
  const [panelUserIds, setPanelUserIds] = useState<number[]>([]);

  const load = async () => {
    try {
      setLoading(true);
      const [definitionRes, lifecycle, coursework, research, scheduling, completion, followUp] = await Promise.all([
        transactionsApi.definitions(),
        transactionsApi.lifecycle(),
        transactionsApi.coursework(),
        transactionsApi.research(),
        transactionsApi.scheduling(),
        transactionsApi.completion(),
        transactionsApi.followUp(),
      ]);
      setDefinitions(definitionRes.components);
      setModels({ lifecycle, coursework, research, scheduling, completion, followUp });
      const firstTransaction = definitionRes.components.find((component) => component.key === activeComponent)?.transactions[0];
      if (firstTransaction && !definitionRes.components.some((component) => component.transactions.some((item) => item.key === transactionKey))) {
        setTransactionKey(firstTransaction.key);
      }

      if (isStudent) {
        const me = await studentsApi.me();
        setStudents([
          {
            id: me.id,
            studentNumber: me.studentNumber,
            firstName: me.firstName,
            lastName: me.lastName,
            email: me.email,
            currentStage: me.currentStage,
            riskFlag: me.riskFlag,
            program: me.program,
            adviser: me.adviser,
            researchCoordinator: me.researchCoordinator,
          },
        ]);
        setStudentId(me.id);
      } else {
        const studentRes = await studentsApi.list({ pageSize: 250 });
        setStudents(studentRes.items);
        setStudentId((prev) => prev || studentRes.items[0]?.id || "");
        const userRes = await usersApi.list({ pageSize: 250 }).catch(() => null);
        setUsers(userRes?.items ?? []);
      }

      setError(null);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [isStudent]);

  const activeDefinition = useMemo(
    () => definitions.find((component) => component.key === activeComponent),
    [activeComponent, definitions]
  );

  useEffect(() => {
    const firstTransaction = activeDefinition?.transactions[0];
    if (firstTransaction && !activeDefinition.transactions.some((item) => item.key === transactionKey)) {
      setTransactionKey(firstTransaction.key);
    }
  }, [activeDefinition, transactionKey]);

  const selectedTransaction = useMemo(
    () => activeDefinition?.transactions.find((transaction) => transaction.key === transactionKey),
    [activeDefinition, transactionKey]
  );

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students;
    const query = search.toLowerCase();
    return students.filter((student) =>
      `${student.studentNumber} ${student.firstName} ${student.lastName} ${student.program.code}`.toLowerCase().includes(query)
    );
  }, [search, students]);

  const adviserOptions = users.filter((item) => item.roles.includes("ADVISER"));
  const panelOptions = users.filter((item) => item.roles.includes("PANEL_MEMBER"));

  const submitTransaction = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedTransaction) return;

    const isHandoff = transactionKey === "STUDENT_HANDOFF";
    if (!isHandoff && !studentId) {
      setError("Select a student for this transaction.");
      return;
    }

    const payload: TransactionRecordPayload = {
      transactionKey,
      studentId: isHandoff ? null : Number(studentId),
      actorRole,
      sourceReference: sourceReference || null,
      statusResult: statusResult || null,
      missingItems: splitLines(missingItems),
      decisionOutcome: decisionOutcome || null,
      nextOwnerRole,
      evidenceNote: evidenceNote || null,
      notes: notes || null,
      effectiveFrom: effectiveFrom || null,
      effectiveTo: effectiveTo || null,
      adviserUserId: adviserUserId ? Number(adviserUserId) : null,
      panelUserIds,
      studentProfile: isHandoff
        ? {
            studentNumber: studentProfile.studentNumber,
            firstName: studentProfile.firstName,
            lastName: studentProfile.lastName,
            email: studentProfile.email || null,
            programCode: studentProfile.programCode,
          }
        : null,
    };

    try {
      setSubmitting(true);
      const response = await transactionsApi.record(payload);
      setSuccess(`${readableEnum(response.transactionKey)} recorded${response.studentId ? ` for student #${response.studentId}` : ""}.`);
      setError(null);
      setSourceReference("");
      setStatusResult("");
      setMissingItems("");
      setDecisionOutcome("");
      setEvidenceNote("");
      setNotes("");
      setEffectiveFrom("");
      setEffectiveTo("");
      setStudentProfile(defaultStudentProfile);
      await load();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingBlock text="Loading transaction workbench..." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Transaction Workbench"
        subtitle="Major components are grouped by the updated transaction list, with P0 workflows prioritized."
        help={{
          title: "Transaction List Alignment",
          summary: "Each workflow records source/reference, result, missing items, decision, next owner, timestamp, notes, and evidence into the monitoring tables.",
          recommendation: "Process P0 transactions first, then clear supporting P1 checks for the same student cases.",
        }}
      />

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {success ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div> : null}

      <section className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {definitions.map((component) => {
          const Icon = componentIcons[component.key];
          const p0Count = component.transactions.filter((transaction) => transaction.priority === "P0").length;
          return (
            <button
              key={component.key}
              type="button"
              onClick={() => setActiveComponent(component.key)}
              className={`rounded-lg border px-3 py-3 text-left transition ${
                activeComponent === component.key
                  ? "border-[var(--gs-primary)] bg-[var(--gs-primary)] text-white"
                  : "border-slate-200 bg-white text-slate-800 hover:border-[var(--gs-primary)]"
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <p className="font-semibold">{component.title}</p>
              </div>
              <p className={`mt-1 text-xs ${activeComponent === component.key ? "text-white/85" : "text-slate-500"}`}>
                {component.transactions.length} transaction(s) | {p0Count} P0
              </p>
            </button>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <Card>
            <CardBody className="p-4 md:p-5">
              <SectionTitle title={activeDefinition?.title ?? "Transactions"} subtitle="Workflow rows from the updated Transaction List" />
              <div className="space-y-2">
                {(activeDefinition?.transactions ?? []).map((transaction) => (
                  <button
                    key={transaction.key}
                    type="button"
                    onClick={() => setTransactionKey(transaction.key)}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                      transactionKey === transaction.key
                        ? "border-[var(--gs-primary)] bg-[var(--gs-primary-soft)]"
                        : "border-slate-200 bg-slate-50 hover:border-[var(--gs-primary)]"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{transaction.transaction}</p>
                      <Badge tone={transaction.priority === "P0" ? "danger" : "info"}>{transaction.priority}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{transaction.dataCaptured}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Actor/s: {transaction.actors.map((actor) => readableEnum(actor)).join(", ")}
                    </p>
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>

          {renderModel(activeComponent, models)}
        </div>

        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle title="Record Transaction" subtitle={selectedTransaction?.priority ? `${selectedTransaction.priority} workflow entry` : ""} />
            <form className="space-y-3" onSubmit={(event) => void submitTransaction(event)}>
              <label className="block">
                <span className="text-xs font-semibold text-slate-700">Transaction</span>
                <select
                  value={transactionKey}
                  onChange={(event) => setTransactionKey(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                >
                  {(activeDefinition?.transactions ?? []).map((transaction) => (
                    <option key={transaction.key} value={transaction.key}>
                      {transaction.priority} - {transaction.transaction}
                    </option>
                  ))}
                </select>
              </label>

              {transactionKey === "STUDENT_HANDOFF" ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    value={studentProfile.studentNumber}
                    onChange={(event) => setStudentProfile((prev) => ({ ...prev, studentNumber: event.target.value }))}
                    className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                    placeholder="Student number"
                    required
                  />
                  <input
                    value={studentProfile.programCode}
                    onChange={(event) => setStudentProfile((prev) => ({ ...prev, programCode: event.target.value }))}
                    className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                    placeholder="Program code"
                    required
                  />
                  <input
                    value={studentProfile.firstName}
                    onChange={(event) => setStudentProfile((prev) => ({ ...prev, firstName: event.target.value }))}
                    className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                    placeholder="First name"
                    required
                  />
                  <input
                    value={studentProfile.lastName}
                    onChange={(event) => setStudentProfile((prev) => ({ ...prev, lastName: event.target.value }))}
                    className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                    placeholder="Last name"
                    required
                  />
                  <input
                    value={studentProfile.email}
                    onChange={(event) => setStudentProfile((prev) => ({ ...prev, email: event.target.value }))}
                    className="h-10 rounded-md border border-slate-300 px-3 text-sm sm:col-span-2"
                    placeholder="Email"
                  />
                </div>
              ) : (
                <>
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-2.5 top-[33px] h-4 w-4 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-700">Search Student</span>
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="mt-1 h-10 w-full rounded-md border border-slate-300 pl-8 pr-3 text-sm"
                      placeholder="Search student number, name, program"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-700">Student / Case</span>
                    <select
                      value={studentId}
                      onChange={(event) => setStudentId(Number(event.target.value))}
                      className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                      disabled={isStudent}
                    >
                      {filteredStudents.map((student) => (
                        <option key={student.id} value={student.id}>
                          {compactStudentLabel(student)} | {student.program.code}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Actor Role</span>
                  <select
                    value={actorRole}
                    onChange={(event) => setActorRole(event.target.value as RoleName)}
                    className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  >
                    {actorRoles.map((role) => (
                      <option key={role} value={role}>
                        {readableEnum(role)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Next Owner</span>
                  <select
                    value={nextOwnerRole}
                    onChange={(event) => setNextOwnerRole(event.target.value as RoleName)}
                    className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  >
                    {actorRoles.map((role) => (
                      <option key={role} value={role}>
                        {readableEnum(role)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-slate-700">Source / Reference</span>
                <input
                  value={sourceReference}
                  onChange={(event) => setSourceReference(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  placeholder="AIMS export, email thread, form number, meeting note"
                />
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Status / Result</span>
                  <input
                    value={statusResult}
                    onChange={(event) => setStatusResult(event.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                    placeholder="confirmed, missing items, ready"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Decision</span>
                  <select
                    value={decisionOutcome}
                    onChange={(event) => setDecisionOutcome(event.target.value as TaskDecision | "")}
                    className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  >
                    <option value="">No decision</option>
                    {decisions.map((decision) => (
                      <option key={decision} value={decision}>
                        {readableEnum(decision)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {transactionKey === "ADVISER_DESIGNATION" ? (
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Appointed Adviser</span>
                  <select
                    value={adviserUserId}
                    onChange={(event) => setAdviserUserId(Number(event.target.value))}
                    className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  >
                    <option value="">No adviser selected</option>
                    {adviserOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.fullName}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {transactionKey === "PANEL_MATCH" ? (
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Panel Candidates</span>
                  <select
                    multiple
                    value={panelUserIds.map(String)}
                    onChange={(event) =>
                      setPanelUserIds(Array.from(event.target.selectedOptions).map((option) => Number(option.value)))
                    }
                    className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  >
                    {panelOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.fullName}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Timestamp / Effective From</span>
                  <input
                    type="datetime-local"
                    value={effectiveFrom}
                    onChange={(event) => setEffectiveFrom(event.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-slate-700">Due / Effective To</span>
                  <input
                    type="datetime-local"
                    value={effectiveTo}
                    onChange={(event) => setEffectiveTo(event.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-semibold text-slate-700">Missing Items / Affected Items</span>
                <textarea
                  value={missingItems}
                  onChange={(event) => setMissingItems(event.target.value)}
                  className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="One item per line"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-700">Evidence Note</span>
                <input
                  value={evidenceNote}
                  onChange={(event) => setEvidenceNote(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                  placeholder="Uploaded file, checklist, clearance, email proof"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-slate-700">Notes</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="mt-1 min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Operational notes, routing context, constraints"
                />
              </label>

              <Button className="w-full" type="submit" disabled={submitting}>
                <ClipboardList className="h-4 w-4" />
                {submitting ? "Recording..." : "Record Transaction"}
              </Button>
            </form>
          </CardBody>
        </Card>
      </section>
    </div>
  );
};

const renderModel = (component: ComponentKey, models: Models) => {
  if (component === "lifecycle") return <LifecycleModelView data={models.lifecycle} />;
  if (component === "coursework") return <CourseworkModelView data={models.coursework} />;
  if (component === "research") return <ResearchModelView data={models.research} />;
  if (component === "scheduling") return <SchedulingModelView data={models.scheduling} />;
  if (component === "completion") return <CompletionModelView data={models.completion} />;
  return <FollowUpModelView data={models.followUp} />;
};

const LifecycleModelView = ({ data }: { data?: LifecycleTransactionModel }) => {
  if (!data) return <EmptyState message="Lifecycle transaction data unavailable." />;
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Students in Scope" value={data.summary.totalInScope} icon={<Activity className="h-5 w-5" />} />
        <KpiCard label="Admission Handoffs" value={data.summary.admissionRecords} tone="primary" />
        <KpiCard label="LOA Active" value={data.summary.loaActive} tone={data.summary.loaActive > 0 ? "warning" : "success"} />
        <KpiCard label="Lifecycle Tasks" value={data.summary.openLifecycleTasks} tone={data.summary.openLifecycleTasks > 0 ? "warning" : "success"} />
      </section>
      <Card>
        <CardBody className="p-4 md:p-5">
          <SectionTitle title="Lifecycle Queue" subtitle="Handoff, onboarding, standing, LOA, readmission, and withdrawal signals" />
          <div className="grid gap-3 lg:grid-cols-2">
            <ListPanel
              title="Admission / Handoff"
              rows={data.handoffCandidates.map((student) => ({
                key: student.id,
                title: `${student.studentNumber} - ${student.firstName} ${student.lastName}`,
                meta: `${student.program.code} | ${readableEnum(student.currentStage)}`,
                badge: "ADMISSION",
              }))}
            />
            <ListPanel
              title="LOA / Pause"
              rows={data.loaCases.map((student) => ({
                key: student.id,
                title: `${student.studentNumber} - ${student.firstName} ${student.lastName}`,
                meta: `${student.program.code} | ${formatDate(student.loaStart)} to ${formatDate(student.loaEnd)}`,
                badge: "LOA",
              }))}
            />
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

const CourseworkModelView = ({ data }: { data?: CourseworkTransactionModel }) => {
  if (!data) return <EmptyState message="Coursework transaction data unavailable." />;
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Audited Students" value={data.summary.auditedStudents} icon={<BookOpenCheck className="h-5 w-5" />} />
        <KpiCard label="Complete Coursework" value={data.summary.completeCoursework} tone="success" />
        <KpiCard label="Missing Subject Cases" value={data.summary.missingSubjectCases} tone="warning" />
        <KpiCard label="High-Demand Subjects" value={data.summary.highDemandSubjects} tone="primary" />
      </section>
      <Card>
        <CardBody className="p-4 md:p-5">
          <SectionTitle title="Course Audit and Offering Demand" subtitle="Curriculum matching, missing subjects, and class planning signals" />
          <div className="grid gap-3 xl:grid-cols-2">
            <ListPanel
              title="Course Audit Cases"
              rows={data.courseAudits.slice(0, 12).map((audit) => ({
                key: audit.student.id,
                title: audit.student.label,
                meta: `${audit.curriculum?.code ?? "No curriculum"} | Missing ${audit.missingCount} | Current ${audit.currentCount}`,
                badge: audit.result,
              }))}
            />
            <ListPanel
              title="Offering Demand"
              rows={data.offeringDemand.slice(0, 12).map((row) => ({
                key: row.courseCode,
                title: `${row.courseCode} - ${row.courseTitle}`,
                meta: `${row.count} eligible/missing student(s)`,
                badge: String(row.count),
              }))}
            />
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

const ResearchModelView = ({ data }: { data?: ResearchTransactionModel }) => {
  if (!data) return <EmptyState message="Research transaction data unavailable." />;
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Research Cases" value={data.summary.researchCases} icon={<FileCheck2 className="h-5 w-5" />} />
        <KpiCard label="Ready" value={data.summary.readyCases} tone="success" />
        <KpiCard label="Needs Revision" value={data.summary.revisionCases} tone="warning" />
        <KpiCard label="Missing Evidence" value={data.summary.missingEvidenceCases} tone="danger" />
      </section>
      <Card>
        <CardBody className="p-4 md:p-5">
          <SectionTitle title="Research Gate Readiness" subtitle="Form readiness, defense results, adviser designation, revision and clearance state" />
          <ListPanel
            title="Gate Cases"
            rows={data.gateCases.slice(0, 16).map((item) => ({
              key: item.student.id,
              title: `${item.student.studentNumber} - ${item.student.firstName} ${item.student.lastName}`,
              meta: `${item.researchCase?.topicTitle ?? "No topic"} | Evidence ${item.approvedEvidence}/${item.requiredEvidence} | Revisions ${item.openRevisionCount}`,
              badge: item.readiness,
            }))}
          />
        </CardBody>
      </Card>
    </div>
  );
};

const SchedulingModelView = ({ data }: { data?: SchedulingTransactionModel }) => {
  if (!data) return <EmptyState message="Scheduling transaction data unavailable." />;
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Requests" value={data.summary.requests} icon={<CalendarClock className="h-5 w-5" />} />
        <KpiCard label="Confirmed" value={data.summary.confirmed} tone="success" />
        <KpiCard label="Delayed" value={data.summary.delayed} tone={data.summary.delayed > 0 ? "danger" : "success"} />
        <KpiCard label="Match Found" value={data.summary.matchFound} tone="primary" />
      </section>
      <Card>
        <CardBody className="p-4 md:p-5">
          <SectionTitle title="Panel and Schedule Matching" subtitle="Availability overlap, reschedule count, and scheduling delay signals" />
          <div className="space-y-2">
            {data.scheduleCases.slice(0, 16).map((item) => (
              <article key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    Request #{item.id} - {item.student ? `${item.student.firstName} ${item.student.lastName}` : `Student #${item.studentId}`}
                  </p>
                  <Badge tone={scheduleStatusTone(item.status)}>{readableEnum(item.schedulingSignal)}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Age {item.ageDays} day(s) | Availability {item.participantAvailabilityCount} | Best date {item.bestAvailabilityDate ?? "-"} | Reschedules {item.rescheduleCount}
                </p>
              </article>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

const CompletionModelView = ({ data }: { data?: CompletionTransactionModel }) => {
  if (!data) return <EmptyState message="Completion transaction data unavailable." />;
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Candidate Records" value={data.summary.candidates} icon={<GraduationCap className="h-5 w-5" />} />
        <KpiCard label="Eligible" value={data.summary.eligible} tone="success" />
        <KpiCard label="Pending Requirements" value={data.summary.pendingRequirements} tone="warning" />
      </section>
      <Card>
        <CardBody className="p-4 md:p-5">
          <SectionTitle title="Graduation Endorsement Readiness" subtitle="Coursework, research, practicum, clearance, alerts, and missing requirements" />
          <ListPanel
            title="Candidate Endorsement List"
            rows={data.graduationCandidates.slice(0, 18).map((item) => ({
              key: item.student.id,
              title: `${item.student.studentNumber} - ${item.student.firstName} ${item.student.lastName}`,
              meta: item.missingRequirements.length ? item.missingRequirements.join(", ") : "No blocking requirement in current rules",
              badge: item.eligibilityResult,
            }))}
          />
        </CardBody>
      </Card>
    </div>
  );
};

const FollowUpModelView = ({ data }: { data?: FollowUpTransactionModel }) => {
  if (!data) return <EmptyState message="Follow-up transaction data unavailable." />;
  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Open Alerts" value={data.summary.openAlerts} icon={<AlertTriangle className="h-5 w-5" />} tone="warning" />
        <KpiCard label="Overdue Tasks" value={data.summary.overdueTasks} tone={data.summary.overdueTasks > 0 ? "danger" : "success"} />
        <KpiCard label="No Intervention" value={data.summary.alertsWithoutIntervention} tone="primary" />
      </section>
      <Card>
        <CardBody className="p-4 md:p-5">
          <SectionTitle title="Intervention Queue" subtitle="Overdue, missing evidence, delayed scheduling, LOA/residency, and stalled-stage alerts" />
          <div className="space-y-2">
            {data.interventionQueue.slice(0, 16).map((alert) => (
              <article key={alert.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {alert.student ? `${alert.student.firstName} ${alert.student.lastName}` : `Student #${alert.studentId}`} | {readableEnum(alert.alertType)}
                  </p>
                  <div className="flex gap-1.5">
                    <Badge tone={alertStatusTone(alert.status)}>{readableEnum(alert.status)}</Badge>
                    <Badge tone={alert.severity === "HIGH" || alert.severity === "CRITICAL" ? "danger" : "warning"}>
                      {alert.severity}
                    </Badge>
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Age {alert.ageDays} day(s) | Latest: {alert.latestIntervention?.actionTaken ?? "No intervention recorded"} | Triggered {formatDateTime(alert.triggeredAt)}
                </p>
              </article>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

const ListPanel = ({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ key: string | number; title: string; meta: string; badge: string }>;
}) => (
  <div className="rounded-lg border border-slate-200 bg-white p-3">
    <p className="text-sm font-semibold text-slate-900">{title}</p>
    {rows.length === 0 ? (
      <EmptyState message="No records in this view." />
    ) : (
      <div className="mt-2 space-y-2">
        {rows.map((row) => (
          <article key={row.key} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">{row.title}</p>
              <Badge tone={row.badge.includes("ELIGIBLE") || row.badge.includes("READY") || row.badge === "COURSEWORK_COMPLETE" ? "success" : "neutral"}>
                {readableEnum(row.badge)}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-slate-600">{row.meta}</p>
          </article>
        ))}
      </div>
    )}
  </div>
);

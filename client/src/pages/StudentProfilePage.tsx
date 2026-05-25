import { AlertTriangle, CalendarClock, ChevronLeft, FileText, Milestone, UserCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { milestonesApi, studentsApi } from "../api/endpoints";
import { handleApiError } from "../api/client";
import { useAuth } from "../app/AuthContext";
import { EmptyState } from "../components/EmptyState";
import { LoadingBlock } from "../components/LoadingBlock";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { QuickInsights } from "../components/ui/QuickInsights";
import { RecommendedActions, type RecommendedActionItem } from "../components/ui/RecommendedActions";
import { SectionTitle } from "../components/ui/SectionTitle";
import type { LifecycleStage, MilestoneDefinition, StudentDetail } from "../types/domain";
import { diffDaysFromNow, formatDate, formatDateTime, readableEnum } from "../utils/format";
import { alertStatusTone, stageTone, taskStatusTone } from "../utils/presentation";

const STAGES: LifecycleStage[] = [
  "ADMISSION",
  "COURSEWORK",
  "PROPOSAL_DEVELOPMENT",
  "PROPOSAL_DEFENSE",
  "DATA_COLLECTION",
  "DISSERTATION_WRITING",
  "ORAL_DEFENSE",
  "LOA",
  "COMPLETED",
];

const MILESTONE_STATUS_OPTIONS = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "BLOCKED"] as const;

export const StudentProfilePage = () => {
  const { user } = useAuth();
  const { id } = useParams();
  const studentId = Number(id);
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [milestones, setMilestones] = useState<MilestoneDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [stage, setStage] = useState<LifecycleStage>("COURSEWORK");
  const [stageNotes, setStageNotes] = useState("");
  const [riskFlag, setRiskFlag] = useState(false);

  const roles = user?.roles ?? [];
  const canUpdateStage = roles.some((role) =>
    ["ADMIN", "GRADUATE_SCHOOL_STAFF", "ACADEMIC_COORDINATOR", "RESEARCH_COORDINATOR", "ADVISER"].includes(role)
  );
  const canUpdateMilestones = canUpdateStage;

  const load = async () => {
    if (!Number.isFinite(studentId)) return;
    try {
      setLoading(true);
      const [studentRes, milestoneRes] = await Promise.all([studentsApi.detail(studentId), milestonesApi.list({ active: true })]);
      setStudent(studentRes);
      setMilestones(milestoneRes);
      setStage(studentRes.currentStage);
      setRiskFlag(studentRes.riskFlag);
      setError(null);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [studentId]);

  const milestoneLookup = useMemo(() => {
    const map = new Map<number, string>();
    student?.milestoneStatuses.forEach((item) => map.set(item.milestoneDefinition.id, item.status));
    return map;
  }, [student]);

  const lifecycleStageIndex = student ? STAGES.indexOf(student.currentStage) : -1;

  const recommendedActions = useMemo<RecommendedActionItem[]>(() => {
    if (!student) return [];
    const actions: RecommendedActionItem[] = [];
    const overdueTasks = student.tasks.filter((task) => task.status === "OVERDUE");
    if (overdueTasks.length > 0) {
      actions.push({
        id: "overdue-tasks",
        title: "Resolve overdue student tasks",
        description: `${overdueTasks.length} task(s) are overdue for this student case. Confirm responsible owners and document follow-up actions.`,
        priority: "high",
        owner: "Assigned task owners",
      });
    }
    const openAlerts = student.alerts.filter((alert) => alert.status !== "CLOSED");
    if (openAlerts.length > 0) {
      actions.push({
        id: "open-alerts",
        title: "Close open monitoring alerts",
        description: `${openAlerts.length} alert(s) remain open for this student. Record interventions and closure evidence in sequence.`,
        priority: "high",
        owner: "Monitoring handler",
      });
    }
    const pendingMilestones = student.milestoneStatuses.filter((item) => item.status !== "COMPLETED");
    if (pendingMilestones.length > 0) {
      actions.push({
        id: "pending-milestones",
        title: "Advance pending milestones",
        description: `${pendingMilestones.length} milestone(s) are not yet completed. Align next actions with current stage requirements.`,
        priority: "medium",
        owner: "Adviser / Student",
      });
    }
    return actions;
  }, [student]);

  const onUpdateStage = async () => {
    if (!student) return;
    try {
      setSaving(true);
      await studentsApi.updateStage(student.id, { stage, notes: stageNotes || undefined, riskFlag });
      await load();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const onUpdateMilestone = async (milestoneId: number, nextStatus: string) => {
    if (!student) return;
    try {
      await studentsApi.updateMilestone(student.id, milestoneId, {
        status: nextStatus,
        notes: `Updated to ${nextStatus} via profile.`,
      });
      await load();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  if (!Number.isFinite(studentId)) {
    return <EmptyState message="Invalid student profile route." />;
  }

  if (loading) {
    return <LoadingBlock text="Loading student profile..." />;
  }

  if (error) {
    return <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>;
  }

  if (!student) {
    return <EmptyState message="Student profile not found." />;
  }

  return (
    <div className="space-y-5">
      <div>
        <Link to="/students" className="inline-flex items-center gap-1 text-sm text-[var(--gs-primary)] hover:underline">
          <ChevronLeft className="h-4 w-4" />
          Back to Students
        </Link>
      </div>

      <PageHeader
        title={`${student.firstName} ${student.lastName}`}
        subtitle={`${student.studentNumber} | ${student.program.name}`}
        help={{
          title: "Student Case Record",
          summary: "This page consolidates the student's lifecycle stage, milestones, task ownership, documents, schedules, alerts, and event history.",
          recommendation: "Use the profile to verify current status before changing stages, closing tasks, or recording intervention evidence.",
        }}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={stageTone(student.currentStage)}>{readableEnum(student.currentStage)}</Badge>
            <Badge tone={student.riskFlag ? "danger" : "success"}>{student.riskFlag ? "At Risk" : "On Track"}</Badge>
          </div>
        }
      />

      <Card>
        <CardBody className="p-4 md:p-5">
          <SectionTitle
            title="Lifecycle Progress"
            subtitle="Current stage and progression checkpoints"
            insight={
              <QuickInsights
                title="Lifecycle Tracker"
                summary="Shows student progression across the defined graduate lifecycle stages."
                recommendation="Use this with milestone statuses to evaluate readiness for stage transitions."
              />
            }
          />
          <div className="overflow-x-auto">
            <div className="flex min-w-[880px] items-center gap-1 pb-2">
              {STAGES.map((stageName, index) => {
                const done = lifecycleStageIndex > index;
                const current = lifecycleStageIndex === index;
                return (
                  <div key={stageName} className="flex items-center">
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className={`h-8 w-8 rounded-full border text-center text-xs font-semibold leading-8 ${
                          current
                            ? "border-[var(--gs-primary)] bg-[var(--gs-primary)] text-white"
                            : done
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-300 bg-white text-slate-500"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <p className={`max-w-[110px] text-center text-xs ${current ? "font-semibold text-slate-800" : "text-slate-500"}`}>
                        {readableEnum(stageName)}
                      </p>
                    </div>
                    {index < STAGES.length - 1 ? (
                      <div className={`mx-1 h-[2px] w-10 ${done ? "bg-emerald-300" : "bg-slate-200"}`} />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {canUpdateStage ? (
            <div className="mt-4 grid gap-2 md:grid-cols-4">
              <select
                value={stage}
                onChange={(event) => setStage(event.target.value as LifecycleStage)}
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
              >
                {STAGES.map((stageName) => (
                  <option key={stageName} value={stageName}>
                    {readableEnum(stageName)}
                  </option>
                ))}
              </select>
              <input
                value={stageNotes}
                onChange={(event) => setStageNotes(event.target.value)}
                placeholder="Transition notes"
                className="h-10 rounded-md border border-slate-300 px-3 text-sm md:col-span-2"
              />
              <label className="flex h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm text-slate-700">
                <input type="checkbox" checked={riskFlag} onChange={(event) => setRiskFlag(event.target.checked)} />
                Risk Flag
              </label>
              <Button className="md:col-span-4 md:w-fit" onClick={() => void onUpdateStage()} disabled={saving}>
                {saving ? "Updating..." : "Update Stage"}
              </Button>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title="Milestone Checklist"
              subtitle="Status tracking per milestone definition"
              insight={
                <QuickInsights
                  title="Milestone Checklist"
                  summary="Milestones align stage-specific requirements with completion and blockers."
                  recommendation="Prioritize blocked or aging milestone entries in the current stage."
                />
              }
            />
            <div className="space-y-2">
              {milestones.length === 0 ? (
                <EmptyState message="No milestone definitions available." />
              ) : (
                milestones.map((milestone) => (
                  <article key={milestone.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{milestone.name}</p>
                        <p className="text-xs text-slate-500">
                          {readableEnum(milestone.stage)} | Criticality {milestone.criticality}
                        </p>
                      </div>
                      {canUpdateMilestones ? (
                        <select
                          value={milestoneLookup.get(milestone.id) ?? "NOT_STARTED"}
                          onChange={(event) => void onUpdateMilestone(milestone.id, event.target.value)}
                          className="h-8 rounded-md border border-slate-300 px-2 text-xs"
                        >
                          {MILESTONE_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {readableEnum(status)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Badge tone="neutral">{readableEnum(milestoneLookup.get(milestone.id) ?? "NOT_STARTED")}</Badge>
                      )}
                    </div>
                  </article>
                ))
              )}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title="Tasks and Ownership"
              subtitle="Open tasks, due status, and next owner"
              insight={
                <QuickInsights
                  title="Task Ownership"
                  summary="Open tasks represent active work items routed by decision and role ownership."
                  recommendation="Use next owner + due state to enforce timely workflow handoffs."
                />
              }
            />
            {student.tasks.length === 0 ? (
              <EmptyState message="No active tasks for this student." />
            ) : (
              <div className="space-y-2">
                {student.tasks.map((task) => (
                  <article key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                      <Badge tone={taskStatusTone(task.status)}>{readableEnum(task.status)}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      Due: {formatDate(task.dueAt)} | Next owner: {task.nextActionOwnerRole ? readableEnum(task.nextActionOwnerRole) : "-"} | Priority {task.priorityScore}
                    </p>
                    {task.recommendedAction ? <p className="mt-1 text-xs text-[var(--gs-primary)]">{task.recommendedAction}</p> : null}
                  </article>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title="Student Timeline"
              subtitle="Latest lifecycle and workflow events"
              insight={
                <QuickInsights
                  title="Timeline Events"
                  summary="Append-only timeline of lifecycle transitions, milestone updates, tasks, and interventions."
                  recommendation="Review recent events before recording new stage or decision actions."
                />
              }
            />
            {student.timelineEvents.length === 0 ? (
              <EmptyState message="No timeline history available." />
            ) : (
              <div className="space-y-2">
                {student.timelineEvents.slice(0, 12).map((event) => (
                  <article key={event.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(event.occurredAt)}</p>
                    {event.details ? <p className="mt-1 text-xs text-slate-700">{event.details}</p> : null}
                  </article>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title="Alerts and Interventions"
              subtitle="Monitoring status for this student"
              insight={
                <QuickInsights
                  title="Alerts and Interventions"
                  summary="Lists monitoring alerts with latest intervention progress and closure status."
                  recommendation="Ensure each open alert has intervention evidence and closure tracking."
                />
              }
            />
            {student.alerts.length === 0 ? (
              <EmptyState message="No active alerts for this student." />
            ) : (
              <div className="space-y-2">
                {student.alerts.map((alert) => (
                  <article key={alert.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{readableEnum(alert.alertType)}</p>
                      <Badge tone={alertStatusTone(alert.status)}>{readableEnum(alert.status)}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-700">{alert.message}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Triggered {formatDate(alert.triggeredAt)} | Interventions {alert.interventions.length}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title="Document Records"
              subtitle="Checklist, versions, and revision state"
              insight={
                <QuickInsights
                  title="Document Record Summary"
                  summary="Shows checklist-linked documents and unresolved revision counts."
                  recommendation="Resolve open revision notes before scheduling defense milestones."
                />
              }
            />
            {student.documents.length === 0 ? (
              <EmptyState message="No document records yet." />
            ) : (
              <div className="space-y-2">
                {student.documents.slice(0, 8).map((record) => (
                  <article key={record.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{record.checklistItem}</p>
                      <Badge tone={record.outstandingRevisionCount > 0 ? "warning" : "success"}>
                        {record.outstandingRevisionCount > 0 ? "Needs Revision" : "Current"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Status: {readableEnum(record.status)} | Versions: {record.versions.length} | Outstanding revisions: {record.outstandingRevisionCount}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title="Scheduling History"
              subtitle="Defense requests, availability, and outcomes"
              insight={
                <QuickInsights
                  title="Scheduling History"
                  summary="Displays schedule requests and latest event outcomes for defense coordination."
                  recommendation="Watch long-open scheduling requests for delayed scheduling risk."
                />
              }
            />
            {student.scheduleRequests.length === 0 ? (
              <EmptyState message="No scheduling requests for this student." />
            ) : (
              <div className="space-y-2">
                {student.scheduleRequests.slice(0, 8).map((request) => {
                  const latestEvent = request.scheduleEvents[0];
                  const ageDays = diffDaysFromNow(request.createdAt);
                  return (
                    <article key={request.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">Request #{request.id}</p>
                        <Badge tone={request.status === "CONFIRMED" ? "success" : request.status === "CANCELLED" ? "danger" : "warning"}>
                          {readableEnum(request.status)}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        Preferred: {formatDateTime(request.preferredDate)} | Created: {formatDate(request.createdAt)} ({ageDays} day(s) ago)
                      </p>
                      {latestEvent ? (
                        <p className="mt-1 text-xs text-slate-600">
                          Latest event: {readableEnum(latestEvent.eventStatus)} | {formatDateTime(latestEvent.scheduledAt)}
                        </p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </section>

      <RecommendedActions
        actions={recommendedActions}
        context="Page-level recommendations synthesized from this student's tasks, milestones, alerts, and scheduling records."
      />

      <Card className="border-[var(--gs-primary)]/20 bg-[var(--gs-primary-soft)]/30">
        <CardBody className="flex flex-wrap gap-4 text-xs text-slate-700">
          <p className="inline-flex items-center gap-1.5">
            <Milestone className="h-3.5 w-3.5 text-[var(--gs-primary)]" />
            Milestones guide stage completion checks.
          </p>
          <p className="inline-flex items-center gap-1.5">
            <UserCheck className="h-3.5 w-3.5 text-[var(--gs-primary)]" />
            Role restrictions are enforced by backend policy.
          </p>
          <p className="inline-flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 text-[var(--gs-primary)]" />
            Alerts and interventions remain append-audit tracked.
          </p>
          <p className="inline-flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-[var(--gs-primary)]" />
            Document versions and revisions retain historical traceability.
          </p>
          <p className="inline-flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5 text-[var(--gs-primary)]" />
            Scheduling outcomes drive next operational actions.
          </p>
        </CardBody>
      </Card>
    </div>
  );
};

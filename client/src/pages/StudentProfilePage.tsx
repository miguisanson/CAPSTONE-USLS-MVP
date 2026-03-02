import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { milestonesApi, studentsApi } from "../api/endpoints";
import { handleApiError } from "../api/client";
import type { LifecycleStage, MilestoneDefinition, StudentDetail } from "../types/domain";
import { EmptyState } from "../components/EmptyState";
import { LoadingBlock } from "../components/LoadingBlock";
import { formatDateTime, readableEnum } from "../utils/format";

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

const MILESTONE_STATUS_OPTIONS = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "BLOCKED"];

export const StudentProfilePage = () => {
  const { id } = useParams();
  const studentId = Number(id);
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [milestones, setMilestones] = useState<MilestoneDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<LifecycleStage>("COURSEWORK");
  const [stageNotes, setStageNotes] = useState("");
  const [riskFlag, setRiskFlag] = useState(false);
  const [busy, setBusy] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [studentRes, milestoneRes] = await Promise.all([
        studentsApi.detail(studentId),
        milestonesApi.list({ active: true }),
      ]);
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
    if (Number.isFinite(studentId)) {
      void fetchData();
    }
  }, [studentId]);

  const milestoneLookup = useMemo(() => {
    const map = new Map<number, string>();
    student?.milestoneStatuses.forEach((item) => map.set(item.milestoneDefinition.id, item.status));
    return map;
  }, [student]);

  if (!Number.isFinite(studentId)) return <EmptyState message="Invalid student profile route." />;
  if (loading) return <LoadingBlock text="Loading student profile..." />;
  if (error) return <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>;
  if (!student) return <EmptyState message="Student profile not found." />;

  const onUpdateStage = async () => {
    try {
      setBusy(true);
      await studentsApi.updateStage(student.id, {
        stage,
        notes: stageNotes || undefined,
        riskFlag,
      });
      await fetchData();
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const onUpdateMilestone = async (milestoneId: number, nextStatus: string) => {
    try {
      await studentsApi.updateMilestone(student.id, milestoneId, {
        status: nextStatus,
        notes: `Updated via profile page to ${nextStatus}.`,
      });
      await fetchData();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              {student.firstName} {student.lastName}
            </h2>
            <p className="text-sm text-slate-500">
              {student.studentNumber} | {student.program.name}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <p>Current stage</p>
            <p className="font-semibold text-slate-800">{readableEnum(student.currentStage)}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <select
            value={stage}
            onChange={(event) => setStage(event.target.value as LifecycleStage)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            {STAGES.map((item) => (
              <option key={item} value={item}>
                {readableEnum(item)}
              </option>
            ))}
          </select>
          <input
            value={stageNotes}
            onChange={(event) => setStageNotes(event.target.value)}
            placeholder="Transition note"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          />
          <label className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            <input type="checkbox" checked={riskFlag} onChange={(event) => setRiskFlag(event.target.checked)} />
            Risk Flag
          </label>
        </div>
        <button
          onClick={() => void onUpdateStage()}
          disabled={busy}
          className="mt-3 rounded-md bg-[var(--gs-primary)] px-3 py-1.5 text-sm text-white hover:bg-[var(--gs-dark)] disabled:opacity-60"
        >
          Update Stage
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Milestone Checklist</h3>
        <div className="grid gap-2">
          {milestones.map((milestone) => (
            <div key={milestone.id} className="grid gap-2 rounded-lg border border-slate-100 px-3 py-2 md:grid-cols-4">
              <div className="md:col-span-2">
                <p className="text-sm font-medium text-slate-800">{milestone.name}</p>
                <p className="text-xs text-slate-500">{readableEnum(milestone.stage)}</p>
              </div>
              <div className="text-xs text-slate-500">Criticality: {milestone.criticality}</div>
              <select
                value={milestoneLookup.get(milestone.id) ?? "NOT_STARTED"}
                onChange={(event) => void onUpdateMilestone(milestone.id, event.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs"
              >
                {MILESTONE_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {readableEnum(status)}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Tasks & Next Action Owner</h3>
          {student.tasks.length === 0 ? (
            <EmptyState message="No active tasks for this student." />
          ) : (
            <div className="space-y-2">
              {student.tasks.map((task) => (
                <div key={task.id} className="rounded-lg border border-slate-100 px-3 py-2">
                  <p className="text-sm font-medium text-slate-800">{task.title}</p>
                  <p className="text-xs text-slate-500">
                    {readableEnum(task.status)} | next owner: {task.nextActionOwnerRole ? readableEnum(task.nextActionOwnerRole) : "-"}
                  </p>
                  {task.recommendedAction ? (
                    <p className="mt-1 text-xs text-[var(--gs-dark)]">{task.recommendedAction}</p>
                  ) : null}
                  {task.escalationPrompt ? <p className="mt-1 text-xs text-rose-700">{task.escalationPrompt}</p> : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Timeline</h3>
          {student.timelineEvents.length === 0 ? (
            <EmptyState message="No timeline events yet." />
          ) : (
            <div className="space-y-2">
              {student.timelineEvents.slice(0, 12).map((event) => (
                <div key={event.id} className="rounded-lg border border-slate-100 px-3 py-2">
                  <p className="text-sm font-medium text-slate-800">{event.title}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(event.occurredAt)}</p>
                  {event.details ? <p className="mt-1 text-xs text-slate-600">{event.details}</p> : null}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};


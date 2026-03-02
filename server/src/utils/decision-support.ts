import { LifecycleStage, TaskStatus } from "@prisma/client";
import dayjs from "dayjs";

const stageCriticality: Record<LifecycleStage, number> = {
  ADMISSION: 1,
  COURSEWORK: 2,
  PROPOSAL_DEVELOPMENT: 3,
  PROPOSAL_DEFENSE: 4,
  DATA_COLLECTION: 3,
  DISSERTATION_WRITING: 4,
  ORAL_DEFENSE: 5,
  LOA: 2,
  COMPLETED: 1,
};

export const computePriorityScore = (params: {
  dueAt?: Date | null;
  stage?: LifecycleStage;
  milestoneCriticality?: number;
  taskStatus?: TaskStatus;
}): number => {
  const overdueDays = params.dueAt ? Math.max(0, dayjs().diff(dayjs(params.dueAt), "day")) : 0;
  const base = params.stage ? stageCriticality[params.stage] * 10 : 10;
  const criticality = (params.milestoneCriticality ?? 1) * 5;
  const overdueWeight = overdueDays * 4;
  const statusBump = params.taskStatus === TaskStatus.OVERDUE ? 15 : 0;
  return base + criticality + overdueWeight + statusBump;
};

export const buildRecommendation = (params: {
  dueAt?: Date | null;
  nextActionOwnerRole?: string | null;
  escalationThresholdDays?: number;
}): { recommendedAction: string; escalationPrompt: string | null } => {
  const overdueDays = params.dueAt ? Math.max(0, dayjs().diff(dayjs(params.dueAt), "day")) : 0;
  const escalationThreshold = params.escalationThresholdDays ?? 7;
  const owner = params.nextActionOwnerRole ?? "Assigned owner";

  if (overdueDays <= 0) {
    return {
      recommendedAction: `Monitor and keep ${owner} on schedule.`,
      escalationPrompt: null,
    };
  }

  if (overdueDays >= escalationThreshold) {
    return {
      recommendedAction: `Prioritize immediate follow-up with ${owner}.`,
      escalationPrompt: `Escalate: task is overdue by ${overdueDays} day(s), above threshold ${escalationThreshold}.`,
    };
  }

  return {
    recommendedAction: `Send reminder to ${owner} and request updated ETA.`,
    escalationPrompt: null,
  };
};


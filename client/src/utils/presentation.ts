import type { AlertStatus, LifecycleStage, RoleName, ScheduleStatus, TaskDecision, TaskStatus } from "../types/domain";

export const stageTone = (stage: LifecycleStage): "info" | "warning" | "success" | "danger" | "neutral" => {
  switch (stage) {
    case "ADMISSION":
      return "info";
    case "COURSEWORK":
      return "info";
    case "PROPOSAL_DEVELOPMENT":
      return "warning";
    case "PROPOSAL_DEFENSE":
      return "warning";
    case "DATA_COLLECTION":
      return "warning";
    case "DISSERTATION_WRITING":
      return "danger";
    case "ORAL_DEFENSE":
      return "warning";
    case "LOA":
      return "danger";
    case "COMPLETED":
      return "success";
    default:
      return "neutral";
  }
};

export const taskStatusTone = (status: TaskStatus): "neutral" | "warning" | "success" | "danger" => {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "OVERDUE":
      return "danger";
    case "IN_PROGRESS":
      return "warning";
    default:
      return "neutral";
  }
};

export const scheduleStatusTone = (status: ScheduleStatus): "neutral" | "warning" | "success" | "danger" => {
  switch (status) {
    case "CONFIRMED":
      return "success";
    case "RESCHEDULED":
      return "warning";
    case "CANCELLED":
      return "danger";
    default:
      return "neutral";
  }
};

export const alertStatusTone = (status: AlertStatus): "neutral" | "warning" | "success" | "danger" => {
  switch (status) {
    case "OPEN":
      return "danger";
    case "ACKNOWLEDGED":
      return "warning";
    case "CLOSED":
      return "success";
    default:
      return "neutral";
  }
};

export const roleTone = (role: RoleName): "neutral" | "info" | "success" | "warning" => {
  switch (role) {
    case "ADMIN":
      return "warning";
    case "STUDENT":
      return "neutral";
    case "ADVISER":
      return "info";
    case "PANEL_MEMBER":
      return "info";
    default:
      return "success";
  }
};

export const decisionTone = (decision: TaskDecision): "success" | "warning" | "danger" => {
  switch (decision) {
    case "APPROVE":
      return "success";
    case "REVISE":
      return "warning";
    case "RETURN":
      return "danger";
    default:
      return "warning";
  }
};

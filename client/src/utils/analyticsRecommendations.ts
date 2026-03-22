import type { AnalyticsDashboard, PrescriptiveAnalyticsResponse } from "../types/domain";

export type AnalyticsRecommendedAction = {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  owner?: string;
  eta?: string;
};

export const buildAnalyticsRecommendedActions = (
  data: AnalyticsDashboard | null,
  prescriptive: PrescriptiveAnalyticsResponse | null
): AnalyticsRecommendedAction[] => {
  const actions: AnalyticsRecommendedAction[] = [];

  if (prescriptive) {
    if (prescriptive.priority_actions.length > 0) {
      prescriptive.priority_actions.slice(0, 4).forEach((action, index) => {
        actions.push({
          id: `prescriptive-${index}`,
          title: action.action,
          description: action.why,
          priority: action.confidence === "high" ? "high" : action.confidence === "med" ? "medium" : "low",
          owner: action.who,
          eta: action.timeframe,
        });
      });
    } else if (prescriptive.top_cases.length > 0) {
      prescriptive.top_cases.slice(0, 3).forEach((item, index) => {
        actions.push({
          id: `top-case-${index}`,
          title: `Follow up ${item.student_ref}`,
          description: item.recommended_next_action,
          priority: item.confidence === "high" ? "high" : item.confidence === "med" ? "medium" : "low",
          owner: item.owner_role,
        });
      });
    }

    if (actions.length > 0) return actions;
  }

  if (!data) return actions;

  const slowStages = data.agingByStage.filter((item) => item.averageDays > 60);
  if (slowStages.length > 0) {
    actions.push({
      id: "slow-stages",
      title: "Address prolonged stage aging",
      description: `${slowStages.length} stage(s) exceed 60 average days. Review blockers and intervention patterns.`,
      priority: "high",
      owner: "Coordinators",
    });
  }

  const heavyQueues = data.pendingQueues.filter((item) => item.count > 5);
  if (heavyQueues.length > 0) {
    actions.push({
      id: "heavy-queues",
      title: "Rebalance heavy queues",
      description: `${heavyQueues.length} queue role(s) have high pending load. Reassign or escalate to avoid handoff delays.`,
      priority: "medium",
    });
  }

  if (data.schedulingCycleTimeDays > 10) {
    actions.push({
      id: "cycle-time",
      title: "Improve scheduling cycle time",
      description: `Average scheduling cycle time is ${data.schedulingCycleTimeDays} days. Review confirmation and availability bottlenecks.`,
      priority: "medium",
    });
  }

  return actions;
};


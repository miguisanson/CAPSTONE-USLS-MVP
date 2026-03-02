import { AuditActionType, LifecycleStage, RoleName, TaskStatus } from "@prisma/client";
import OpenAI from "openai";
import crypto from "node:crypto";
import { z } from "zod";
import { env } from "../../config/env";
import { logAudit } from "../../lib/audit";
import { prisma } from "../../lib/prisma";
import type { AuthUser } from "../../types/auth";

const HOUR_MS = 60 * 60 * 1000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_REQUESTS_PER_HOUR = 10;

const rateLimitByUser = new Map<number, { count: number; resetAt: number }>();
const cacheByKey = new Map<string, { expiresAt: number; value: PrescriptiveResponse }>();

const stageThresholdDefaults: Record<LifecycleStage, number> = {
  ADMISSION: 14,
  COURSEWORK: 45,
  PROPOSAL_DEVELOPMENT: 50,
  PROPOSAL_DEFENSE: 20,
  DATA_COLLECTION: 75,
  DISSERTATION_WRITING: 45,
  ORAL_DEFENSE: 20,
  LOA: 30,
  COMPLETED: 999,
};

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

export const prescriptiveFilterSchema = z.object({
  program: z.string().trim().min(1).optional(),
  stage: z.nativeEnum(LifecycleStage).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type PrescriptiveFilters = z.infer<typeof prescriptiveFilterSchema>;

export type PrescriptivePriorityAction = {
  action: string;
  why: string;
  who: string;
  timeframe: string;
  confidence: "low" | "med" | "high";
};

export type PrescriptiveTopCase = {
  student_ref: string;
  reason: string;
  recommended_next_action: string;
  owner_role: string;
  confidence: "low" | "med" | "high";
  data_needed: string[];
  priority_score: number;
};

export type PrescriptiveResponse = {
  generated_at: string;
  summary: string;
  priority_actions: PrescriptivePriorityAction[];
  top_cases: PrescriptiveTopCase[];
  disclaimer: string;
  ai: {
    enabled: boolean;
    status: "disabled" | "success" | "error";
    message: string;
    cached: boolean;
    prompt_hash?: string;
  };
};

const aiResponseSchema = z.object({
  generated_at: z.string(),
  summary: z.string(),
  priority_actions: z.array(
    z.object({
      action: z.string(),
      why: z.string(),
      who: z.string(),
      timeframe: z.string(),
      confidence: z.enum(["low", "med", "high"]),
    })
  ),
  top_cases: z.array(
    z.object({
      student_ref: z.string(),
      reason: z.string(),
      recommended_next_action: z.string(),
      owner_role: z.string(),
      confidence: z.enum(["low", "med", "high"]),
      data_needed: z.array(z.string()),
    })
  ),
});

type CaseSignal = {
  studentId: number;
  stage: LifecycleStage;
  timeInStageDays: number;
  overdueTaskCount: number;
  pendingMilestones: number;
  lastActivityAgeDays: number;
  schedulingAgeDays: number;
  riskFlags: string[];
  ownerRole: string;
  priorityScore: number;
};

const normalizeRole = (role: RoleName | null | undefined): string => role ?? "GRADUATE_SCHOOL_STAFF";

const daysBetween = (date: Date | null | undefined): number => {
  if (!date) return 0;
  const ms = Date.now() - date.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
};

const recommendedActionForCase = (signal: CaseSignal): string => {
  if (signal.overdueTaskCount > 0) {
    return `Prioritize overdue workflow tasks and secure owner commitment within 48 hours.`;
  }
  if (signal.schedulingAgeDays >= 10) {
    return `Escalate defense scheduling coordination and lock panel availability this week.`;
  }
  if (signal.lastActivityAgeDays >= 14) {
    return `Trigger inactivity intervention and require updated progress evidence.`;
  }
  if (signal.pendingMilestones > 0) {
    return `Advance pending milestones with a dated action plan and assigned accountability.`;
  }
  return `Maintain active monitoring and confirm next owner handoff completion.`;
};

const reasonForCase = (signal: CaseSignal): string => {
  const reasons: string[] = [];
  if (signal.overdueTaskCount > 0) reasons.push(`${signal.overdueTaskCount} overdue task(s)`);
  if (signal.pendingMilestones > 0) reasons.push(`${signal.pendingMilestones} pending milestone(s)`);
  if (signal.schedulingAgeDays >= 10) reasons.push(`scheduling age ${signal.schedulingAgeDays} days`);
  if (signal.lastActivityAgeDays >= 14) reasons.push(`last activity ${signal.lastActivityAgeDays} days ago`);
  if (signal.riskFlags.length > 0) reasons.push(`risk flags: ${signal.riskFlags.join(", ")}`);
  return reasons.join("; ");
};

const checkRateLimit = (userId: number): void => {
  const now = Date.now();
  const existing = rateLimitByUser.get(userId);

  if (!existing || now >= existing.resetAt) {
    rateLimitByUser.set(userId, { count: 1, resetAt: now + HOUR_MS });
    return;
  }

  if (existing.count >= MAX_REQUESTS_PER_HOUR) {
    throw new Error("RATE_LIMITED");
  }

  existing.count += 1;
  rateLimitByUser.set(userId, existing);
};

const getStageThresholdMap = async (): Promise<Record<LifecycleStage, number>> => {
  const thresholds = await prisma.alertThreshold.findMany({
    where: {
      enabled: true,
      stage: { not: null },
    },
    select: {
      stage: true,
      thresholdDays: true,
    },
  });

  const merged = { ...stageThresholdDefaults };
  thresholds.forEach((item) => {
    if (item.stage) {
      merged[item.stage] = item.thresholdDays;
    }
  });
  return merged;
};

const buildCaseSignals = async (filters: PrescriptiveFilters): Promise<CaseSignal[]> => {
  const stageThresholds = await getStageThresholdMap();

  const students = await prisma.student.findMany({
    where: {
      currentStage: filters.stage ?? undefined,
      program: filters.program
        ? {
            OR: [
              { code: { contains: filters.program } },
              { name: { contains: filters.program } },
            ],
          }
        : undefined,
      updatedAt:
        filters.from || filters.to
          ? {
              gte: filters.from,
              lte: filters.to,
            }
          : undefined,
    },
    include: {
      lifecycleHistory: {
        where: { exitedAt: null },
        take: 1,
        orderBy: { enteredAt: "desc" },
      },
      tasks: {
        where: { status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.OVERDUE] } },
        select: {
          id: true,
          dueAt: true,
          status: true,
          nextActionOwnerRole: true,
        },
      },
      milestoneStatuses: {
        where: { status: { in: ["NOT_STARTED", "IN_PROGRESS", "BLOCKED"] } },
        select: { id: true },
      },
      scheduleRequests: {
        take: 1,
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          status: true,
        },
      },
      timelineEvents: {
        take: 1,
        orderBy: { occurredAt: "desc" },
        select: { occurredAt: true },
      },
    },
  });

  const now = new Date();

  return students.map((student) => {
    const stageEnteredAt = student.lifecycleHistory[0]?.enteredAt ?? student.updatedAt;
    const timeInStageDays = daysBetween(stageEnteredAt);
    const overdueTaskCount = student.tasks.filter((task) => {
      if (task.status === TaskStatus.OVERDUE) return true;
      if (!task.dueAt) return false;
      return task.dueAt < now && task.status !== TaskStatus.COMPLETED;
    }).length;
    const pendingMilestones = student.milestoneStatuses.length;
    const lastActivityAgeDays = daysBetween(student.timelineEvents[0]?.occurredAt ?? student.updatedAt);

    const latestSchedule = student.scheduleRequests[0];
    const schedulingAgeDays =
      latestSchedule && latestSchedule.status !== "CONFIRMED" && latestSchedule.status !== "CANCELLED"
        ? daysBetween(latestSchedule.createdAt)
        : 0;

    const stageOverrun = Math.max(0, timeInStageDays - stageThresholds[student.currentStage]);
    const basePriority =
      overdueTaskCount * 20 +
      pendingMilestones * 8 +
      stageOverrun * 2 +
      (lastActivityAgeDays >= 14 ? 10 : 0) +
      (schedulingAgeDays >= 10 ? 12 : 0) +
      (student.riskFlag ? 15 : 0) +
      stageCriticality[student.currentStage] * 5;

    const dominantOwner = normalizeRole(student.tasks[0]?.nextActionOwnerRole);
    const riskFlags = [
      ...(student.riskFlag ? ["risk_flagged"] : []),
      ...(stageOverrun > 0 ? ["stage_over_threshold"] : []),
      ...(overdueTaskCount > 0 ? ["overdue_tasks"] : []),
      ...(schedulingAgeDays >= 10 ? ["delayed_scheduling"] : []),
      ...(lastActivityAgeDays >= 14 ? ["inactivity"] : []),
    ];

    return {
      studentId: student.id,
      stage: student.currentStage,
      timeInStageDays,
      overdueTaskCount,
      pendingMilestones,
      lastActivityAgeDays,
      schedulingAgeDays,
      riskFlags,
      ownerRole: dominantOwner,
      priorityScore: basePriority,
    };
  });
};

const buildRuleBasedPayload = (signals: CaseSignal[]): PrescriptiveResponse => {
  const sorted = [...signals].sort((a, b) => b.priorityScore - a.priorityScore);
  const indexedCases = sorted.map((signal, index) => ({
    signal,
    studentRef: `S-${String(index + 1).padStart(3, "0")}`,
  }));

  const highPriority = indexedCases.filter(({ signal }) => signal.priorityScore >= 40).length;
  const overdueCases = indexedCases.filter(({ signal }) => signal.overdueTaskCount > 0).length;
  const delayedSchedulingCases = indexedCases.filter(({ signal }) => signal.schedulingAgeDays >= 10).length;
  const inactiveCases = indexedCases.filter(({ signal }) => signal.lastActivityAgeDays >= 14).length;

  const priorityActions: PrescriptivePriorityAction[] = [];

  if (overdueCases > 0) {
    priorityActions.push({
      action: "Prioritize overdue workflow cases",
      why: `${overdueCases} case(s) have overdue tasks and elevated escalation risk.`,
      who: "Graduate School Staff + Academic/Research Coordinators",
      timeframe: "Within 48 hours",
      confidence: "high",
    });
  }

  if (delayedSchedulingCases > 0) {
    priorityActions.push({
      action: "Resolve delayed defense scheduling cases",
      why: `${delayedSchedulingCases} case(s) exceed scheduling age threshold.`,
      who: "Graduate School Staff",
      timeframe: "Within 3 business days",
      confidence: "med",
    });
  }

  if (inactiveCases > 0) {
    priorityActions.push({
      action: "Trigger inactivity interventions",
      why: `${inactiveCases} case(s) show inactivity beyond configured window.`,
      who: "Adviser + Research Coordinator",
      timeframe: "Within 5 business days",
      confidence: "med",
    });
  }

  if (priorityActions.length === 0) {
    priorityActions.push({
      action: "Maintain queue monitoring cadence",
      why: "No immediate high-risk signals exceeded thresholds in filtered scope.",
      who: "Graduate School Staff",
      timeframe: "Weekly",
      confidence: "high",
    });
  }

  const topCases: PrescriptiveTopCase[] = indexedCases.slice(0, 10).map(({ signal, studentRef }) => ({
    student_ref: studentRef,
    reason: reasonForCase(signal),
    recommended_next_action: recommendedActionForCase(signal),
    owner_role: signal.ownerRole,
    confidence: signal.priorityScore >= 60 ? "high" : signal.priorityScore >= 40 ? "med" : "low",
    data_needed: [
      "latest milestone evidence",
      "confirmed owner ETA",
      "most recent intervention status",
    ],
    priority_score: signal.priorityScore,
  }));

  return {
    generated_at: new Date().toISOString(),
    summary: `${highPriority} high-priority case(s) detected out of ${signals.length} case(s) in current filter scope.`,
    priority_actions: priorityActions,
    top_cases: topCases,
    disclaimer:
      "Advisory only. Validate recommendations against institutional policy, complete records, and authorized reviewers.",
    ai: {
      enabled: false,
      status: "disabled",
      message: "AI narrative assistance is disabled by feature flag.",
      cached: false,
    },
  };
};

const buildAiPayload = (signals: CaseSignal[]) => {
  const aggregated = {
    total_cases: signals.length,
    overdue_case_count: signals.filter((item) => item.overdueTaskCount > 0).length,
    delayed_scheduling_count: signals.filter((item) => item.schedulingAgeDays >= 10).length,
    inactivity_count: signals.filter((item) => item.lastActivityAgeDays >= 14).length,
    avg_time_in_stage_days:
      signals.length === 0
        ? 0
        : Number(
            (signals.reduce((acc, item) => acc + item.timeInStageDays, 0) / signals.length).toFixed(2)
          ),
  };

  const cases = [...signals]
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 20)
    .map((signal, idx) => ({
      student_ref: `S-${String(idx + 1).padStart(3, "0")}`,
      stage: signal.stage,
      time_in_stage_days: signal.timeInStageDays,
      overdue_count: signal.overdueTaskCount,
      pending_milestones: signal.pendingMilestones,
      last_activity_age_days: signal.lastActivityAgeDays,
      scheduling_age_days: signal.schedulingAgeDays,
      risk_flags: signal.riskFlags,
      owner_role: signal.ownerRole,
      priority_score: signal.priorityScore,
    }));

  return { aggregated, cases };
};

const parseAiJson = (text: string): z.infer<typeof aiResponseSchema> => {
  const parsed = JSON.parse(text);
  return aiResponseSchema.parse(parsed);
};

const extractOutputText = (response: unknown): string => {
  const payload = response as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
  if (payload.output_text && payload.output_text.trim().length > 0) {
    return payload.output_text;
  }

  const text = payload.output
    ?.flatMap((item) => item.content ?? [])
    .map((item) => item.text ?? "")
    .join("")
    .trim();
  return text ?? "";
};

const runOpenAiAssist = async (
  user: AuthUser,
  filters: PrescriptiveFilters,
  ruleBased: PrescriptiveResponse,
  signals: CaseSignal[]
): Promise<PrescriptiveResponse> => {
  const cacheKey = JSON.stringify({
    userId: user.id,
    filters,
    signalCount: signals.length,
  });

  const cached = cacheByKey.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      ...cached.value,
      ai: {
        ...cached.value.ai,
        cached: true,
      },
    };
  }

  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_KEY_MISSING");
  }

  checkRateLimit(user.id);

  const minimizedPayload = buildAiPayload(signals);

  const systemPrompt =
    "You are an analytics copilot for graduate lifecycle monitoring. Return strict JSON only. " +
    "Do not include direct identifiers, policy changes, or deterministic decisions. Advisory-only language.";
  const userPrompt = JSON.stringify(
    {
      instruction:
        "Produce prescriptive recommendations using only provided de-identified metrics and case summaries.",
      data: minimizedPayload,
    },
    null,
    2
  );
  const promptHash = crypto.createHash("sha256").update(userPrompt).digest("hex");

  await logAudit({
    actorUserId: user.id,
    actionType: AuditActionType.CREATE,
    entityType: "AnalyticsPrescriptiveAI",
    entityId: null,
    description: "AI prescriptive analytics request initiated.",
    metadata: {
      filters,
      caseCount: minimizedPayload.cases.length,
      promptHash,
    },
  });

  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: env.OPENAI_MODEL,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: systemPrompt }],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              `${userPrompt}\n\n` +
              "Return JSON with shape: " +
              '{"generated_at":"ISO8601","summary":"string","priority_actions":[{"action":"...","why":"...","who":"...","timeframe":"...","confidence":"low|med|high"}],"top_cases":[{"student_ref":"S-001","reason":"...","recommended_next_action":"...","owner_role":"...","confidence":"low|med|high","data_needed":["..."]}]}.',
          },
        ],
      },
    ],
  });

  const outputText = extractOutputText(response);
  if (!outputText) {
    throw new Error("OPENAI_EMPTY_RESPONSE");
  }

  const aiJson = parseAiJson(outputText);

  const merged: PrescriptiveResponse = {
    ...ruleBased,
    generated_at: aiJson.generated_at,
    summary: aiJson.summary,
    priority_actions: aiJson.priority_actions,
    top_cases: aiJson.top_cases.map((item) => ({
      ...item,
      priority_score:
        ruleBased.top_cases.find((ruleCase) => ruleCase.student_ref === item.student_ref)?.priority_score ??
        0,
    })),
    ai: {
      enabled: true,
      status: "success",
      message: "AI advisory narrative generated from de-identified analytics signals.",
      cached: false,
      prompt_hash: promptHash,
    },
  };

  cacheByKey.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    value: merged,
  });

  await logAudit({
    actorUserId: user.id,
    actionType: AuditActionType.UPDATE,
    entityType: "AnalyticsPrescriptiveAI",
    entityId: null,
    description: "AI prescriptive analytics response generated.",
    metadata: {
      filters,
      caseCount: minimizedPayload.cases.length,
      promptHash,
      outputPriorityActions: merged.priority_actions.length,
      outputTopCases: merged.top_cases.length,
    },
  });

  return merged;
};

export const generatePrescriptiveAnalytics = async (
  user: AuthUser,
  filters: PrescriptiveFilters
): Promise<PrescriptiveResponse> => {
  const signals = await buildCaseSignals(filters);
  const ruleBased = buildRuleBasedPayload(signals);

  if (!env.ENABLE_OPENAI_ASSIST) {
    return ruleBased;
  }

  try {
    return await runOpenAiAssist(user, filters, ruleBased, signals);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";

    if (message === "OPENAI_KEY_MISSING") {
      throw error;
    }
    if (message === "RATE_LIMITED") {
      throw error;
    }

    await logAudit({
      actorUserId: user.id,
      actionType: AuditActionType.UPDATE,
      entityType: "AnalyticsPrescriptiveAI",
      entityId: null,
      description: "AI prescriptive analytics generation failed; rule-based fallback returned.",
      metadata: {
        filters,
        error: message,
      },
    });

    return {
      ...ruleBased,
      ai: {
        enabled: true,
        status: "error",
        message: "AI advisory generation failed. Returned rule-based recommendations only.",
        cached: false,
      },
    };
  }
};

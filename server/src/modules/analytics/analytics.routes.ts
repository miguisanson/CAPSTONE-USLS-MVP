import type { Request } from "express";
import { Router } from "express";
import { stringify } from "csv-stringify/sync";
import {
  canAccessAnalyticsDescriptive,
  canAccessAnalyticsPrescriptive,
  logAccessDenied,
} from "../../auth/policy";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../utils/async-handler";
import { HttpError } from "../../utils/http-error";
import {
  generatePrescriptiveAnalytics,
  prescriptiveFilterSchema,
} from "./prescriptive.service";

type StageCount = {
  stage: string;
  count: bigint;
};

type QueueCount = {
  queue_role: string | null;
  count: bigint;
};

type AgingMetric = {
  stage: string;
  avg_days_in_stage: number | null;
};

type SchedulingMetric = {
  avg_cycle_days: number | null;
};

type LoadMetric = {
  owner: string | null;
  task_count: bigint;
};

const getDescriptiveAnalytics = async () => {
  const [stageCounts, pendingQueues, agingByStage, schedulingCycle, loaVisibility, workload] =
    await Promise.all([
      prisma.$queryRaw<StageCount[]>`
        SELECT currentStage AS stage, COUNT(*) AS count
        FROM Student
        GROUP BY currentStage
        ORDER BY currentStage ASC
      `,
      prisma.$queryRaw<QueueCount[]>`
        SELECT nextActionOwnerRole AS queue_role, COUNT(*) AS count
        FROM Task
        WHERE status IN ('PENDING', 'IN_PROGRESS', 'OVERDUE')
        GROUP BY nextActionOwnerRole
        ORDER BY count DESC
      `,
      prisma.$queryRaw<AgingMetric[]>`
        SELECT s.currentStage AS stage, AVG(TIMESTAMPDIFF(DAY, sl.enteredAt, NOW())) AS avg_days_in_stage
        FROM Student s
        JOIN StudentLifecycle sl ON sl.studentId = s.id AND sl.exitedAt IS NULL
        GROUP BY s.currentStage
        ORDER BY s.currentStage ASC
      `,
      prisma.$queryRaw<SchedulingMetric[]>`
        SELECT AVG(TIMESTAMPDIFF(DAY, sr.createdAt, se.createdAt)) AS avg_cycle_days
        FROM ScheduleRequest sr
        JOIN (
          SELECT scheduleRequestId, MIN(createdAt) AS createdAt
          FROM ScheduleEvent
          WHERE eventStatus = 'CONFIRMED'
          GROUP BY scheduleRequestId
        ) se ON se.scheduleRequestId = sr.id
      `,
      prisma.student.count({
        where: {
          currentStage: "LOA",
        },
      }),
      prisma.$queryRaw<LoadMetric[]>`
        SELECT u.fullName AS owner, COUNT(t.id) AS task_count
        FROM UserAccount u
        LEFT JOIN Task t ON t.assignedToId = u.id AND t.status IN ('PENDING', 'IN_PROGRESS', 'OVERDUE')
        GROUP BY u.id, u.fullName
        ORDER BY task_count DESC
        LIMIT 15
      `,
    ]);

  return {
    stageCounts: stageCounts.map((item) => ({
      stage: item.stage,
      count: Number(item.count),
    })),
    pendingQueues: pendingQueues.map((item) => ({
      role: item.queue_role ?? "UNASSIGNED",
      count: Number(item.count),
    })),
    agingByStage: agingByStage.map((item) => ({
      stage: item.stage,
      averageDays: item.avg_days_in_stage ? Number(item.avg_days_in_stage.toFixed(2)) : 0,
    })),
    schedulingCycleTimeDays: schedulingCycle[0]?.avg_cycle_days
      ? Number(schedulingCycle[0].avg_cycle_days.toFixed(2))
      : 0,
    loaVisibilityCount: loaVisibility,
    workloadIndicators: workload.map((item) => ({
      owner: item.owner ?? "Unassigned",
      taskCount: Number(item.task_count),
    })),
  };
};

const ensureDescriptiveAccess = async (req: Request) => {
  if (!canAccessAnalyticsDescriptive(req.user!)) {
    await logAccessDenied(req, "Analytics descriptive access denied.");
    throw new HttpError(403, "You are not authorized to access analytics.");
  }
};

const ensurePrescriptiveAccess = async (req: Request) => {
  if (!canAccessAnalyticsPrescriptive(req.user!)) {
    await logAccessDenied(req, "Analytics prescriptive access denied.");
    throw new HttpError(403, "You are not authorized to access prescriptive analytics.");
  }
};

export const analyticsRouter = Router();

const descriptiveHandler = asyncHandler(async (req, res) => {
  await ensureDescriptiveAccess(req);
  const payload = await getDescriptiveAnalytics();
  res.json(payload);
});

analyticsRouter.get("/descriptive", descriptiveHandler);
analyticsRouter.get("/dashboard", descriptiveHandler);

analyticsRouter.post(
  "/prescriptive",
  asyncHandler(async (req, res) => {
    await ensurePrescriptiveAccess(req);

    const parsed = prescriptiveFilterSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw new HttpError(400, "Invalid prescriptive analytics filters.");
    }

    if (env.ENABLE_OPENAI_ASSIST && !env.OPENAI_API_KEY) {
      throw new HttpError(
        500,
        "ENABLE_OPENAI_ASSIST is true but OPENAI_API_KEY is missing. Set OPENAI_API_KEY or disable the feature flag."
      );
    }

    try {
      const payload = await generatePrescriptiveAnalytics(req.user!, parsed.data);
      res.json(payload);
    } catch (error) {
      if (error instanceof Error && error.message === "RATE_LIMITED") {
        throw new HttpError(429, "Prescriptive AI request limit reached (10 requests/hour).");
      }
      if (error instanceof Error && error.message === "OPENAI_KEY_MISSING") {
        throw new HttpError(500, "OPENAI_API_KEY is required when ENABLE_OPENAI_ASSIST=true.");
      }
      throw error;
    }
  })
);

analyticsRouter.get(
  "/report.csv",
  asyncHandler(async (req, res) => {
    await ensureDescriptiveAccess(req);
    const data = await getDescriptiveAnalytics();

    const rows: Array<Record<string, string | number>> = [];
    data.stageCounts.forEach((item) => {
      rows.push({
        section: "counts_per_stage",
        key: item.stage,
        value: item.count,
      });
    });
    data.pendingQueues.forEach((item) => {
      rows.push({
        section: "pending_queues",
        key: item.role,
        value: item.count,
      });
    });
    data.agingByStage.forEach((item) => {
      rows.push({
        section: "aging_time_in_stage",
        key: item.stage,
        value: item.averageDays,
      });
    });
    rows.push({
      section: "scheduling_cycle_time",
      key: "average_days",
      value: data.schedulingCycleTimeDays,
    });
    rows.push({
      section: "loa_visibility",
      key: "count",
      value: data.loaVisibilityCount,
    });

    const csv = stringify(rows, {
      header: true,
      columns: ["section", "key", "value"],
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="analytics-report.csv"');
    res.send(csv);
  })
);

analyticsRouter.get(
  "/report-view",
  asyncHandler(async (req, res) => {
    await ensureDescriptiveAccess(req);
    const data = await getDescriptiveAnalytics();

    const rowsHtml = data.stageCounts
      .map((item) => `<tr><td>${item.stage}</td><td style="text-align:right">${item.count}</td></tr>`)
      .join("");
    const queueRows = data.pendingQueues
      .map((item) => `<tr><td>${item.role}</td><td style="text-align:right">${item.count}</td></tr>`)
      .join("");

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Graduate Lifecycle Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #1f2937; }
            h1 { color: #026f38; margin: 0 0 12px; }
            h2 { margin-top: 24px; color: #14532d; }
            p { color: #374151; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #d1d5db; padding: 10px; }
            th { background: #f3f4f6; text-align: left; }
          </style>
        </head>
        <body>
          <h1>Graduate Student Lifecycle Report</h1>
          <p>Generated: ${new Date().toISOString()}</p>
          <h2>Counts Per Stage</h2>
          <table>
            <thead><tr><th>Stage</th><th>Count</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <h2>Pending Queues</h2>
          <table>
            <thead><tr><th>Queue Role</th><th>Count</th></tr></thead>
            <tbody>${queueRows}</tbody>
          </table>
        </body>
      </html>
    `;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  })
);

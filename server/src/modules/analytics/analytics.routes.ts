import { RoleName } from "@prisma/client";
import { Router } from "express";
import { stringify } from "csv-stringify/sync";
import { prisma } from "../../lib/prisma";
import { authorize } from "../../middleware/authorize";
import { asyncHandler } from "../../utils/async-handler";

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

export const analyticsRouter = Router();

analyticsRouter.get(
  "/dashboard",
  authorize(
    RoleName.ADMIN,
    RoleName.GRADUATE_SCHOOL_STAFF,
    RoleName.ACADEMIC_COORDINATOR,
    RoleName.RESEARCH_COORDINATOR,
    RoleName.ADVISER
  ),
  asyncHandler(async (_req, res) => {
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

    res.json({
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
    });
  })
);

analyticsRouter.get(
  "/report.csv",
  authorize(
    RoleName.ADMIN,
    RoleName.GRADUATE_SCHOOL_STAFF,
    RoleName.ACADEMIC_COORDINATOR,
    RoleName.RESEARCH_COORDINATOR
  ),
  asyncHandler(async (_req, res) => {
    const [stageCounts, pendingQueues] = await Promise.all([
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
    ]);

    const rows: Array<Record<string, string | number>> = [];
    stageCounts.forEach((item) => {
      rows.push({
        section: "counts_per_stage",
        key: item.stage,
        value: Number(item.count),
      });
    });
    pendingQueues.forEach((item) => {
      rows.push({
        section: "pending_queues",
        key: item.queue_role ?? "UNASSIGNED",
        value: Number(item.count),
      });
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
  authorize(
    RoleName.ADMIN,
    RoleName.GRADUATE_SCHOOL_STAFF,
    RoleName.ACADEMIC_COORDINATOR,
    RoleName.RESEARCH_COORDINATOR,
    RoleName.ADVISER
  ),
  asyncHandler(async (_req, res) => {
    const stageCounts = await prisma.$queryRaw<StageCount[]>`
      SELECT currentStage AS stage, COUNT(*) AS count
      FROM Student
      GROUP BY currentStage
      ORDER BY currentStage ASC
    `;

    const rowsHtml = stageCounts
      .map(
        (item) =>
          `<tr><td>${item.stage}</td><td style="text-align:right">${Number(item.count)}</td></tr>`
      )
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
            p { color: #374151; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #d1d5db; padding: 10px; }
            th { background: #f3f4f6; text-align: left; }
          </style>
        </head>
        <body>
          <h1>Graduate Student Lifecycle Report</h1>
          <p>Generated: ${new Date().toISOString()}</p>
          <table>
            <thead><tr><th>Stage</th><th>Count</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  })
);


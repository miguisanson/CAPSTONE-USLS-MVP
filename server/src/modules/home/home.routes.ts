import { TaskStatus } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import { asyncHandler } from "../../utils/async-handler";
import { buildStudentScopeWhere, buildTaskScopeWhere } from "../../utils/scope";

export const homeRouter = Router();

homeRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    const studentScope = buildStudentScopeWhere(req.user!);
    const taskScope = buildTaskScopeWhere(req.user!);

    const [studentsInScope, myOpenTasks, overdueTasks, openAlerts] = await Promise.all([
      prisma.student.count({ where: studentScope }),
      prisma.task.count({
        where: {
          AND: [
            taskScope,
            {
              OR: [{ assignedToId: req.user!.id }, { nextActionOwnerRole: { in: req.user!.roles } }],
            },
          ],
          status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.OVERDUE] },
        },
      }),
      prisma.task.count({
        where: {
          ...taskScope,
          status: TaskStatus.OVERDUE,
        },
      }),
      prisma.alert.count({
        where: {
          status: { in: ["OPEN", "ACKNOWLEDGED"] },
          student: studentScope,
        },
      }),
    ]);

    res.json({
      studentsInScope,
      myOpenTasks,
      overdueTasks,
      openAlerts,
      roles: req.user!.roles,
    });
  })
);

import { AlertSeverity, AlertStatus, AlertType, AuditActionType, RoleName, TaskStatus } from "@prisma/client";
import dayjs from "dayjs";
import { logAudit, logTimelineEvent } from "../../lib/audit";
import { sendSafePortalEmail } from "../../lib/mailer";
import { prisma } from "../../lib/prisma";

const toSeverity = (daysPastThreshold: number): AlertSeverity => {
  if (daysPastThreshold >= 14) return AlertSeverity.CRITICAL;
  if (daysPastThreshold >= 7) return AlertSeverity.HIGH;
  if (daysPastThreshold >= 3) return AlertSeverity.MEDIUM;
  return AlertSeverity.LOW;
};

const getThresholdValue = async (key: string, fallback: number): Promise<number> => {
  const threshold = await prisma.alertThreshold.findUnique({ where: { key } });
  if (!threshold || !threshold.enabled) {
    return fallback;
  }
  return threshold.thresholdDays;
};

const createAlertIfMissing = async (params: {
  studentId: number;
  taskId?: number;
  alertType: AlertType;
  thresholdDays: number;
  overdueDays: number;
  message: string;
  createdById?: number;
}) => {
  const existing = await prisma.alert.findFirst({
    where: {
      studentId: params.studentId,
      taskId: params.taskId ?? null,
      alertType: params.alertType,
      status: { in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED] },
    },
  });
  if (existing) return null;

  const alert = await prisma.alert.create({
    data: {
      studentId: params.studentId,
      taskId: params.taskId ?? null,
      alertType: params.alertType,
      status: AlertStatus.OPEN,
      severity: toSeverity(params.overdueDays - params.thresholdDays),
      thresholdDays: params.thresholdDays,
      message: params.message,
      createdById: params.createdById ?? null,
      triggeredAt: new Date(),
    },
  });

  await prisma.student.update({
    where: { id: params.studentId },
    data: { riskFlag: true },
  });

  return alert;
};

const notifyStakeholders = async (alertId: number, studentId: number, reason: string): Promise<number> => {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      adviser: true,
      researchCoordinator: true,
      panelAssignments: {
        include: { panelMember: true },
      },
      userAccount: true,
    },
  });
  if (!student) return 0;

  const staffUsers = await prisma.userAccount.findMany({
    where: {
      roles: {
        some: {
          role: {
            name: { in: [RoleName.GRADUATE_SCHOOL_STAFF, RoleName.ACADEMIC_COORDINATOR] },
          },
        },
      },
    },
  });

  const recipients = new Map<number, { id: number; email: string }>();
  if (student.adviser) recipients.set(student.adviser.id, { id: student.adviser.id, email: student.adviser.email });
  if (student.researchCoordinator) {
    recipients.set(student.researchCoordinator.id, {
      id: student.researchCoordinator.id,
      email: student.researchCoordinator.email,
    });
  }
  if (student.userAccount) {
    recipients.set(student.userAccount.id, { id: student.userAccount.id, email: student.userAccount.email });
  }
  student.panelAssignments.forEach((assignment) => {
    recipients.set(assignment.panelMember.id, {
      id: assignment.panelMember.id,
      email: assignment.panelMember.email,
    });
  });
  staffUsers.forEach((staff) => recipients.set(staff.id, { id: staff.id, email: staff.email }));

  let notificationCount = 0;
  for (const recipient of recipients.values()) {
    const sent = await sendSafePortalEmail({
      to: recipient.email,
      subject: "Graduate Lifecycle Alert",
      summaryLine: reason,
      portalPath: `/alerts?studentId=${studentId}`,
    });

    await prisma.notificationAlert.create({
      data: {
        alertId,
        userId: recipient.id,
        email: recipient.email,
        reason,
        success: sent.success,
        metadata: {
          deliveryReason: sent.reason ?? null,
          messageId: sent.messageId ?? null,
        },
      },
    });

    notificationCount += 1;
  }

  return notificationCount;
};

export const runMonitoringCycle = async (triggeredById?: number): Promise<{ alertsCreated: number; notificationsSent: number }> => {
  let alertsCreated = 0;
  let notificationsSent = 0;

  const prolongedFallback = 30;
  const handoffFallback = 7;
  const scheduleFallback = 10;
  const inactivityFallback = 14;

  const [students, tasks, scheduleRequests] = await Promise.all([
    prisma.student.findMany({
      include: {
        lifecycleHistory: {
          where: { exitedAt: null },
          orderBy: { enteredAt: "desc" },
          take: 1,
        },
      },
    }),
    prisma.task.findMany({
      where: { status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS, TaskStatus.OVERDUE] } },
      include: { student: true },
    }),
    prisma.scheduleRequest.findMany({
      where: { status: { in: ["REQUESTED", "RESCHEDULED"] } },
      include: {
        student: true,
        scheduleEvents: { orderBy: { createdAt: "desc" } },
      },
    }),
  ]);

  for (const student of students) {
    const currentLifecycle = student.lifecycleHistory[0];
    if (currentLifecycle) {
      const thresholdKey = `STAGE_${student.currentStage}`;
      const thresholdDays = await getThresholdValue(thresholdKey, prolongedFallback);
      const daysInStage = dayjs().diff(dayjs(currentLifecycle.enteredAt), "day");
      if (daysInStage > thresholdDays) {
        const alert = await createAlertIfMissing({
          studentId: student.id,
          alertType: AlertType.PROLONGED_STAGE,
          thresholdDays,
          overdueDays: daysInStage,
          message: `Time in stage exceeded threshold (${daysInStage} days > ${thresholdDays}).`,
          createdById: triggeredById,
        });

        if (alert) {
          alertsCreated += 1;
          notificationsSent += await notifyStakeholders(
            alert.id,
            student.id,
            "A student lifecycle stage has exceeded monitoring thresholds."
          );

          await logTimelineEvent({
            studentId: student.id,
            eventType: "ALERT_TRIGGERED",
            title: "Prolonged time-in-stage alert",
            details: alert.message,
            relatedEntityType: "Alert",
            relatedEntityId: alert.id,
            performedById: triggeredById,
          });
        }
      }
    }

    const inactivityThreshold = await getThresholdValue("INACTIVITY_DAYS", inactivityFallback);
    const latestActivity = await prisma.timelineEvent.findFirst({
      where: { studentId: student.id },
      orderBy: { occurredAt: "desc" },
    });

    const daysInactive = latestActivity ? dayjs().diff(dayjs(latestActivity.occurredAt), "day") : 999;
    if (daysInactive > inactivityThreshold) {
      const alert = await createAlertIfMissing({
        studentId: student.id,
        alertType: AlertType.INACTIVITY,
        thresholdDays: inactivityThreshold,
        overdueDays: daysInactive,
        message: `No student activity for ${daysInactive} days.`,
        createdById: triggeredById,
      });

      if (alert) {
        alertsCreated += 1;
        notificationsSent += await notifyStakeholders(
          alert.id,
          student.id,
          "A student record is inactive beyond the configured threshold."
        );
      }
    }
  }

  const handoffThreshold = await getThresholdValue("UNRESOLVED_HANDOFF_DAYS", handoffFallback);
  for (const task of tasks) {
    if (!task.dueAt || !task.studentId) continue;
    const overdueDays = dayjs().diff(dayjs(task.dueAt), "day");
    if (overdueDays <= handoffThreshold) continue;

    const alert = await createAlertIfMissing({
      studentId: task.studentId,
      taskId: task.id,
      alertType: AlertType.UNRESOLVED_HANDOFF,
      thresholdDays: handoffThreshold,
      overdueDays,
      message: `Task handoff unresolved for ${overdueDays} days past due date.`,
      createdById: triggeredById,
    });

    if (alert) {
      alertsCreated += 1;
      notificationsSent += await notifyStakeholders(
        alert.id,
        task.studentId,
        "A workflow handoff is unresolved and requires intervention."
      );
    }
  }

  const scheduleThreshold = await getThresholdValue("DELAYED_SCHEDULING_DAYS", scheduleFallback);
  for (const scheduleRequest of scheduleRequests) {
    const daysOpen = dayjs().diff(dayjs(scheduleRequest.createdAt), "day");
    const lastEvent = scheduleRequest.scheduleEvents[0];
    const confirmed = lastEvent?.eventStatus === "CONFIRMED" || scheduleRequest.status === "CONFIRMED";
    if (confirmed || daysOpen <= scheduleThreshold) continue;

    const alert = await createAlertIfMissing({
      studentId: scheduleRequest.studentId,
      alertType: AlertType.DELAYED_SCHEDULING,
      thresholdDays: scheduleThreshold,
      overdueDays: daysOpen,
      message: `Defense scheduling delayed for ${daysOpen} days since request.`,
      createdById: triggeredById,
    });

    if (alert) {
      alertsCreated += 1;
      notificationsSent += await notifyStakeholders(
        alert.id,
        scheduleRequest.studentId,
        "A defense schedule request is delayed beyond threshold."
      );
    }
  }

  if (triggeredById) {
    await logAudit({
      actorUserId: triggeredById,
      actionType: AuditActionType.ALERT_TRIGGER,
      entityType: "AlertEngine",
      description: "Monitoring cycle executed.",
      metadata: { alertsCreated, notificationsSent },
    });
  }

  return { alertsCreated, notificationsSent };
};


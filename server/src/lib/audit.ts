import { AuditActionType, Prisma } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "./prisma";

type AuditInput = {
  actorUserId?: number | null;
  actionType: AuditActionType;
  entityType: string;
  entityId?: string | null;
  description: string;
  metadata?: Prisma.InputJsonValue;
  req?: Request;
};

type TimelineInput = {
  studentId: number;
  eventType: string;
  title: string;
  details?: string;
  relatedEntityType?: string;
  relatedEntityId?: number;
  performedById?: number;
};

export const logAudit = async (input: AuditInput): Promise<void> => {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      actionType: input.actionType,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      description: input.description,
      metadata: input.metadata,
      ipAddress: input.req?.ip,
      userAgent: input.req?.headers["user-agent"] ?? null,
    },
  });
};

export const logTimelineEvent = async (input: TimelineInput): Promise<void> => {
  await prisma.timelineEvent.create({
    data: {
      studentId: input.studentId,
      eventType: input.eventType,
      title: input.title,
      details: input.details,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      performedById: input.performedById,
    },
  });
};


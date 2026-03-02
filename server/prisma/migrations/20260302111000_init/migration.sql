-- CreateTable
CREATE TABLE `UserAccount` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `UserAccount_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` ENUM('ADMIN', 'GRADUATE_SCHOOL_STAFF', 'ACADEMIC_COORDINATOR', 'RESEARCH_COORDINATOR', 'ADVISER', 'PANEL_MEMBER', 'STUDENT') NOT NULL,
    `description` VARCHAR(191) NULL,

    UNIQUE INDEX `Role_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserRole` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `roleId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserRole_roleId_idx`(`roleId`),
    UNIQUE INDEX `UserRole_userId_roleId_key`(`userId`, `roleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Program` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Program_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Student` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentNumber` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `programId` INTEGER NOT NULL,
    `userAccountId` INTEGER NULL,
    `currentStage` ENUM('ADMISSION', 'COURSEWORK', 'PROPOSAL_DEVELOPMENT', 'PROPOSAL_DEFENSE', 'DATA_COLLECTION', 'DISSERTATION_WRITING', 'ORAL_DEFENSE', 'LOA', 'COMPLETED') NOT NULL DEFAULT 'ADMISSION',
    `riskFlag` BOOLEAN NOT NULL DEFAULT false,
    `loaStart` DATETIME(3) NULL,
    `loaEnd` DATETIME(3) NULL,
    `adviserId` INTEGER NULL,
    `researchCoordinatorId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Student_studentNumber_key`(`studentNumber`),
    UNIQUE INDEX `Student_email_key`(`email`),
    UNIQUE INDEX `Student_userAccountId_key`(`userAccountId`),
    INDEX `Student_programId_idx`(`programId`),
    INDEX `Student_currentStage_idx`(`currentStage`),
    INDEX `Student_adviserId_idx`(`adviserId`),
    INDEX `Student_researchCoordinatorId_idx`(`researchCoordinatorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudentPanelAssignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `panelMemberId` INTEGER NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `StudentPanelAssignment_panelMemberId_idx`(`panelMemberId`),
    UNIQUE INDEX `StudentPanelAssignment_studentId_panelMemberId_key`(`studentId`, `panelMemberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudentLifecycle` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `stage` ENUM('ADMISSION', 'COURSEWORK', 'PROPOSAL_DEVELOPMENT', 'PROPOSAL_DEFENSE', 'DATA_COLLECTION', 'DISSERTATION_WRITING', 'ORAL_DEFENSE', 'LOA', 'COMPLETED') NOT NULL,
    `enteredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `exitedAt` DATETIME(3) NULL,
    `notes` VARCHAR(191) NULL,
    `changedById` INTEGER NULL,

    INDEX `StudentLifecycle_studentId_enteredAt_idx`(`studentId`, `enteredAt`),
    INDEX `StudentLifecycle_stage_idx`(`stage`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MilestoneDefinition` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `stage` ENUM('ADMISSION', 'COURSEWORK', 'PROPOSAL_DEVELOPMENT', 'PROPOSAL_DEFENSE', 'DATA_COLLECTION', 'DISSERTATION_WRITING', 'ORAL_DEFENSE', 'LOA', 'COMPLETED') NOT NULL,
    `description` VARCHAR(191) NULL,
    `expectedDays` INTEGER NOT NULL DEFAULT 14,
    `criticality` INTEGER NOT NULL DEFAULT 1,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MilestoneDefinition_stage_active_idx`(`stage`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudentMilestoneStatus` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `milestoneDefinitionId` INTEGER NOT NULL,
    `status` ENUM('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED') NOT NULL DEFAULT 'NOT_STARTED',
    `dueAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `updatedById` INTEGER NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StudentMilestoneStatus_status_dueAt_idx`(`status`, `dueAt`),
    UNIQUE INDEX `StudentMilestoneStatus_studentId_milestoneDefinitionId_key`(`studentId`, `milestoneDefinitionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Task` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `studentId` INTEGER NULL,
    `milestoneDefinitionId` INTEGER NULL,
    `assignedToId` INTEGER NULL,
    `assignedRole` ENUM('ADMIN', 'GRADUATE_SCHOOL_STAFF', 'ACADEMIC_COORDINATOR', 'RESEARCH_COORDINATOR', 'ADVISER', 'PANEL_MEMBER', 'STUDENT') NULL,
    `nextActionOwnerRole` ENUM('ADMIN', 'GRADUATE_SCHOOL_STAFF', 'ACADEMIC_COORDINATOR', 'RESEARCH_COORDINATOR', 'ADVISER', 'PANEL_MEMBER', 'STUDENT') NULL,
    `status` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE') NOT NULL DEFAULT 'PENDING',
    `dueAt` DATETIME(3) NULL,
    `priorityScore` INTEGER NOT NULL DEFAULT 0,
    `recommendedAction` VARCHAR(191) NULL,
    `escalationPrompt` VARCHAR(191) NULL,
    `closedAt` DATETIME(3) NULL,
    `createdById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Task_status_dueAt_idx`(`status`, `dueAt`),
    INDEX `Task_assignedToId_status_idx`(`assignedToId`, `status`),
    INDEX `Task_studentId_idx`(`studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DecisionLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `taskId` INTEGER NOT NULL,
    `studentId` INTEGER NULL,
    `decision` ENUM('APPROVE', 'REVISE', 'RETURN') NOT NULL,
    `rationale` VARCHAR(191) NULL,
    `decidedById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DecisionLog_taskId_createdAt_idx`(`taskId`, `createdAt`),
    INDEX `DecisionLog_studentId_createdAt_idx`(`studentId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentRecord` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `milestoneDefinitionId` INTEGER NULL,
    `checklistItem` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'NEEDS_REVISION') NOT NULL DEFAULT 'PENDING',
    `outstandingRevisionCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DocumentRecord_studentId_status_idx`(`studentId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentVersion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `documentRecordId` INTEGER NOT NULL,
    `versionNumber` INTEGER NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `filePath` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `uploadedById` INTEGER NOT NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isCurrent` BOOLEAN NOT NULL DEFAULT true,

    INDEX `DocumentVersion_documentRecordId_isCurrent_idx`(`documentRecordId`, `isCurrent`),
    UNIQUE INDEX `DocumentVersion_documentRecordId_versionNumber_key`(`documentRecordId`, `versionNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RevisionNote` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `documentRecordId` INTEGER NOT NULL,
    `versionId` INTEGER NULL,
    `authorId` INTEGER NOT NULL,
    `note` VARCHAR(191) NOT NULL,
    `isResolved` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,

    INDEX `RevisionNote_documentRecordId_isResolved_idx`(`documentRecordId`, `isResolved`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScheduleRequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `requestedById` INTEGER NOT NULL,
    `preferredDate` DATETIME(3) NULL,
    `reason` VARCHAR(191) NULL,
    `status` ENUM('REQUESTED', 'CONFIRMED', 'RESCHEDULED', 'CANCELLED') NOT NULL DEFAULT 'REQUESTED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ScheduleRequest_studentId_status_idx`(`studentId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Availability` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `scheduleRequestId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `availableFrom` DATETIME(3) NOT NULL,
    `availableTo` DATETIME(3) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Availability_scheduleRequestId_idx`(`scheduleRequestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScheduleEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `scheduleRequestId` INTEGER NOT NULL,
    `eventStatus` ENUM('REQUESTED', 'CONFIRMED', 'RESCHEDULED', 'CANCELLED') NOT NULL,
    `scheduledAt` DATETIME(3) NULL,
    `decidedById` INTEGER NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ScheduleEvent_scheduleRequestId_eventStatus_idx`(`scheduleRequestId`, `eventStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AlertThreshold` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `stage` ENUM('ADMISSION', 'COURSEWORK', 'PROPOSAL_DEVELOPMENT', 'PROPOSAL_DEFENSE', 'DATA_COLLECTION', 'DISSERTATION_WRITING', 'ORAL_DEFENSE', 'LOA', 'COMPLETED') NULL,
    `thresholdDays` INTEGER NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `description` VARCHAR(191) NOT NULL,
    `createdById` INTEGER NULL,
    `updatedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AlertThreshold_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RoutingRule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fromStage` ENUM('ADMISSION', 'COURSEWORK', 'PROPOSAL_DEVELOPMENT', 'PROPOSAL_DEFENSE', 'DATA_COLLECTION', 'DISSERTATION_WRITING', 'ORAL_DEFENSE', 'LOA', 'COMPLETED') NOT NULL,
    `decision` ENUM('APPROVE', 'REVISE', 'RETURN') NULL,
    `nextOwnerRole` ENUM('ADMIN', 'GRADUATE_SCHOOL_STAFF', 'ACADEMIC_COORDINATOR', 'RESEARCH_COORDINATOR', 'ADVISER', 'PANEL_MEMBER', 'STUDENT') NOT NULL,
    `taskTemplate` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdById` INTEGER NULL,
    `updatedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RoutingRule_fromStage_decision_active_idx`(`fromStage`, `decision`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Alert` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `taskId` INTEGER NULL,
    `alertType` ENUM('PROLONGED_STAGE', 'UNRESOLVED_HANDOFF', 'DELAYED_SCHEDULING', 'INACTIVITY') NOT NULL,
    `severity` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
    `status` ENUM('OPEN', 'ACKNOWLEDGED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `message` VARCHAR(191) NOT NULL,
    `thresholdDays` INTEGER NULL,
    `triggeredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,
    `createdById` INTEGER NULL,
    `closedById` INTEGER NULL,

    INDEX `Alert_status_severity_triggeredAt_idx`(`status`, `severity`, `triggeredAt`),
    INDEX `Alert_studentId_status_idx`(`studentId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Intervention` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `alertId` INTEGER NOT NULL,
    `actionTaken` VARCHAR(191) NOT NULL,
    `evidenceNote` VARCHAR(191) NULL,
    `performedById` INTEGER NOT NULL,
    `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `performedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closedAt` DATETIME(3) NULL,
    `closureEvidence` VARCHAR(191) NULL,

    INDEX `Intervention_alertId_status_idx`(`alertId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificationAlert` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `alertId` INTEGER NULL,
    `userId` INTEGER NULL,
    `email` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `channel` ENUM('EMAIL', 'PORTAL') NOT NULL DEFAULT 'EMAIL',
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `success` BOOLEAN NOT NULL DEFAULT true,
    `metadata` JSON NULL,

    INDEX `NotificationAlert_sentAt_idx`(`sentAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TimelineEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `eventType` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `details` VARCHAR(191) NULL,
    `relatedEntityType` VARCHAR(191) NULL,
    `relatedEntityId` INTEGER NULL,
    `performedById` INTEGER NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TimelineEvent_studentId_occurredAt_idx`(`studentId`, `occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `actorUserId` INTEGER NULL,
    `actionType` ENUM('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT', 'ACCESS_DENIED', 'CREATE', 'UPDATE', 'DELETE', 'STATUS_TRANSITION', 'DECISION', 'SUBMISSION', 'UPLOAD', 'CONFIG_CHANGE', 'ALERT_TRIGGER', 'ALERT_RESOLVED', 'NOTIFICATION_SENT') NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `description` VARCHAR(191) NOT NULL,
    `metadata` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_actionType_createdAt_idx`(`actionType`, `createdAt`),
    INDEX `AuditLog_actorUserId_createdAt_idx`(`actorUserId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `UserAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Student` ADD CONSTRAINT `Student_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `Program`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Student` ADD CONSTRAINT `Student_userAccountId_fkey` FOREIGN KEY (`userAccountId`) REFERENCES `UserAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Student` ADD CONSTRAINT `Student_adviserId_fkey` FOREIGN KEY (`adviserId`) REFERENCES `UserAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Student` ADD CONSTRAINT `Student_researchCoordinatorId_fkey` FOREIGN KEY (`researchCoordinatorId`) REFERENCES `UserAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentPanelAssignment` ADD CONSTRAINT `StudentPanelAssignment_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentPanelAssignment` ADD CONSTRAINT `StudentPanelAssignment_panelMemberId_fkey` FOREIGN KEY (`panelMemberId`) REFERENCES `UserAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentLifecycle` ADD CONSTRAINT `StudentLifecycle_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MilestoneDefinition` ADD CONSTRAINT `MilestoneDefinition_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `UserAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentMilestoneStatus` ADD CONSTRAINT `StudentMilestoneStatus_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentMilestoneStatus` ADD CONSTRAINT `StudentMilestoneStatus_milestoneDefinitionId_fkey` FOREIGN KEY (`milestoneDefinitionId`) REFERENCES `MilestoneDefinition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentMilestoneStatus` ADD CONSTRAINT `StudentMilestoneStatus_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `UserAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_milestoneDefinitionId_fkey` FOREIGN KEY (`milestoneDefinitionId`) REFERENCES `MilestoneDefinition`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `UserAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `UserAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DecisionLog` ADD CONSTRAINT `DecisionLog_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DecisionLog` ADD CONSTRAINT `DecisionLog_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DecisionLog` ADD CONSTRAINT `DecisionLog_decidedById_fkey` FOREIGN KEY (`decidedById`) REFERENCES `UserAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentRecord` ADD CONSTRAINT `DocumentRecord_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentRecord` ADD CONSTRAINT `DocumentRecord_milestoneDefinitionId_fkey` FOREIGN KEY (`milestoneDefinitionId`) REFERENCES `MilestoneDefinition`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentVersion` ADD CONSTRAINT `DocumentVersion_documentRecordId_fkey` FOREIGN KEY (`documentRecordId`) REFERENCES `DocumentRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentVersion` ADD CONSTRAINT `DocumentVersion_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `UserAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RevisionNote` ADD CONSTRAINT `RevisionNote_documentRecordId_fkey` FOREIGN KEY (`documentRecordId`) REFERENCES `DocumentRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RevisionNote` ADD CONSTRAINT `RevisionNote_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `DocumentVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RevisionNote` ADD CONSTRAINT `RevisionNote_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `UserAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleRequest` ADD CONSTRAINT `ScheduleRequest_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleRequest` ADD CONSTRAINT `ScheduleRequest_requestedById_fkey` FOREIGN KEY (`requestedById`) REFERENCES `UserAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Availability` ADD CONSTRAINT `Availability_scheduleRequestId_fkey` FOREIGN KEY (`scheduleRequestId`) REFERENCES `ScheduleRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Availability` ADD CONSTRAINT `Availability_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `UserAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleEvent` ADD CONSTRAINT `ScheduleEvent_scheduleRequestId_fkey` FOREIGN KEY (`scheduleRequestId`) REFERENCES `ScheduleRequest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleEvent` ADD CONSTRAINT `ScheduleEvent_decidedById_fkey` FOREIGN KEY (`decidedById`) REFERENCES `UserAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AlertThreshold` ADD CONSTRAINT `AlertThreshold_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `UserAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AlertThreshold` ADD CONSTRAINT `AlertThreshold_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `UserAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoutingRule` ADD CONSTRAINT `RoutingRule_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `UserAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoutingRule` ADD CONSTRAINT `RoutingRule_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `UserAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Alert` ADD CONSTRAINT `Alert_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Alert` ADD CONSTRAINT `Alert_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Alert` ADD CONSTRAINT `Alert_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `UserAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Alert` ADD CONSTRAINT `Alert_closedById_fkey` FOREIGN KEY (`closedById`) REFERENCES `UserAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Intervention` ADD CONSTRAINT `Intervention_alertId_fkey` FOREIGN KEY (`alertId`) REFERENCES `Alert`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Intervention` ADD CONSTRAINT `Intervention_performedById_fkey` FOREIGN KEY (`performedById`) REFERENCES `UserAccount`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationAlert` ADD CONSTRAINT `NotificationAlert_alertId_fkey` FOREIGN KEY (`alertId`) REFERENCES `Alert`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationAlert` ADD CONSTRAINT `NotificationAlert_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `UserAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimelineEvent` ADD CONSTRAINT `TimelineEvent_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TimelineEvent` ADD CONSTRAINT `TimelineEvent_performedById_fkey` FOREIGN KEY (`performedById`) REFERENCES `UserAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorUserId_fkey` FOREIGN KEY (`actorUserId`) REFERENCES `UserAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;


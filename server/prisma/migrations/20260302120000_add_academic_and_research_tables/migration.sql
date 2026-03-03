-- CreateTable
CREATE TABLE `AcademicTerm` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `academicYear` VARCHAR(20) NOT NULL,
    `term` VARCHAR(20) NOT NULL,
    `startDate` DATE NULL,
    `endDate` DATE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TermEnrollment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `termId` INTEGER NOT NULL,
    `statusSignal` VARCHAR(50) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TermEnrollment_studentId_idx`(`studentId`),
    INDEX `TermEnrollment_termId_idx`(`termId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Course` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `programId` INTEGER NULL,
    `code` VARCHAR(50) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `units` DECIMAL(4, 2) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Course_code_key`(`code`),
    INDEX `Course_programId_idx`(`programId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CourseEnrollment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `termEnrollmentId` INTEGER NOT NULL,
    `courseId` INTEGER NOT NULL,
    `statusSignal` VARCHAR(50) NULL,
    `grade` VARCHAR(20) NULL,
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CourseEnrollment_termEnrollmentId_idx`(`termEnrollmentId`),
    INDEX `CourseEnrollment_courseId_idx`(`courseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Curriculum` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `programId` INTEGER NULL,
    `code` VARCHAR(50) NOT NULL,
    `version` VARCHAR(50) NULL,
    `effectiveAcademicYear` VARCHAR(20) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Curriculum_programId_idx`(`programId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudyPlanItem` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `curriculumId` INTEGER NOT NULL,
    `courseId` INTEGER NOT NULL,
    `recommendedTermId` INTEGER NULL,
    `isRequired` BOOLEAN NOT NULL DEFAULT true,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StudyPlanItem_curriculumId_idx`(`curriculumId`),
    INDEX `StudyPlanItem_courseId_idx`(`courseId`),
    INDEX `StudyPlanItem_recommendedTermId_idx`(`recommendedTermId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudentCurriculumTag` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `curriculumId` INTEGER NOT NULL,
    `tag` VARCHAR(50) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StudentCurriculumTag_studentId_idx`(`studentId`),
    INDEX `StudentCurriculumTag_curriculumId_idx`(`curriculumId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ResearchCase` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `caseType` VARCHAR(50) NULL,
    `topicTitle` VARCHAR(191) NULL,
    `status` VARCHAR(50) NULL,
    `currentMilestoneId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ResearchCase_studentId_idx`(`studentId`),
    INDEX `ResearchCase_currentMilestoneId_idx`(`currentMilestoneId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MilestoneEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `researchCaseId` INTEGER NULL,
    `studentId` INTEGER NOT NULL,
    `milestoneDefinitionId` INTEGER NOT NULL,
    `occurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `outcome` VARCHAR(50) NULL,
    `ownerRole` ENUM('ADMIN', 'GRADUATE_SCHOOL_STAFF', 'ACADEMIC_COORDINATOR', 'RESEARCH_COORDINATOR', 'ADVISER', 'PANEL_MEMBER', 'STUDENT') NULL,
    `decidedById` INTEGER NULL,
    `taskId` INTEGER NULL,
    `notes` TEXT NULL,

    INDEX `MilestoneEvent_researchCaseId_idx`(`researchCaseId`),
    INDEX `MilestoneEvent_studentId_idx`(`studentId`),
    INDEX `MilestoneEvent_milestoneDefinitionId_idx`(`milestoneDefinitionId`),
    INDEX `MilestoneEvent_decidedById_idx`(`decidedById`),
    INDEX `MilestoneEvent_taskId_idx`(`taskId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FormSubmission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `milestoneEventId` INTEGER NULL,
    `formType` VARCHAR(50) NOT NULL,
    `submittedAt` DATETIME(3) NULL,
    `endorsedAt` DATETIME(3) NULL,
    `approvedAt` DATETIME(3) NULL,
    `routingState` VARCHAR(50) NULL,
    `submittedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FormSubmission_studentId_idx`(`studentId`),
    INDEX `FormSubmission_milestoneEventId_idx`(`milestoneEventId`),
    INDEX `FormSubmission_submittedById_idx`(`submittedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClearanceRecord` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `studentId` INTEGER NOT NULL,
    `milestoneDefinitionId` INTEGER NULL,
    `submittedAt` DATETIME(3) NULL,
    `clearedAt` DATETIME(3) NULL,
    `status` VARCHAR(50) NULL,
    `createdById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ClearanceRecord_studentId_idx`(`studentId`),
    INDEX `ClearanceRecord_milestoneDefinitionId_idx`(`milestoneDefinitionId`),
    INDEX `ClearanceRecord_createdById_idx`(`createdById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TermEnrollment` ADD CONSTRAINT `TermEnrollment_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TermEnrollment` ADD CONSTRAINT `TermEnrollment_termId_fkey` FOREIGN KEY (`termId`) REFERENCES `AcademicTerm`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Course` ADD CONSTRAINT `Course_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `Program`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CourseEnrollment` ADD CONSTRAINT `CourseEnrollment_termEnrollmentId_fkey` FOREIGN KEY (`termEnrollmentId`) REFERENCES `TermEnrollment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CourseEnrollment` ADD CONSTRAINT `CourseEnrollment_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Curriculum` ADD CONSTRAINT `Curriculum_programId_fkey` FOREIGN KEY (`programId`) REFERENCES `Program`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudyPlanItem` ADD CONSTRAINT `StudyPlanItem_curriculumId_fkey` FOREIGN KEY (`curriculumId`) REFERENCES `Curriculum`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudyPlanItem` ADD CONSTRAINT `StudyPlanItem_courseId_fkey` FOREIGN KEY (`courseId`) REFERENCES `Course`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudyPlanItem` ADD CONSTRAINT `StudyPlanItem_recommendedTermId_fkey` FOREIGN KEY (`recommendedTermId`) REFERENCES `AcademicTerm`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentCurriculumTag` ADD CONSTRAINT `StudentCurriculumTag_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudentCurriculumTag` ADD CONSTRAINT `StudentCurriculumTag_curriculumId_fkey` FOREIGN KEY (`curriculumId`) REFERENCES `Curriculum`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResearchCase` ADD CONSTRAINT `ResearchCase_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ResearchCase` ADD CONSTRAINT `ResearchCase_currentMilestoneId_fkey` FOREIGN KEY (`currentMilestoneId`) REFERENCES `MilestoneDefinition`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MilestoneEvent` ADD CONSTRAINT `MilestoneEvent_researchCaseId_fkey` FOREIGN KEY (`researchCaseId`) REFERENCES `ResearchCase`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MilestoneEvent` ADD CONSTRAINT `MilestoneEvent_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MilestoneEvent` ADD CONSTRAINT `MilestoneEvent_milestoneDefinitionId_fkey` FOREIGN KEY (`milestoneDefinitionId`) REFERENCES `MilestoneDefinition`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MilestoneEvent` ADD CONSTRAINT `MilestoneEvent_decidedById_fkey` FOREIGN KEY (`decidedById`) REFERENCES `UserAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MilestoneEvent` ADD CONSTRAINT `MilestoneEvent_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FormSubmission` ADD CONSTRAINT `FormSubmission_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FormSubmission` ADD CONSTRAINT `FormSubmission_milestoneEventId_fkey` FOREIGN KEY (`milestoneEventId`) REFERENCES `MilestoneEvent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FormSubmission` ADD CONSTRAINT `FormSubmission_submittedById_fkey` FOREIGN KEY (`submittedById`) REFERENCES `UserAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClearanceRecord` ADD CONSTRAINT `ClearanceRecord_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClearanceRecord` ADD CONSTRAINT `ClearanceRecord_milestoneDefinitionId_fkey` FOREIGN KEY (`milestoneDefinitionId`) REFERENCES `MilestoneDefinition`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClearanceRecord` ADD CONSTRAINT `ClearanceRecord_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `UserAccount`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

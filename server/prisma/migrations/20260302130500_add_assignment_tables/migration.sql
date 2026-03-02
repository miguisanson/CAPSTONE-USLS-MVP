-- CreateTable
CREATE TABLE `AdviserAssignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `adviserUserId` INTEGER NOT NULL,
    `studentId` INTEGER NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AdviserAssignment_adviserUserId_studentId_key`(`adviserUserId`, `studentId`),
    INDEX `AdviserAssignment_studentId_idx`(`studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PanelAssignment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `panelUserId` INTEGER NOT NULL,
    `studentId` INTEGER NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PanelAssignment_panelUserId_studentId_key`(`panelUserId`, `studentId`),
    INDEX `PanelAssignment_studentId_idx`(`studentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AdviserAssignment` ADD CONSTRAINT `AdviserAssignment_adviserUserId_fkey` FOREIGN KEY (`adviserUserId`) REFERENCES `UserAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdviserAssignment` ADD CONSTRAINT `AdviserAssignment_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PanelAssignment` ADD CONSTRAINT `PanelAssignment_panelUserId_fkey` FOREIGN KEY (`panelUserId`) REFERENCES `UserAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PanelAssignment` ADD CONSTRAINT `PanelAssignment_studentId_fkey` FOREIGN KEY (`studentId`) REFERENCES `Student`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

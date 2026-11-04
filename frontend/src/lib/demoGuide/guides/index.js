// Demo Guide content, one file per guide (so guides can be written in parallel). Shared pieces: guides/_shared.js.
import leaveOfAbsence from "./leave-of-absence.js";
import readmission from "./readmission.js";
import awol from "./awol.js";
import monitoring from "./monitoring.js";
import reports from "./reports.js";
import withdrawal from "./withdrawal.js";
import practicum from "./practicum.js";
import graduation from "./graduation.js";

export const GUIDES = [leaveOfAbsence, readmission, awol, monitoring, reports, withdrawal, practicum, graduation];

// The ready-made demo students that the existing reset (POST /api/auth/demo-students/<key>/reset) knows, by student number.
export const RESET_KEYS = {
  "GS-2026-LOA-01": "leave-of-absence-maureen",
  "GS-2026-LOA-02": "leave-of-absence-daniel",
  "GS-2026-READ-01": "readmission-therese",
  "GS-2026-READ-02": "readmission-gabriel",
  "GS-2026-AWOL-01": "awol-maya",
  "GS-2026-WD-01": "withdrawal-elena",
  "GS-2026-PRAC-02": "practicum-paolo",
  "GS-2026-GRAD-02": "graduation-carlo",
};

export const guideById = (id) => GUIDES.find((guide) => guide.id === id) || null;

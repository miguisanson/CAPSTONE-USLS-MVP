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
  "2690801": "leave-of-absence-maureen",
  "2690802": "leave-of-absence-daniel",
  "2690901": "readmission-therese",
  "2690902": "readmission-gabriel",
  "2691001": "awol-maya",
  "2690401": "withdrawal-elena",
  "2690202": "practicum-paolo",
  "2690302": "graduation-carlo",
};

export const guideById = (id) => GUIDES.find((guide) => guide.id === id) || null;

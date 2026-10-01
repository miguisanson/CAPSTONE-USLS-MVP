import { CalendarClock, CalendarOff, LogOut, Plus, UserCheck, UserX } from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import FollowUpStrip from "../pages/leave/FollowUpStrip";
import RegistrarPanel from "../pages/leave/RegistrarPanel";
import { syncSummary } from "../pages/leave/leaveHelpers";
import ResidencyDialog from "../pages/process/ResidencyDialog";
import AwolRegistrar from "../pages/process/AwolRegistrar";
import WithdrawalExport from "../pages/process/WithdrawalExport";

// What makes each standalone process different. Everything else (header, rules panel,
// toolbar, board, case window, batch bar) is the same component: ProcessBoardPage.
// A process only supplies: its words, its guide, and the few extras that only it has.
// Its stages, cards and steps come from the server (standalone_process.py / leave_workflow.py).

export const PROCESS_SLUGS = ["leave-of-absence", "readmission", "awol", "withdrawal"];

export const GUIDES = {
  "leave-of-absence": {
    purpose: "Follows every Leave of Absence request from filing to the end of the leave, and keeps the student's record correct at each step.",
    submitter: "The student fills in the start and end semester, an allowed reason and the circumstances. A student already on leave can ask once for an extension.",
    reviewers: "Graduate School Staff check the request against the handbook rules and forward it; the Dean approves, returns or denies; staff send the approved leaves to the Registrar.",
    stages: ["Submitted", "Staff review", "With the Dean", "Leave scheduled", "On leave", "Return due", "Closed"],
    incomplete: "Staff or the Dean can return a request with a comment. The student corrects the same request and sends it again. A denial tells the student what happens next.",
    final: "The leave starts when its first semester begins: the student becomes On Leave, subjects of that semester are closed (marked W if filed in the second half), and a leave record is kept for each semester. When the leave is ending, staff see it as Return due. A leave that ends with no return is only proposed as AWOL; a staff member confirms it.",
  },
  readmission: {
    purpose: "Brings a student back from an approved leave and restores their record.",
    submitter: "The student on leave chooses a return semester, writes their intention and ticks the return checklist. The leave they are ending is filled in from their record.",
    reviewers: "Graduate School Staff verify each checklist item and forward the request; the Dean decides; the Academic Coordinator plans the subjects after approval.",
    stages: ["Submitted", "Staff review", "With the Dean", "Approved"],
    incomplete: "A request can be returned with a comment. The student corrects it and sends it again. Returning before the leave ends is an early return and is flagged for the Dean.",
    final: "Approval makes the student Active again at the stage they left, with the tag Not Enrolled until the Academic Coordinator enrolls them. The leave is closed.",
  },
  awol: {
    purpose: "Automatically flags evidence-backed AWOL standing, reviews return declarations, and tracks valid no-subject residency.",
    submitter: "A returning AWOL student completes a written return declaration; staff reviews alerts and may record policy-valid residency.",
    reviewers: "Graduate School Staff performs the policy review and routes return cases to the Dean.",
    stages: ["Automatic AWOL flag", "Return declaration", "Policy review", "Dean review", "Return or residency update"],
    incomplete: "Reviewers can message or return an AWOL case while its return declaration and audit trail remain visible.",
    final: "A decided return updates the student standing; residency remains a separate active, no-subject enrollment record.",
  },
  withdrawal: {
    purpose: "Withdraws a student from one enrolled subject until the end of the second week of classes (10% of the term is charged in the first week, 20% in the second), without changing program standing or unrelated classes.",
    submitter: "The student chooses an eligible enrolled subject and states the reason for withdrawing.",
    reviewers: "Graduate School Staff forwards the request; the Dean approves or denies; an approval returns to GS Staff for Excel export followed by manual Registrar email.",
    stages: ["Student submission", "GS Staff forwarding", "Dean approval or denial", "Subject removal", "Excel list export", "Manual email and acknowledgement outside the portal"],
    incomplete: "A Dean denial closes this subject request and leaves every enrollment unchanged. Messages and action comments remain in the case history.",
    final: "The portal ends at Excel export. GS Staff emails the file through the official channel and waits for Registrar acknowledgement outside the portal.",
  },
};

// Extras are small components that receive `ctx`:
//   { slug, role, isStaff, cases, data, reload(), openDetail(item), banner(tone, text), signal, clearSignal }
// and fill three fixed places on the page: next to the summary line (HeaderActions), just above
// the board (AboveBoard) and just below it (BelowBoard).
function LeaveHeaderActions({ ctx }) {
  const [syncing, setSyncing] = useState(false);
  if (!ctx.isStaff) return null;
  async function refreshDates() {
    setSyncing(true);
    try {
      const result = await api.syncLeaveCases();
      const summary = syncSummary(result);
      if (summary.changed) await ctx.reload();
      ctx.banner("success", summary.text);
    } catch (error) {
      ctx.banner("error", error.message || "The leave dates could not be checked.");
    } finally {
      setSyncing(false);
    }
  }
  return (
    <button type="button" onClick={refreshDates} disabled={syncing} className="btn-ghost px-4 py-2">
      <CalendarClock className="h-4 w-4" /> {syncing ? "Checking..." : "Refresh leave dates"}
    </button>
  );
}

function LeaveAboveBoard({ ctx }) {
  if (ctx.slug !== "leave-of-absence") return null;
  return <FollowUpStrip cases={ctx.cases} onOpen={ctx.openDetail} onRunAction={ctx.runAction} />;
}

function LeaveBelowBoard({ ctx }) {
  if (!ctx.isStaff) return null;
  return <RegistrarPanel slug={ctx.slug} cases={ctx.cases} onChanged={() => ctx.reload()} />;
}

function AwolHeaderActions({ ctx }) {
  const [open, setOpen] = useState(false);
  if (!["staff", "admin", "academic_coordinator"].includes(ctx.role)) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost px-4 py-2">
        <Plus className="h-4 w-4" /> Record residency
      </button>
      {open && (
        <ResidencyDialog
          reasons={ctx.data?.residency_reasons || []}
          onClose={() => setOpen(false)}
          onSaved={async (message) => {
            setOpen(false);
            await ctx.reload();
            ctx.banner("success", message);
          }}
        />
      )}
    </>
  );
}

// When the screen opens, let the server update any leave dates once, and load again only if
// something changed.
async function leaveAfterOpen({ isStaff, reload }) {
  if (!isStaff) return;
  try {
    const result = await api.syncLeaveCases();
    if (syncSummary(result).changed) await reload();
  } catch {
    // The dates are only a convenience here; the board still works without them.
  }
}

export const PROCESS_CONFIG = {
  "leave-of-absence": {
    title: "Leave of Absence",
    icon: CalendarOff,
    rulesProcess: "loa",
    description: "Record an LOA application and route the Dean decision. Time on leave still counts toward the maximum residence.",
    noun: "requests",
    boardLabel: "Leave of absence board",
    emptyTitle: "No leave requests yet",
    emptyHint: "Requests appear here as soon as a student files one.",
    nameBatches: true,
    afterOpen: leaveAfterOpen,
    HeaderActions: LeaveHeaderActions,
    AboveBoard: LeaveAboveBoard,
    BelowBoard: LeaveBelowBoard,
  },
  readmission: {
    title: "Readmission",
    icon: UserCheck,
    rulesProcess: "readmission",
    description: "Record a return request after LOA, route the Dean decision, and reactivate approved students.",
    noun: "requests",
    boardLabel: "Readmission board",
    emptyTitle: "No readmission requests yet",
    emptyHint: "Requests appear here as soon as a student files one.",
    nameBatches: true,
    afterOpen: leaveAfterOpen,
    HeaderActions: LeaveHeaderActions,
    BelowBoard: LeaveBelowBoard,
  },
  awol: {
    title: "AWOL & Residency",
    icon: UserX,
    rulesProcess: "awol_residency",
    description: "Automatically flag policy-backed AWOL cases, review structured return declarations, and record valid residency enrollment without subjects.",
    noun: "cases",
    boardLabel: "AWOL and residency board",
    emptyTitle: "No AWOL or residency cases yet",
    emptyHint: "AWOL is flagged from source records; residency appears here once staff record it.",
    HeaderActions: AwolHeaderActions,
    BelowBoard: AwolRegistrar,
  },
  withdrawal: {
    title: "Withdrawal Requests",
    icon: LogOut,
    rulesProcess: "withdrawal",
    description: "Withdraw a student from one subject until the end of the second week of classes, without changing program standing.",
    noun: "requests",
    boardLabel: "Subject withdrawal board",
    emptyTitle: "No withdrawal requests yet",
    emptyHint: "Requests appear here as soon as a student files one.",
    BelowBoard: WithdrawalExport,
  },
};

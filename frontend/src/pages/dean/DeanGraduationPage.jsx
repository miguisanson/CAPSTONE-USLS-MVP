import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { Button, PageHeader, StatusChip } from "../../components/ui/index.js";
import { DeanFeedback, DeanGate, useDean } from "./DeanContext";
import { DeanGraduationWorkspace } from "./DeanParts";
import { PAGE } from "../../lib/labels.js";

// Both tabs are the same shared board: "Roster & workflow" shows every candidate and batch, "Endorsement batches" only the
// batches. The Dean decides, exports and prints from a batch's View details window (one decision dialog on both).

const TABS = [
  { id: "roster", label: "Roster & workflow" },
  { id: "batches", label: "Endorsement batches" },
];

export function DeanGraduationPage() {
  return (
    <DeanGate>
      <DeanGraduationBody />
    </DeanGate>
  );
}

function DeanGraduationBody() {
  const [params, setParams] = useSearchParams();
  const { counts } = useDean();
  const tab = TABS.some((item) => item.id === params.get("tab")) ? params.get("tab") : "roster";
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title={PAGE.graduationEndorsement}
        description="The Academic Coordinator checks coursework, the Research Coordinator validates research evidence, and Graduate School staff prepare the endorsement list. You approve or return it, then export the approved list for the Registrar."
        icon={GraduationCap}
        badge={<StatusChip status={`${counts.pendingGraduation} waiting`} tone="muted" dot={false} />}
        actions={<Button as={Link} to="/dean/approvals" variant="secondary" icon={ArrowLeft}>All approvals</Button>}
      />
      <DeanFeedback />
      <div role="tablist" aria-label="Graduation views" className="flex flex-wrap gap-2 border-b border-slate-200">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setParams(item.id === "roster" ? {} : { tab: item.id }, { replace: true })}
            className={`-mb-px cursor-pointer border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${tab === item.id ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-brand-700"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <DeanGraduationWorkspace batchesOnly={tab === "batches"} />
    </div>
  );
}

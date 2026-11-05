import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { Button, PageHeader, StatusChip, Tabs } from "../../components/ui/index.js";
import { DeanFeedback, DeanGate, useDean } from "./DeanContext";
import { DeanGraduationWorkspace } from "./DeanParts";
import { PAGE } from "../../lib/labels.js";

// Both tabs are the same shared board: "Roster & workflow" shows every candidate and batch, "Endorsement batches" only the
// batches. The Dean decides, exports and prints from a batch's View details window (one decision dialog on both).

const TABS = [
  { key: "roster", label: "Roster & workflow" },
  { key: "batches", label: "Endorsement batches" },
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
  const tab = TABS.some((item) => item.key === params.get("tab")) ? params.get("tab") : "roster";
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title={PAGE.graduationEndorsement}
        description="The Academic Coordinator checks coursework, the Research Coordinator validates research evidence, and Graduate School staff prepare the endorsement list. You approve or return it, then export the approved list for the Registrar."
        forms="graduation"
        icon={GraduationCap}
        badge={<StatusChip status={`${counts.pendingGraduation} waiting`} tone="muted" dot={false} />}
        actions={<Button as={Link} to="/dean/approvals" variant="secondary" icon={ArrowLeft}>All approvals</Button>}
      />
      <DeanFeedback />
      <Tabs label="Graduation views" tabs={TABS} value={tab} onChange={(key) => setParams(key === "roster" ? {} : { tab: key }, { replace: true })} />
      <DeanGraduationWorkspace batchesOnly={tab === "batches"} />
    </div>
  );
}

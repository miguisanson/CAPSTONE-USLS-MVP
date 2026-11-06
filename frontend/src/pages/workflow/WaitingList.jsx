import { ClipboardList, Users } from "lucide-react";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { Button, Card, DataTable, SectionTitle } from "../../components/ui/index.js";

// I-064: Panel Matching and Defense Scheduling open on the students waiting at that step (the Research Gate rows whose
// next_step is this one), so nobody has to know a name first. Picking a row loads that student like the picker does.
const TITLES = { panel: "Waiting for a panel", schedule: "Waiting for a defense date" };
const EMPTY = { panel: "No student is waiting for a panel right now.", schedule: "No student is waiting for a defense date right now." };

export default function WaitingList({ step, onPick }) {
  const { data, loading } = useApi(() => api.researchGateOverview(), []);
  const rows = (data?.items || []).filter((row) => row.next_step === step);
  const columns = [
    { key: "name", header: "Student", sortValue: (row) => row.student.name, cell: (row) => <>{row.student.name}<span className="meta block">{row.student.program_code} · {row.student.student_number}</span></> },
    { key: "stage", header: "Stage" },
    { key: "research_title", header: "Research title", cell: (row) => row.research_title || "—" },
    { key: "pick", header: "", cell: (row) => <Button size="sm" variant="secondary" onClick={() => onPick(row.student)} aria-label={`Choose ${row.student.name}`}>Choose</Button> },
  ];
  return (
    <Card pad="lg">
      <SectionTitle title={TITLES[step]} subtitle="Students whose documents are in and whose next step is this one" icon={Users} />
      <DataTable
        caption={TITLES[step]}
        columns={columns}
        rows={rows}
        rowKey={(row) => row.student.id}
        stackOnPhone
        loading={loading && !data}
        empty={{ icon: ClipboardList, title: EMPTY[step] }}
      />
    </Card>
  );
}

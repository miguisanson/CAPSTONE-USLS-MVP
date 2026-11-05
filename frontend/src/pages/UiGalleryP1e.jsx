// Gallery block for packet P1e: PageHeader, StatCard, Stepper (and lib/stages.js). Rendered by UiGallery.jsx;
// asserted by e2e/ui-gallery-p1e.spec.js through the data-gallery / data-case / data-stat attributes.
import { CalendarDays, FileText, GraduationCap, Printer, ShieldAlert, Users } from "lucide-react";
import { Button, PageHeader, StatCard, StatusChip, Stepper } from "../components/ui/index.js";
import { DEFAULT_STAGES, stageSteps } from "../lib/stages";

function Group({ title, children }) {
  return (
    <div className="space-y-3">
      <h3 className="card-title">{title}</h3>
      {children}
    </div>
  );
}

const STATE_STEPS = [
  { label: "Submitted by student", state: "complete" },
  { label: "Adviser review", state: "returned", hint: "Needs a revised draft" },
  { label: "Dean review", state: "denied", hint: "Not approved" },
  { label: "Registrar preparation", state: "upcoming", optional: true },
];

const COMPACT_STEPS = [
  { label: "Filed", state: "complete" },
  { label: "In review", state: "current", hint: "Hint hidden in compact" },
  { label: "Decided", state: "upcoming" },
];

export default function UiGalleryP1e() {
  return (
    <section data-gallery="p1e" className="card space-y-6 p-4 sm:p-5">
      <h2 className="section-title">Page header, stat card and stepper (P1e)</h2>

      <Group title="PageHeader: long title, badge, three actions (level 2 here; a real page has the one h1)">
        <div className="rounded-xl border border-slate-200 p-4">
          <PageHeader
            level={2}
            data-case="header-long"
            icon={CalendarDays}
            title="Dissertation proposal defense scheduling and panel confirmation for the second semester"
            description="Pick a date, confirm the panel and send the notice to the student and the adviser."
            badge={<StatusChip status="Pending Review" />}
            actions={
              <>
                <Button variant="secondary" icon={Printer}>Print schedule</Button>
                <Button variant="secondary" icon={FileText}>Export list</Button>
                <Button icon={CalendarDays}>Schedule defense</Button>
              </>
            }
          />
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <PageHeader
            level={2}
            data-case="header-back"
            back={{ to: "/students", label: "Students" }}
            icon={GraduationCap}
            title="Maria Santos"
            description="MS Education, Comprehensive Exam"
          />
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <PageHeader level={2} data-case="header-min" title="Title only" />
        </div>
      </Group>

      <Group title="StatCard: md and sm, tones, link, badge, long text">
        <div data-case="stat-grid" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard data-stat="md" icon={Users} label="Active students" value="128" sub="12 new this term" to="/students" />
          <StatCard data-stat="sm" size="sm" icon={Users} label="Advisees" value="9" />
          <StatCard data-stat="tone-success" icon={GraduationCap} tone="success" label="On track" value="84" />
          <StatCard data-stat="tone-danger" icon={ShieldAlert} tone="danger" label="Delayed" value="7" sub="Needs action" />
          <StatCard data-stat="tone-legacy" icon={ShieldAlert} tone="amber" label="At risk" value="21" sub="Legacy tone name" />
          <StatCard data-stat="badge" icon={FileText} label="Standing" value="On Track" badge />
          <StatCard
            data-stat="long"
            icon={FileText}
            label="Students waiting for the dean's endorsement of the revised proposal"
            value="12,345,678,901,234,567,890"
            sub="A very long figure and label must wrap inside the tile"
          />
        </div>
      </Group>

      <Group title="Stepper: student lifecycle (Proposal Defense) - a wrapping row from sm up, vertical at 390">
        <Stepper data-case="stepper-lifecycle" steps={stageSteps("Proposal Defense", DEFAULT_STAGES)} />
      </Group>

      <Group title="Stepper: returned, denied, optional, hint; and compact">
        <Stepper data-case="stepper-states" steps={STATE_STEPS} />
        <Stepper data-case="stepper-compact" compact steps={COMPACT_STEPS} />
      </Group>

      <Group title="Stepper: off-track stages are a stopped chip (LOA, AWOL); Completed finishes every step">
        <Stepper data-case="stepper-offtrack" title="Student lifecycle" steps={stageSteps("LOA", DEFAULT_STAGES)} />
        <Stepper data-case="stepper-awol" steps={stageSteps("AWOL", DEFAULT_STAGES)} />
        <Stepper data-case="stepper-completed" steps={stageSteps("Completed", DEFAULT_STAGES)} />
      </Group>
    </section>
  );
}

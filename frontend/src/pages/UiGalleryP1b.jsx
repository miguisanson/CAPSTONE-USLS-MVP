// Gallery block for packet P1b: StatusChip, Button, Card / SectionCard, Field / Input / Select / Textarea.
// Rendered by UiGallery.jsx; asserted by e2e/ui-gallery-p1b.spec.js through the data-gallery / data-case attributes.
import { useSearchParams } from "react-router-dom";
import { Pencil, Search, Trash2 } from "lucide-react";
import { Button, Card, SectionCard, StatusChip, Field, Input, Select, Textarea } from "../components/ui/index.js";

function Group({ title, children }) {
  return (
    <div className="space-y-3">
      <h3 className="card-title">{title}</h3>
      {children}
    </div>
  );
}

// The invalid-field example carries role="alert", which the shared sweep rules count as an error banner on any page.
// So it only mounts on /__ui?field-error=1 (e2e/ui-gallery-p1b.spec.js opens that URL); plain /__ui stays banner-free.
export default function UiGalleryP1b() {
  const [params] = useSearchParams();
  const showError = params.get("field-error") === "1";
  return (
    <section data-gallery="p1b" className="card space-y-6 p-4 sm:p-5">
      <h2 className="section-title">Status chip, buttons, cards and fields (P1b)</h2>

      <Group title="StatusChip: one chip per tone, two sizes">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip data-case="chip-approved" status="Approved" />
          <StatusChip data-case="chip-returned" status="Returned for Revision" />
          <StatusChip data-case="chip-denied" status="Denied" />
          <StatusChip data-case="chip-submitted" status="Submitted" />
          <StatusChip data-case="chip-notstarted" status="Not Started" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip data-case="chip-sm-approved" status="Approved" size="sm" />
          <StatusChip data-case="chip-nodot" status="Approved" dot={false} />
          <StatusChip data-case="chip-server-warn" status="Waiting on the registrar" tone="warn" />
          <StatusChip data-case="chip-unmapped" status="Unmapped status" />
          <StatusChip data-case="chip-label" status="Approved" label="Approved by Dean" />
          <StatusChip data-case="chip-long" status="Not Accepted - New Organization Required" />
          <StatusChip data-case="chip-empty" status="" />
        </div>
      </Group>

      <Group title="Button: variants and sizes">
        <div className="flex flex-wrap items-center gap-2">
          <Button data-case="btn-primary-md">Primary</Button>
          <Button variant="secondary" data-case="btn-secondary-md">Secondary</Button>
          <Button variant="danger" data-case="btn-danger-md">Danger</Button>
          <Button variant="icon" icon={Search} aria-label="Search" data-case="btn-icon" />
          <Button variant="icon" icon={Trash2} aria-label="Delete" className="text-red-600" data-case="btn-icon-danger" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" data-case="btn-primary-sm">Primary small</Button>
          <Button size="sm" variant="secondary" data-case="btn-secondary-sm">Secondary small</Button>
          <Button size="sm" variant="danger" data-case="btn-danger-sm">Danger small</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button icon={Pencil} variant="secondary" data-case="btn-icon-text">With icon</Button>
          <Button loading data-case="btn-loading">Saving</Button>
          <Button disabled data-case="btn-disabled">Disabled</Button>
          <Button as="a" href="#p1b-link" data-case="btn-link">As a link</Button>
          <Button data-case="btn-plain" onClick={() => {}}>Plain click</Button>
        </div>
      </Group>

      <Group title="Card: padding steps and SectionCard">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card data-case="card-md"><p className="text-sm">pad md (default)</p></Card>
          <Card pad="sm" data-case="card-sm"><p className="text-sm">pad sm</p></Card>
          <Card pad="lg" data-case="card-lg"><p className="text-sm">pad lg</p></Card>
          <Card pad="none" data-case="card-none"><p className="text-sm">pad none</p></Card>
        </div>
        <Card interactive data-case="card-interactive"><p className="text-sm">interactive card</p></Card>
        <SectionCard
          data-case="section-card"
          title="Section card title"
          subtitle="Section card subtitle"
          icon={Pencil}
          action={<Button size="sm" variant="secondary">Card action</Button>}
        >
          <p className="text-sm text-slate-700">Section card body</p>
        </SectionCard>
      </Group>

      <Group title="Field, Input, Select, Textarea">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" hint="As on the enrollment form" required>
            <Input placeholder="Maria Santos" />
          </Field>
          {showError && (
            <Field label="Email address" error="Enter a valid email address.">
              <Input defaultValue="maria@" />
            </Field>
          )}
          <Field label="Program">
            <Select options={["MAEd", "MBA", "PhD"]} defaultValue="" />
          </Field>
          <Field label="Notes">
            <Textarea placeholder="Anything the adviser should know" />
          </Field>
        </div>
      </Group>
    </section>
  );
}

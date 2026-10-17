// Gallery block for packet P1d: DataTable and the Feedback set (EmptyState, Spinner, Skeleton, InlineNotice,
// SearchInput, Pagination). Rendered by UiGallery.jsx; asserted by e2e/ui-gallery-p1d.spec.js through data-case.
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Inbox, Users } from "lucide-react";
import { Button, DataTable, EmptyState, InlineNotice, Pagination, SearchInput, Skeleton, Spinner, StatusChip } from "../components/ui/index.js";

function Group({ title, children }) {
  return (
    <div className="space-y-3">
      <h3 className="card-title">{title}</h3>
      {children}
    </div>
  );
}

const PROGRAMS = ["MIT", "MBA", "MAEd", "MPA"];
const STAGES = ["Admission", "Coursework", "Research Proposal", "Final Defense"];
const STATUSES = ["On Track", "At Risk of Delay", "Delayed", "Not Yet Assessed"];
const pad = (n) => String(n).padStart(2, "0");

// 30 deterministic students, 8 columns; Units cycles 1..11 so a sort visibly reorders the rows.
const STUDENTS = Array.from({ length: 30 }, (_, k) => {
  const i = k + 1;
  return {
    id: i,
    name: `Student ${pad(i)}`,
    number: `2026-${String(1000 + i * 7)}`,
    program: PROGRAMS[k % 4],
    stage: STAGES[k % 4 === 3 ? 2 : k % 4],
    status: STATUSES[k % 4],
    units: ((i * 7) % 11) + 1,
    updated: `2026-0${(k % 9) + 1}-1${k % 9}`,
    adviser: `Prof. ${["Reyes", "Santos", "Cruz", "Lim", "Tan"][k % 5]}`,
  };
});

const STUDENT_COLUMNS = [
  { key: "name", header: "Student", sortable: true, cell: (r) => <span className="font-semibold text-ink">{r.name}</span> },
  { key: "number", header: "Number", sortable: true },
  { key: "program", header: "Program", sortable: true },
  { key: "stage", header: "Stage" },
  { key: "status", header: "Status", sortable: true, cell: (r) => <StatusChip status={r.status} size="sm" />, sortValue: (r) => r.status },
  { key: "units", header: "Units", sortable: true, align: "right" },
  { key: "updated", header: "Updated" },
  { key: "adviser", header: "Adviser", hideBelow: "lg" },
];

const SERVER_ROWS = Array.from({ length: 12 }, (_, k) => ({ id: k + 1, name: `Server row ${pad(k + 1)}`, note: `Page data ${k + 1}` }));
const SERVER_SIZE = 5;

function ServerTable() {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(null);
  const [log, setLog] = useState("none");
  const rows = useMemo(() => {
    const list = sort ? [...SERVER_ROWS].sort((a, b) => a.name.localeCompare(b.name) * (sort.dir === "desc" ? -1 : 1)) : SERVER_ROWS;
    return list.slice((page - 1) * SERVER_SIZE, page * SERVER_SIZE);
  }, [page, sort]);
  return (
    <>
      <DataTable
        data-case="table-server"
        caption="Server paged rows"
        columns={[
          { key: "name", header: "Name", sortable: true },
          { key: "note", header: "Note" },
        ]}
        rows={rows}
        sort={sort}
        onSort={(key, dir) => {
          setSort(dir ? { key, dir } : null);
          setLog(dir ? `${key} ${dir}` : "none");
        }}
        pagination={{ page, pageCount: Math.ceil(SERVER_ROWS.length / SERVER_SIZE), total: SERVER_ROWS.length, pageSize: SERVER_SIZE, onPage: setPage }}
      />
      <p className="meta" data-case="server-sort-log">sort: {log}</p>
    </>
  );
}

function ClickTable() {
  const [opened, setOpened] = useState("nothing");
  const data = [{ id: "a", name: "Row A" }, { id: "b", name: "Row B" }, { id: "c", name: "Row C" }];
  return (
    <>
      <DataTable
        data-case="table-click"
        caption="Rows that open on click"
        columns={[
          { key: "name", header: "Name", cell: (r) => <a href={`#${r.id}`} className="font-semibold text-ink hover:text-brand-700" onClick={(e) => e.preventDefault()}>{r.name}</a> },
          { key: "id", header: "Id" },
        ]}
        rows={data}
        onRowClick={(r) => setOpened(r.name)}
      />
      <p className="meta" data-case="click-log">opened: {opened}</p>
    </>
  );
}

function NoticeDemo({ showDanger }) {
  const [dismissed, setDismissed] = useState(false);
  return (
    <div className="space-y-2">
      <InlineNotice data-case="notice-info" tone="info">Info: your request was received and is waiting for staff.</InlineNotice>
      <InlineNotice data-case="notice-success" tone="success">Success: the schedule was saved.</InlineNotice>
      <InlineNotice data-case="notice-warning" tone="warning">Warning: two panel members have not confirmed.</InlineNotice>
      <InlineNotice data-case="notice-legacy-warn" tone="warn">Legacy tone warn still renders as a warning.</InlineNotice>
      <InlineNotice data-case="notice-titled" tone="info" icon title="Saved to the audit log">
        Every change to an official value is stamped with who made it and why.
      </InlineNotice>
      {!dismissed && (
        <InlineNotice data-case="notice-dismiss" tone="neutral" onDismiss={() => setDismissed(true)}>
          Neutral notice with a close button.
        </InlineNotice>
      )}
      {showDanger && (
        <>
          <InlineNotice data-case="notice-danger" tone="danger" title="P1d danger sample">
            Could not load students. Check your connection and try again.
          </InlineNotice>
          <InlineNotice data-case="notice-error" tone="error">P1d legacy error sample</InlineNotice>
        </>
      )}
    </div>
  );
}

// The danger examples carry role="alert", which the shared sweep rules count as an error banner on any page.
// So they only mount on /__ui?notice-danger=1 (e2e/ui-gallery-p1d.spec.js opens that URL); plain /__ui stays banner-free.
export default function UiGalleryP1d() {
  const [params] = useSearchParams();
  const showDanger = params.get("notice-danger") === "1";
  const [q, setQ] = useState("");
  const [page, setPage] = useState(3);
  return (
    <section data-gallery="p1d" className="card space-y-6 p-4 sm:p-5">
      <h2 className="section-title">Data table and feedback (P1d)</h2>

      <Group title="DataTable: 30 rows, 8 columns, search, sort, 10 per page, CSV">
        <DataTable
          data-case="table-main"
          caption="Students table with thirty rows"
          columns={STUDENT_COLUMNS}
          rows={STUDENTS}
          minWidth="lg"
          stickyHeader
          searchable={{ label: "Search students", placeholder: "Search students…" }}
          csv={{ filename: "gallery-students.csv" }}
          empty={{ icon: Users, title: "No students to show" }}
        />
      </Group>

      <Group title="DataTable: empty, loading, server paging, clickable rows">
        <DataTable
          data-case="table-empty"
          caption="Empty students table"
          columns={STUDENT_COLUMNS.slice(0, 3)}
          rows={[]}
          empty={{ icon: Users, title: "No students to show", hint: "Students will see items here once they are admitted." }}
        />
        <DataTable data-case="table-loading" caption="Loading students" columns={STUDENT_COLUMNS.slice(0, 3)} rows={[]} loading />
        <ServerTable />
        <ClickTable />
      </Group>

      <Group title="InlineNotice: info is blue, success is green">
        <NoticeDemo showDanger={showDanger} />
      </Group>

      <Group title="Spinner and Skeleton">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200" data-case="spinner"><Spinner /></div>
          <div className="rounded-xl border border-slate-200" data-case="spinner-sm"><Spinner size="sm" /></div>
          <div className="rounded-xl border border-slate-200" data-case="spinner-custom"><Spinner size="sm" label="Checking the roster…" /></div>
          <div className="rounded-xl border border-slate-200 p-4"><Skeleton data-case="skeleton" lines={4} /></div>
        </div>
      </Group>

      <Group title="EmptyState, SearchInput and Pagination">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200" data-case="empty-state">
            <EmptyState
              icon={Inbox}
              title="No requests to show"
              hint="Requests will appear here once a student submits one."
              action={<Button variant="secondary" size="sm">Refresh</Button>}
            />
          </div>
          <div className="rounded-xl border border-slate-200" data-case="empty-state-sm">
            <EmptyState size="sm" icon={Inbox} title="No requests to show" hint="Requests will appear here once a student submits one." />
          </div>
        </div>
        <div data-case="search" className="max-w-sm">
          <SearchInput label="Search the roster" placeholder="Search the roster…" value={q} onChange={setQ} />
        </div>
        <p className="meta" data-case="search-value">value: {q}</p>
        <div data-case="pagination">
          <Pagination page={page} pageCount={10} total={95} pageSize={10} onPage={setPage} />
        </div>
      </Group>
    </section>
  );
}

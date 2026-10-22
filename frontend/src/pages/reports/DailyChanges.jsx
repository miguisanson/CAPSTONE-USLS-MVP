// The Registrar's daily list (moved out of Reports.jsx unchanged): every change made in this system on one date that the
// Registrar must apply in AIMS, with CSV and Print, and "Mark as sent" per change.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckSquare, Download, FileText, Printer, RefreshCw, Square } from "lucide-react";
import { api } from "../../api";
import { Button, DataTable, InlineNotice, Input, SectionCard, Spinner, StatCard, StatusChip } from "../../components/ui/index.js";
import { csvCell, downloadBlob } from "../../lib/format";
import { printDataTable } from "../../lib/print";

function downloadCsv(filename, lines) {
  downloadBlob(new Blob([lines.join("\n")], { type: "text/csv" }), filename);
}

function todayISO() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function changeText(item) {
  if (item.previous_status && item.new_status && item.previous_status !== item.new_status) {
    return `${item.detail} (${item.previous_status} → ${item.new_status})`;
  }
  return item.detail;
}

export default function DailyChanges() {
  const [date, setDate] = useState(todayISO());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function load(targetDate) {
    setLoading(true);
    setError("");
    try {
      const res = await api.dailyChanges(targetDate);
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function toggleReflected(item) {
    setBusyId(item.id);
    try {
      const next = !item.reflected_in_aims;
      await api.markChangeReflected(item.id, next);
      setData((current) => ({
        ...current,
        items: current.items.map((row) => (row.id === item.id ? { ...row, reflected_in_aims: next } : row)),
        summary: {
          ...current.summary,
          reflected: current.summary.reflected + (next ? 1 : -1),
          pending: current.summary.pending + (next ? -1 : 1),
        },
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const items = data?.items || [];
  const summary = data?.summary || { total: 0, reflected: 0, pending: 0 };

  function exportChangesCsv() {
    const headers = ["Time", "Change type", "Student", "Student No", "Program", "Change", "By", "Sent to Registrar"];
    const lines = [headers.join(",")];
    items.forEach((item) => {
      lines.push([
        item.time, item.change_type, item.student_name, item.student_number,
        item.program_code, changeText(item), item.actor, item.reflected_in_aims ? "Yes" : "No",
      ].map(csvCell).join(","));
    });
    downloadCsv(`daily-changes-${date}.csv`, lines);
  }

  function printChanges() {
    printDataTable({
      title: "Daily changes list",
      subtitle: `Date: ${date}`,
      columns: ["Time", "Change type", "Student", "Student No", "Program", "Change", "By", "Sent"],
      rows: items.map((item) => [
        item.time ? new Date(item.time).toLocaleTimeString() : "",
        item.change_type, item.student_name, item.student_number, item.program_code,
        changeText(item), item.actor, item.reflected_in_aims ? "Yes" : "No",
      ]),
    });
  }

  const columns = [
    {
      key: "time",
      header: "Time",
      cell: (item) => <span className="whitespace-nowrap text-slate-500">{item.time ? new Date(item.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</span>,
    },
    { key: "type", header: "Change type", cell: (item) => <StatusChip status={item.change_type} dot={false} /> },
    {
      key: "student",
      header: "Student",
      cell: (item) => (
        <>
          <Link to={`/students/${item.student_id}`} className="font-semibold text-brand-700 hover:underline">{item.student_name}</Link>
          <p className="meta">{item.student_number} · {item.program_code}</p>
        </>
      ),
    },
    { key: "change", header: "Change", cell: (item) => changeText(item) },
    { key: "by", header: "By", cell: (item) => <span className="text-slate-500">{item.actor}</span> },
    {
      key: "sent",
      header: "Sent to Registrar",
      align: "right",
      cell: (item) => (
        <Button
          size="sm"
          variant="secondary"
          icon={item.reflected_in_aims ? CheckSquare : Square}
          disabled={busyId === item.id}
          onClick={() => toggleReflected(item)}
          className={`whitespace-nowrap ${item.reflected_in_aims ? "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100" : ""}`}
        >
          {item.reflected_in_aims ? "Sent" : "Mark as sent"}
        </Button>
      ),
    },
  ];

  return (
    <SectionCard
      title="Daily changes"
      subtitle="Every change made in this system on the selected date. Export or print the list for the Registrar, then mark each change as sent."
      icon={RefreshCw}
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="max-w-44" aria-label="Change report date" />
          <Button variant="secondary" icon={Download} onClick={exportChangesCsv} disabled={!items.length}>CSV</Button>
          <Button variant="secondary" icon={Printer} onClick={printChanges} disabled={!items.length}>Print</Button>
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-3">
        <StatCard tone="neutral" label="Changes today" value={summary.total} />
        <StatCard tone="success" label="Sent to Registrar" value={summary.reflected} />
        <StatCard tone="warning" label="Not yet sent" value={summary.pending} />
      </div>

      {error && <InlineNotice tone="danger">{error}</InlineNotice>}

      {loading ? (
        <Spinner label="Loading changes…" />
      ) : (
        <DataTable
          caption="Changes recorded on the selected date"
          columns={columns}
          rows={items}
          rowKey="id"
          minWidth="md"
          pageSize={0}
          empty={{
            icon: FileText,
            title: "No changes on this date",
            hint: "Pick another date, or make changes in Enrollment, Withdrawal, or the standing-change workflows.",
          }}
        />
      )}
    </SectionCard>
  );
}

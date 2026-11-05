// "Export CSV" and "Print" for the list on screen: the same two buttons and words the other lists use (DataTable, Daily changes).
import { Download, Printer } from "lucide-react";
import { Button } from "./ui/index.js";
import { csvCell, downloadBlob, todayISO } from "../lib/format";
import { printDataTable } from "../lib/print";

/** @param columns header texts; @param rows arrays of plain text, one per column; @param filename without date or ".csv" */
export default function ListExportButtons({ title, subtitle = "", filename, columns, rows }) {
  function exportCsv() {
    const lines = [columns, ...rows].map((line) => line.map(csvCell).join(","));
    downloadBlob(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), `${filename}-${todayISO()}.csv`);
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" icon={Download} onClick={exportCsv} disabled={!rows.length}>Export CSV</Button>
      <Button variant="secondary" size="sm" icon={Printer} onClick={() => printDataTable({ title, subtitle, columns, rows })} disabled={!rows.length}>Print</Button>
    </div>
  );
}

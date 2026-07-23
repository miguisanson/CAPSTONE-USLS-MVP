import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = path.join(process.cwd(), "outputs", "class-list-demo-miguel-sanson");
const outputPath = path.join(outputDir, "MAED_Class_List_Demo_Miguel_Sanson.xlsx");
await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const classList = workbook.worksheets.add("Class List");
const guide = workbook.worksheets.add("Demo Guide");

classList.showGridLines = false;
classList.getRange("A1:G3").values = [
  ["STUDENT ID", "FIRST NAME", "LAST NAME", "PROGRAM", "SUBJECT CODE", "FACULTY", "TEST CASE"],
  ["2670001", "Miguel", "Sanson", "MAED", "MAED-MAJ1", "Dr. Liwayway Bautista", "Valid enrollment"],
  ["2460009", "Maria", "Dela Cruz", "MAED", "MAED-MAJ1", "Dr. Liwayway Bautista", "Already completed — should be rejected"],
];
classList.getRange("A1:G1").format = {
  fill: "#1F7A46",
  font: { bold: true, color: "#FFFFFF" },
  rowHeight: 26,
};
classList.getRange("A2:G3").format = {
  fill: "#FFFFFF",
  font: { color: "#172033" },
  borders: {
    insideHorizontal: { style: "thin", color: "#DDE5E0" },
    bottom: { style: "thin", color: "#DDE5E0" },
  },
  rowHeight: 24,
};
classList.getRange("A3:G3").format.fill = "#FFF7E6";
classList.getRange("A1:A3").format.numberFormat = "@";
classList.getRange("A1:A3").format.columnWidth = 17;
classList.getRange("B1:C3").format.columnWidth = 18;
classList.getRange("D1:D3").format.columnWidth = 13;
classList.getRange("E1:E3").format.columnWidth = 18;
classList.getRange("F1:F3").format.columnWidth = 27;
classList.getRange("G1:G3").format.columnWidth = 38;
classList.freezePanes.freezeRows(1);
const importTable = classList.tables.add("A1:G3", true, "DemoClassList");
importTable.style = "TableStyleMedium4";
importTable.showBandedRows = true;

guide.showGridLines = false;
guide.getRange("A1:D1").merge();
guide.getRange("A1:D1").values = [["MAED Class List Import Demo"]];
guide.getRange("A1:D1").format = {
  fill: "#1F7A46",
  font: { bold: true, color: "#FFFFFF", fontSize: 16 },
  rowHeight: 34,
  horizontalAlignment: "left",
  verticalAlignment: "center",
};
guide.getRange("A3:B8").values = [
  ["Setting", "Value"],
  ["Semester to select", "AY 2026-2027 1st Semester"],
  ["Official offering", "MAED-MAJ1"],
  ["Assigned faculty", "Dr. Liwayway Bautista"],
  ["Valid row", "2670001 · Miguel Sanson"],
  ["Negative-test row", "2460009 · Maria Dela Cruz"],
];
guide.getRange("A3:B3").format = {
  fill: "#E8F4ED",
  font: { bold: true, color: "#14532D" },
};
guide.getRange("A4:A8").format.font = { bold: true, color: "#475569" };
guide.getRange("A3:B8").format.borders = {
  insideHorizontal: { style: "thin", color: "#DDE5E0" },
  bottom: { style: "thin", color: "#DDE5E0" },
};
guide.getRange("A10:D10").merge();
guide.getRange("A10:D10").values = [["Expected demo behavior"]];
guide.getRange("A10:D10").format = {
  fill: "#E8F4ED",
  font: { bold: true, color: "#14532D" },
  rowHeight: 25,
};
guide.getRange("A11:D13").merge(true);
guide.getRange("A11:D13").values = [
  ["1. Miguel Sanson should be enrolled in MAED-MAJ1."],
  ["2. Maria Dela Cruz already has MAED-MAJ1 marked Completed, so the import should reject or flag her row."],
  ["3. If Maria is changed back to Enrolled, the completed-subject validation is missing and the result should be treated as a defect."],
];
guide.getRange("A11:D13").format = {
  fill: "#FFFFFF",
  font: { color: "#334155" },
  wrapText: true,
  rowHeight: 34,
  borders: {
    insideHorizontal: { style: "thin", color: "#E2E8F0" },
    bottom: { style: "thin", color: "#E2E8F0" },
  },
};
guide.getRange("A15:D15").merge();
guide.getRange("A15:D15").values = [["Upload the “Class List” sheet through Enrollment → Upload class list. Faculty is already assigned to the official offering; the importer reads Student ID and Subject Code from this file."]];
guide.getRange("A15:D15").format = {
  fill: "#FFF7E6",
  font: { color: "#92400E", italic: true },
  wrapText: true,
  rowHeight: 42,
};
guide.getRange("A1:A15").format.columnWidth = 24;
guide.getRange("B1:B15").format.columnWidth = 42;
guide.getRange("C1:D15").format.columnWidth = 24;

const exported = await SpreadsheetFile.exportXlsx(workbook);
await exported.save(outputPath);
const savedWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath));

const classListPreview = await savedWorkbook.render({
  sheetName: "Class List",
  autoCrop: "all",
  scale: 2,
  format: "png",
});
await fs.writeFile(
  path.join(outputDir, "class-list-preview.png"),
  new Uint8Array(await classListPreview.arrayBuffer()),
);

const guidePreview = await savedWorkbook.render({
  sheetName: "Demo Guide",
  autoCrop: "all",
  scale: 2,
  format: "png",
});
await fs.writeFile(
  path.join(outputDir, "demo-guide-preview.png"),
  new Uint8Array(await guidePreview.arrayBuffer()),
);

console.log(
  (
    await savedWorkbook.inspect({
      kind: "region,formula",
      sheetId: "Class List",
      range: "A1:G3",
      maxChars: 5000,
      tableMaxRows: 10,
      tableMaxCols: 8,
    })
  ).ndjson,
);
console.log(
  (
    await savedWorkbook.inspect({
      kind: "match",
      searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
      options: { useRegex: true, maxResults: 100 },
      summary: "final formula error scan",
      maxChars: 2000,
    })
  ).ndjson,
);
console.log(JSON.stringify({ outputPath }));

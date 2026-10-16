import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const workDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const repoDir = path.resolve(workDir, "..", "..");
const inputPath = path.join(
  repoDir,
  "Documents",
  "Class_Lists",
  "MAED_Class_List_Demo_MAJ2_3_Students.xlsx",
);
const outputPath = path.join(workDir, "DBA_Class_List_Demo_MAJ3_4_Students.xlsx");

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));

if (process.argv.includes("--inspect-template")) {
  const sheets = await workbook.inspect({
    kind: "workbook,sheet,table,drawing",
    maxChars: 7000,
    tableMaxRows: 12,
    tableMaxCols: 10,
  });
  console.log(sheets.ndjson);
  for (const sheet of ["Class List", "Demo Guide"]) {
    try {
      const region = await workbook.inspect({
        kind: "region,formula,computedStyle",
        sheetId: sheet,
        range: "A1:H25",
        maxChars: 10000,
        tableMaxRows: 25,
        tableMaxCols: 10,
      });
      console.log(region.ndjson);
      const preview = await workbook.render({
        sheetName: sheet,
        autoCrop: "all",
        scale: 2,
        format: "png",
      });
      await fs.writeFile(
        path.join(workDir, `template-${sheet.toLowerCase().replaceAll(" ", "-")}.png`),
        new Uint8Array(await preview.arrayBuffer()),
      );
    } catch {
      // The source may use different sheet names; the workbook-level scan shows them.
    }
  }
  process.exit(0);
}

const classList = workbook.worksheets.getItem("Class List");
const guide = workbook.worksheets.getItem("Demo Guide");

classList.getRange("A2:G5").values = [
  ["2460058", "Lara", "Flores", "DBA", "DBA-MAJ3", "Dr. Angela Cruz", "Eligible — subject is Missing"],
  ["2560052", "Bianca", "Mendoza", "DBA", "DBA-MAJ3", "Dr. Angela Cruz", "Eligible — prior status is Dropped"],
  ["2560057", "Rafael", "Dizon", "DBA", "DBA-MAJ3", "Dr. Angela Cruz", "Eligible — subject is Missing"],
  ["2699999", "Noelle", "Villanueva", "DBA", "DBA-MAJ3", "Dr. Angela Cruz", "Conflict — new student not in database"],
];

// Preserve the template's first data-row style and extend it to four rows.
for (const row of [3, 4, 5]) {
  classList.getRange(`A2:G2`).copyTo(classList.getRange(`A${row}:G${row}`), "all");
}
// Restore values after style copies.
classList.getRange("A2:G5").values = [
  ["2460058", "Lara", "Flores", "DBA", "DBA-MAJ3", "Dr. Angela Cruz", "Eligible — subject is Missing"],
  ["2560052", "Bianca", "Mendoza", "DBA", "DBA-MAJ3", "Dr. Angela Cruz", "Eligible — prior status is Dropped"],
  ["2560057", "Rafael", "Dizon", "DBA", "DBA-MAJ3", "Dr. Angela Cruz", "Eligible — subject is Missing"],
  ["2699999", "Noelle", "Villanueva", "DBA", "DBA-MAJ3", "Dr. Angela Cruz", "Conflict — new student not in database"],
];
classList.getRange("A5:G5").format.fill = "#FFF7E6";

const existingTables = classList.tables.items;
for (const table of existingTables) table.delete();
const table = classList.tables.add("A1:G5", true, "DBAClassList");
table.style = "TableStyleMedium4";
table.showBandedRows = true;

guide.getRange("A1:D1").values = [["DBA Class List Import Demo"]];
guide.getRange("A3:B8").values = [
  ["Setting", "Value"],
  ["Semester to select", "AY 2026-2027 1st Semester"],
  ["Official offering", "DBA-MAJ3"],
  ["Assigned faculty", "Dr. Angela Cruz"],
  ["Eligible database rows", "2460058 · Lara Flores; 2560052 · Bianca Mendoza; 2560057 · Rafael Dizon"],
  ["Conflict row", "2699999 · Noelle Villanueva (not in database)"],
];
guide.getRange("A10:D10").values = [["Expected demo behavior"]];
guide.getRange("A11:D14").unmerge();
guide.getRange("A11:D14").merge(true);
guide.getRange("A11:D14").values = [
  ["1. Lara Flores should be ready because DBA-MAJ3 is marked Missing."],
  ["2. Bianca Mendoza should be ready because her previous DBA-MAJ3 status is Dropped."],
  ["3. Rafael Dizon should be ready because DBA-MAJ3 is marked Missing."],
  ["4. Noelle Villanueva should be flagged: Student was not found."],
];
guide.getRange("A11:D14").format = {
  fill: "#FFFFFF",
  font: { color: "#334155" },
  wrapText: true,
  rowHeight: 34,
  borders: {
    insideHorizontal: { style: "thin", color: "#E2E8F0" },
    bottom: { style: "thin", color: "#E2E8F0" },
  },
};
guide.getRange("A15:D15").values = [[
  "Upload the “Class List” sheet through Enrollment → Upload class list. The three database students should pass preview validation; the new student row is the intentional conflict.",
]];

const exported = await SpreadsheetFile.exportXlsx(workbook);
await exported.save(outputPath);

const saved = await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath));
for (const sheet of ["Class List", "Demo Guide"]) {
  const preview = await saved.render({
    sheetName: sheet,
    autoCrop: "all",
    scale: 2,
    format: "png",
  });
  await fs.writeFile(
    path.join(workDir, `${sheet.toLowerCase().replaceAll(" ", "-")}-preview.png`),
    new Uint8Array(await preview.arrayBuffer()),
  );
}

console.log((await saved.inspect({
  kind: "region,formula",
  sheetId: "Class List",
  range: "A1:G5",
  maxChars: 6000,
  tableMaxRows: 10,
  tableMaxCols: 8,
})).ndjson);
console.log((await saved.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
  maxChars: 2000,
})).ndjson);
console.log(JSON.stringify({ outputPath }));

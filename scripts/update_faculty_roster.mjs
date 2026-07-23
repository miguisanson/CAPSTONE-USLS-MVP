import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const projectRoot = process.cwd();
const sourcePath = path.join(projectRoot, "Documents", "Faculty_Sheet", "Faculty_Roster.xlsx");
const outputDir = path.join(projectRoot, "outputs", "faculty-roster-dba");
const outputPath = path.join(outputDir, "Faculty_Roster.xlsx");
const previewPath = path.join(outputDir, "Faculty_Roster.png");

await fs.mkdir(outputDir, { recursive: true });

const input = await FileBlob.load(sourcePath);
const workbook = await SpreadsheetFile.importXlsx(input);
const sheetInfo = await workbook.inspect({
  kind: "sheet",
  include: "id,name",
  maxChars: 2000,
});
console.log(sheetInfo.ndjson);

const sheet = workbook.worksheets.getItemAt(0);
const usedRange = sheet.getUsedRange();
console.log(
  (
    await workbook.inspect({
      kind: "region,computedStyle",
      sheetId: sheet.name,
      range: usedRange.address,
      maxChars: 8000,
      tableMaxRows: 20,
      tableMaxCols: 8,
      tableMaxCellChars: 120,
    })
  ).ndjson,
);

let renderWorkbook = workbook;
if (!process.argv.includes("--inspect")) {
  const newFaculty = [
    [
      "Dr. Angela Cruz",
      "Business",
      "Adviser / Panel",
      "angela.cruz@usls.edu.ph",
      "Strategic management, entrepreneurship, organizational innovation, and family business",
    ],
    [
      "Dr. Marco Villanueva",
      "Business",
      "Adviser / Panel",
      "marco.villanueva@usls.edu.ph",
      "Operations management, supply chain analytics, quality systems, and process improvement",
    ],
    [
      "Dr. Teresa Lim",
      "Business",
      "Adviser / Panel",
      "teresa.lim@usls.edu.ph",
      "Marketing strategy, consumer behavior, digital commerce, and brand analytics",
    ],
    [
      "Dr. Paolo Navarro",
      "Business",
      "Adviser / Panel",
      "paolo.navarro@usls.edu.ph",
      "Human resource management, organizational behavior, leadership, and workplace research",
    ],
  ];

  const target = sheet.getRange("A10:E13");
  const styleSource = sheet.getRange("A6:E9");
  target.copyFrom(styleSource, "all");
  target.values = newFaculty;
  target.format.wrapText = true;
  target.format.rowHeight = 34;

  const finalRange = sheet.getRange("A1:E13");
  sheet.getRange("A1:A13").format.columnWidth = 28;
  sheet.getRange("B1:B13").format.columnWidth = 29;
  sheet.getRange("C1:C13").format.columnWidth = 22;
  sheet.getRange("D1:D13").format.columnWidth = 37;
  sheet.getRange("E1:E13").format.columnWidth = 72;

  const xlsx = await SpreadsheetFile.exportXlsx(workbook);
  await xlsx.save(outputPath);

  const savedInput = await FileBlob.load(outputPath);
  renderWorkbook = await SpreadsheetFile.importXlsx(savedInput);
  console.log(
    (
      await renderWorkbook.inspect({
        kind: "region,formula",
        sheetId: sheet.name,
        range: "A1:E13",
        maxChars: 8000,
        tableMaxRows: 20,
        tableMaxCols: 8,
        tableMaxCellChars: 120,
      })
    ).ndjson,
  );
}

const preview = await renderWorkbook.render({
  sheetName: sheet.name,
  autoCrop: "all",
  scale: 1,
  format: "png",
});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));

console.log(JSON.stringify({ sourcePath, outputPath, previewPath, usedRange: usedRange.address }));

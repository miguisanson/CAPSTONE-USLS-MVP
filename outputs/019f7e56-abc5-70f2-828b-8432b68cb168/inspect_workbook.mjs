import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const baseDir = "C:/Users/myrine/Documents/GitHub/CAPSTONE-USLS-MVP/outputs/019f7e56-abc5-70f2-828b-8432b68cb168";
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(path.join(baseDir, "source.xlsx")));

const sheetScan = await workbook.inspect({
  kind: "workbook,sheet,table,definedName,drawing",
  include: "id,name,range,values,formulas",
  maxChars: 30000,
  tableMaxRows: 8,
  tableMaxCols: 16,
  tableMaxCellChars: 120,
});
await fs.writeFile(path.join(baseDir, "workbook_scan.ndjson"), sheetScan.ndjson, "utf8");

const sheets = [];
for (let i = 0; ; i += 1) {
  try {
    const sheet = workbook.worksheets.getItemAt(i);
    const used = sheet.getUsedRange();
    const entry = { index: i, name: sheet.name, usedAddress: used?.address ?? null };
    if (used) {
      const region = await workbook.inspect({
        kind: "region",
        sheetId: sheet.name,
        range: used.address,
        include: "values,formulas",
        maxChars: 120000,
        tableMaxRows: 300,
        tableMaxCols: 60,
        tableMaxCellChars: 180,
      });
      await fs.writeFile(path.join(baseDir, `sheet_${String(i + 1).padStart(2, "0")}.ndjson`), region.ndjson, "utf8");

      const formulas = await workbook.inspect({
        kind: "formula",
        sheetId: sheet.name,
        range: used.address,
        maxChars: 50000,
        options: { maxResults: 1000 },
      });
      await fs.writeFile(path.join(baseDir, `formulas_${String(i + 1).padStart(2, "0")}.ndjson`), formulas.ndjson, "utf8");
    }
    const preview = await workbook.render({ sheetName: sheet.name, autoCrop: "all", scale: 1, format: "png" });
    await fs.writeFile(path.join(baseDir, `preview_${String(i + 1).padStart(2, "0")}.png`), new Uint8Array(await preview.arrayBuffer()));
    sheets.push(entry);
  } catch (error) {
    if (String(error).includes("out of bounds") || String(error).includes("not found") || String(error).includes("index")) break;
    throw error;
  }
}

await fs.writeFile(path.join(baseDir, "sheets.json"), JSON.stringify(sheets, null, 2), "utf8");
console.log(JSON.stringify(sheets, null, 2));

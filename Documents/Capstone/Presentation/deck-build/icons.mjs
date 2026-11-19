// Renders icons from the app's own icon set (lucide) to small transparent PNGs. usage: node icons.mjs <outdir>
import { createRequire } from "node:module";
const require = createRequire("/Users/miguelsanson/Projects/CAPSTONE-USLS-MVP/frontend/package.json");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const L = require("lucide-react");
const { chromium } = require("@playwright/test");
const OUT = process.argv[2];
const want = {
  handoff: ["UserRoundPlus", "UserPlus"], adjust: ["ArrowLeftRight", "Shuffle"], enroll: ["ClipboardList"], leave: ["CalendarOff", "CalendarX"],
  readmit: ["RotateCcw", "Undo2"], awol: ["Hourglass", "Timer"], audit: ["ListChecks"], research: ["FileSearch", "FlaskConical"],
  panel: ["Users"], schedule: ["CalendarClock", "CalendarCheck"], practicum: ["Briefcase"], graduate: ["GraduationCap"],
  rules: ["Scale"], manual: ["BookOpenCheck", "BookOpen"], assistant: ["MessageSquareText", "MessageSquare"], calcheck: ["CalendarCheck"],
  calplus: ["CalendarPlus"], sheet: ["Table2", "Table"], chart: ["BarChart3", "ChartColumn", "BarChart"], revise: ["ClipboardCheck"],
  refine: ["Settings2", "Wrench"], usercheck: ["UserCheck"], user: ["User"], sign: ["PenLine", "Pen"], badge: ["BadgeCheck"],
  present: ["Presentation", "MonitorPlay"], click: ["MousePointerClick", "MousePointer"], filecheck: ["FileCheck2", "FileCheck"], check: ["Check"],
  arrow: ["ArrowRight"], target: ["Target"], shield: ["ShieldCheck"], mail: ["Mail"], search: ["Search"], layers: ["Layers"], flag: ["Flag"], compass: ["Compass"],
};
const colors = { white: "#FFFFFF", green: "#14804F", dark: "#0A3B2C", gold: "#6B4A05" };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 200, height: 200 }, deviceScaleFactor: 2 });
const missing = [];
for (const [key, names] of Object.entries(want)) {
  const Icon = names.map((n) => L[n]).find(Boolean);
  if (!Icon) { missing.push(key); continue; }
  for (const [cname, hex] of Object.entries(colors)) {
    const svg = renderToStaticMarkup(React.createElement(Icon, { size: 96, color: hex, strokeWidth: 2 }));
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
    await page.locator("svg").screenshot({ path: `${OUT}/${key}-${cname}.png`, omitBackground: true });
  }
}
await browser.close();
console.log("icons done; missing:", missing.join(",") || "none");

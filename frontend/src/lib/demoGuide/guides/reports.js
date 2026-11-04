import { STAFF, from } from "./_shared.js";

export default {
  id: "reports",
  process: "reports",
  title: "Reports",
  summary: "The numbers the office asks about, the filters, the detail behind each number and the Registrar changes.",
  walkthrough: "20_reports",
  accounts: { staff: STAFF },
  steps: [
    {
      id: "rp-open", title: "Open Reports and Analytics", role: "staff", route: "/reports", page: "Reports & Analytics",
      say: "reports-tour-01",
      do: "Open Reports & Analytics under Overview. Filters on top; below, the first report.",
      actions: [{ pause: 1500, caption: "Showing Reports & Analytics" }],
      doneWhen: { route: "/reports", roleIs: "staff" },
      ifAsked: [{ q: "Where do the numbers come from?", a: "The figures are computed live from recorded transactions. Read the figures off the screen; the numbers change as cases are run." }],
    },
    {
      id: "rp-filter", title: "Filters cover the whole page", role: "staff", route: "/reports", page: "Reports & Analytics",
      say: "reports-tour-15",
      do: "On Needs attention, set a filter, for example a program or a cause. The table narrows and the downloads use the same filters. Clear filters brings everything back.",
      actions: [
        { select: { label: "Program" }, label: "MAED" },
        { pause: 1500, caption: "The table narrows to one program" },
        { select: { label: "Program" }, index: 0 },
      ],
      doneWhen: "manual",
      ifAsked: [{ q: "Why does risk say Not Yet Assessed?", a: "Where the official risk rules are not confirmed, the page says Not Yet Assessed instead of an invented High, Medium or Low." }],
    },
    {
      id: "rp-tabs", title: "The other reports", role: "staff", route: "/reports", page: "Reports & Analytics",
      say: "reports-tour-10",
      do: "Open the other tabs in turn: Where students get stuck, Office speed, Records to fix, then the older reports further along. Each has its own filters and downloads.",
      actions: [
        { click: { role: "tab", name: "Where students get stuck" } },
        { click: { role: "tab", name: "Office speed" } },
        { click: { role: "tab", name: "Records to fix" } },
        { click: { role: "tab", name: "By year started" } },
      ],
      doneWhen: "manual",
      ifAsked: [{ q: "Can a report be downloaded?", a: "Yes, as Excel and PDF on every report; the Registrar changes list also has CSV and Print." }],
    },
    {
      id: "rp-registrar", title: "Registrar changes", role: "staff", route: "/reports", page: "Reports & Analytics",
      say: "reports-tour-14",
      do: "Open Registrar changes: the daily list of changes the Registrar must apply in AIMS. Pick a date, then download the CSV or print it.",
      actions: [{ click: { role: "tab", name: "Registrar changes" } }, { pause: 1500 }],
      doneWhen: "manual",
      ifAsked: [{ q: "Does the portal change AIMS?", a: "No. AIMS stays the official record. This list tells the Registrar what to apply." }],
    },
    {
      id: "rp-analytics", title: "Where students get stuck", role: "staff", route: "/reports", page: "Reports & Analytics",
      do: "Open Where students get stuck: it shows, stage by stage, how many students are waiting there.",
      actions: [{ click: { role: "tab", name: "Where students get stuck" } }, { pause: 1500 }],
      doneWhen: "manual",
      ifAsked: [{ q: "Does the Research Coordinator see every tab?", a: "No. The Research Coordinator sees Needs attention, Where students get stuck and Records to fix." }],
    },
  ],
};

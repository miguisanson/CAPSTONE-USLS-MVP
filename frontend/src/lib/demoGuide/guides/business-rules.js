import { STAFF, NO_CASE } from "./_shared.js";

const SEARCH = { label: "Search rules" };
const FILTERS = { css: '[aria-label="Filter rules"]' };

export default {
  id: "business-rules",
  process: NO_CASE,
  title: "Business Rules",
  summary: "Every rule the workflows follow, with the Handbook page it comes from and whether the system enforces it.",
  walkthrough: "31_business_rules",
  accounts: { staff: STAFF },
  steps: [
    {
      id: "br-open", title: "Open the register of rules", role: "staff", route: "/business-rules", page: "Business Rules",
      do: "Open Business Rules under Monitoring & support. Rules set by the Handbook or the Research Protocol are locked: a value changes only when the Graduate School issues a new policy.",
      actions: [{ pause: 1500, caption: "Showing the register of rules" }],
      doneWhen: { route: "/business-rules", roleIs: "staff" },
      ifAsked: [{ q: "Who can change a rule?", a: "Rules from the Handbook or the Research Protocol are locked. Only the rules marked Needs review can be changed, and every change keeps the old value, the new value, who changed it and why." }],
    },
    {
      id: "br-search", title: "Find the withdrawal rules", role: "staff", route: "/business-rules", page: "Business Rules",
      do: "Type withdraw in the search box. The register narrows to the subject withdrawal window, the fee rules and the dropping rule, each with its Handbook page and a label saying how it is applied.",
      actions: [{ type: SEARCH, text: "withdraw" }, { pause: 1500 }],
      doneWhen: "manual",
      ifAsked: [{ q: "Can a student drop a subject on Day 1?", a: "A student files a Subject Withdrawal instead: the window runs to the end of the second week (14 days, Handbook p. 49). A subject is dropped only when unexcused absences pass 20% (p. 52)." }],
    },
    {
      id: "br-week", title: "The rules counted in weeks", role: "staff", route: "/business-rules", page: "Business Rules",
      do: "Replace the search with week: adding a subject and changing a subject are both limited to the first week of classes (7 days, Handbook p. 49).",
      actions: [{ type: SEARCH, text: "week" }, { pause: 1500 }],
      doneWhen: "manual",
      ifAsked: [{ q: "Where does the first day of classes come from?", a: "From the semester marked Current under Academic Semesters. A wrong start date moves every deadline." }],
    },
    {
      id: "br-history", title: "Every change is kept", role: "staff", route: "/business-rules", page: "Business Rules",
      do: "Search Subject withdrawal window and select Change history on that rule. A rule that was never changed says so; a changed one lists the old value, the new value, who changed it and when.",
      actions: [{ type: SEARCH, text: "Subject withdrawal window" }, { click: { role: "button", name: "Change history" } }, { pause: 1500 }],
      doneWhen: "manual",
      ifAsked: [{ q: "Can the history be erased?", a: "No. The history is part of the audit trail." }],
    },
    {
      id: "br-review", title: "Rules still needing review", role: "staff", route: "/business-rules", page: "Business Rules",
      do: "Clear the search and select the filter Needs review: the prototype rules that the Graduate School has not yet confirmed. Not checked by the system lists the rules the portal shows but does not enforce.",
      actions: [
        { type: SEARCH, text: "" },
        { click: { role: "button", name: "Needs review", in: FILTERS } },
        { pause: 1500 },
        { click: { role: "button", name: "Not checked by the system", in: FILTERS } },
        { pause: 1500 },
      ],
      doneWhen: "manual",
      ifAsked: [{ q: "Why are some rules not enforced?", a: "Where the policy is only described, the portal documents it and does not block the user. Each such rule is labelled so nobody assumes otherwise." }],
    },
    {
      id: "br-screen", title: "The same rules on a workflow screen", role: "staff", route: "/workflow/withdrawal", page: "Subject Withdrawal",
      do: "Open Subject Withdrawal and expand Rules applied on this screen: the same rules, with the same sources, at the place where the rules are used.",
      actions: [
        { click: { role: "link", name: "Subject Withdrawal" } },
        { click: { role: "button", name: "Rules applied on this screen" } },
        { pause: 1800 },
      ],
      doneWhen: "manual",
      ifAsked: [{ q: "Does the student see the same rule?", a: "Yes. The student's Subject Withdrawal page has the same panel and a plain-words note of the window and the fee." }],
    },
  ],
};

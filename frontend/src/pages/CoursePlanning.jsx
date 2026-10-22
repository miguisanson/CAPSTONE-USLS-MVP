import { BookOpenCheck, ClipboardList, SlidersHorizontal } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/ui/index.js";
import { CourseworkReportPanel } from "../components/ProcessGates";
import { useAuth } from "../auth";
import PolicyRules from "../components/PolicyRules";
import CourseAdjustments from "./CourseAdjustments";
import CourseOfferings from "./CourseOfferings";
import { PAGE } from "../lib/labels.js";

export default function CoursePlanning({ initialView = "adjustments" }) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("view") || initialView;
  const view = requested === "offerings" ? "offerings" : "adjustments";

  function switchView(nextView) {
    const params = new URLSearchParams(searchParams);
    params.set("view", nextView);
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="page-stack animate-fade-up">
      <PageHeader
        icon={ClipboardList}
        title={PAGE.courseAdjustments}
        description="Review subject demand, decide what to offer, then complete the semester schedule and faculty assignments in one workspace."
      />

      <div className="grid w-full grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1 lg:w-fit" role="tablist" aria-label="Course adjustment screens">
        <TabButton active={view === "adjustments"} onClick={() => switchView("adjustments")} icon={SlidersHorizontal}>
          Demand & adjustments
        </TabButton>
        <TabButton active={view === "offerings"} onClick={() => switchView("offerings")} icon={BookOpenCheck}>
          Offering setup
        </TabButton>
      </div>

      <PolicyRules process="course_adjustment" title="Adding or changing a subject: rules applied" />

      <div role="tabpanel">
        {view === "adjustments" ? <CourseAdjustments /> : <CourseOfferings />}
      </div>

      {/* BPMN 4 Coursework: the status report the Academic Coordinator sends to the Dean. */}
      {view === "adjustments" ? <CourseworkReportPanel role={user?.role} /> : null}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 max-sm:min-h-11 ${active ? "bg-white text-brand-700 shadow-card" : "text-slate-600 hover:text-ink"}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" /> {children}
    </button>
  );
}

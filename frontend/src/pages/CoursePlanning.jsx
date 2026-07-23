import { BookOpenCheck, SlidersHorizontal } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Card } from "../components/ui";
import CourseAdjustments from "./CourseAdjustments";
import CourseOfferings from "./CourseOfferings";

export default function CoursePlanning({ initialView = "adjustments" }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("view") || initialView;
  const view = requested === "offerings" ? "offerings" : "adjustments";

  function switchView(nextView) {
    const params = new URLSearchParams(searchParams);
    params.set("view", nextView);
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <Card className="p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Academic lifecycle · Step 2</p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-ink">Course Adjustments</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Review subject demand, decide what to offer, then complete the semester schedule and faculty assignments in one workspace.
            </p>
          </div>
          <div className="grid w-full grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1 lg:w-auto" role="tablist" aria-label="Course adjustment screens">
            <button
              type="button"
              role="tab"
              aria-selected={view === "adjustments"}
              onClick={() => switchView("adjustments")}
              className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${view === "adjustments" ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-ink"}`}
            >
              <SlidersHorizontal className="h-4 w-4" /> Demand & adjustments
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "offerings"}
              onClick={() => switchView("offerings")}
              className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${view === "offerings" ? "bg-white text-brand-700 shadow-sm" : "text-slate-600 hover:text-ink"}`}
            >
              <BookOpenCheck className="h-4 w-4" /> Offering setup
            </button>
          </div>
        </div>
      </Card>

      <div role="tabpanel">
        {view === "adjustments" ? <CourseAdjustments embedded /> : <CourseOfferings embedded />}
      </div>
    </div>
  );
}

import { BookOpenCheck, ClipboardList, SlidersHorizontal } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { PageHeader, Tabs } from "../components/ui/index.js";
import { CourseworkReportPanel } from "../components/ProcessGates";
import { useAuth } from "../auth";
import CourseAdjustments from "./CourseAdjustments";
import CourseOfferings from "./CourseOfferings";
import { PAGE } from "../lib/labels.js";

export default function CoursePlanning({ initialView = "adjustments" }) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("view") || initialView;
  const view = ["offerings", "schedule"].includes(requested) ? "offerings" : "adjustments";

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
        forms="course-adjustments"
      />

      <Tabs
        label="Course adjustment screens"
        tabs={[
          { key: "adjustments", label: "Demand & adjustments", icon: SlidersHorizontal },
          { key: "offerings", label: "Offering setup", icon: BookOpenCheck },
        ]}
        value={view}
        onChange={switchView}
      />

      {/* CHANGED BY owner feedback 2026-11-23 (IM58): the rules show on the Business Rules page only */}
      <div role="tabpanel">
        {view === "adjustments" ? <CourseAdjustments /> : <CourseOfferings />}
      </div>

      {/* BPMN 4 Coursework: the status report the Academic Coordinator sends to the Dean. */}
      {view === "adjustments" ? <CourseworkReportPanel role={user?.role} /> : null}
    </div>
  );
}

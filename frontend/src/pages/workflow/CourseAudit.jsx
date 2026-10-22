import { Link } from "react-router-dom";
import { Table2, Database, BookOpenCheck } from "lucide-react";
import { Card, SectionTitle } from "../../components/ui";

// ---------------------------------------------------------------------------
// Course Audit — roster (by subject) or sheet upload
// ---------------------------------------------------------------------------
export function CourseAuditPanel({ meta }) {
  return (
    <Card className="p-6">
      <SectionTitle
        title="Course records are read-only"
        subtitle="USLS grades remain in AIMS and are not encoded again in this portal."
        icon={Database}
      />
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
        <p className="font-semibold">Use the dedicated coursework modules:</p>
        <p className="mt-1 leading-relaxed">
          Enrollment tags students into declared offerings. The Monitoring Sheet then reflects the term-scoped source records automatically and remains read-only.
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/monitoring-sheet" className="btn-primary"><Table2 className="h-4 w-4" /> Open Monitoring Sheet</Link>
        <Link to="/enrollment" className="btn-ghost"><BookOpenCheck className="h-4 w-4" /> Open Enrollment</Link>
      </div>
    </Card>
  );
}

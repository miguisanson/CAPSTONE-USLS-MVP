import { Link } from "react-router-dom";
import { BookOpenCheck, Database, Table2 } from "lucide-react";
import { Button, InlineNotice, SectionTitle } from "../../components/ui/index.js";

// ---------------------------------------------------------------------------
// Course Audit: read-only notice. The page card is drawn by WorkflowPage.
// ---------------------------------------------------------------------------
export function CourseAuditPanel() {
  return (
    <div>
      <SectionTitle
        title="Course records are read-only"
        subtitle="USLS grades remain in AIMS and are not encoded again in this portal."
        icon={Database}
      />
      <InlineNotice tone="success" title="Use the dedicated coursework modules:">
        Enrollment tags students into declared offerings. The Monitoring Sheet then reflects the term-scoped source records automatically and remains read-only.
      </InlineNotice>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button as={Link} to="/monitoring-sheet" icon={Table2}>Open Monitoring Sheet</Button>
        <Button as={Link} to="/enrollment" variant="secondary" icon={BookOpenCheck}>Open Enrollment</Button>
      </div>
    </div>
  );
}

import { Card, EmptyState, PageHeader } from "../../components/ui";
import { CalendarDays } from "lucide-react";

// Placeholder: this screen is being built.
export default function FacultyInvitationsPage() {
  return (
    <div className="space-y-5">
      <PageHeader title="Panel invitations" icon={CalendarDays} />
      <Card className="p-6"><EmptyState icon={CalendarDays} title="This screen is being built" /></Card>
    </div>
  );
}

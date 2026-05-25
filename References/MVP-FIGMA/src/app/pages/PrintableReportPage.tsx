import { mockStudents, mockAlerts, lifecycleStages } from "../data/mockData";
import { Button } from "../components/ui/button";
import { Printer } from "lucide-react";

export function PrintableReportPage() {
  const handlePrint = () => {
    window.print();
  };

  const studentsByStage = lifecycleStages.map(stage => ({
    stage,
    count: mockStudents.filter(s => s.currentStage === stage).length,
  })).filter(item => item.count > 0);

  return (
    <div className="max-w-4xl mx-auto bg-card p-8 print:p-0">
      <div className="no-print mb-6">
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          Print Report
        </Button>
      </div>

      <div className="space-y-8">
        {/* Header */}
        <div className="text-center border-b-2 border-primary pb-6">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">USLS</span>
            </div>
            <div className="text-left">
              <h1 className="text-2xl font-bold text-foreground">University of St. La Salle</h1>
              <p className="text-sm text-muted-foreground">Graduate School</p>
            </div>
          </div>
          <h2 className="text-xl font-semibold text-foreground mt-4">
            Graduate Student Lifecycle Analytics Report
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
          </p>
        </div>

        {/* Executive Summary */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4 border-b pb-2">Executive Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border border-border rounded-lg">
              <p className="text-sm text-muted-foreground">Total Enrolled Students</p>
              <p className="text-3xl font-semibold text-foreground mt-1">{mockStudents.length}</p>
            </div>
            <div className="p-4 border border-border rounded-lg">
              <p className="text-sm text-muted-foreground">At-Risk Students</p>
              <p className="text-3xl font-semibold text-destructive mt-1">
                {mockStudents.filter(s => s.riskFlag).length}
              </p>
            </div>
            <div className="p-4 border border-border rounded-lg">
              <p className="text-sm text-muted-foreground">Open Alerts</p>
              <p className="text-3xl font-semibold text-warning mt-1">
                {mockAlerts.filter(a => a.status !== "Resolved").length}
              </p>
            </div>
            <div className="p-4 border border-border rounded-lg">
              <p className="text-sm text-muted-foreground">Active Programs</p>
              <p className="text-3xl font-semibold text-foreground mt-1">4</p>
            </div>
          </div>
        </div>

        {/* Students by Stage */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4 border-b pb-2">
            Distribution by Lifecycle Stage
          </h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-sm font-medium text-foreground">Stage</th>
                <th className="text-right py-2 text-sm font-medium text-foreground">Student Count</th>
                <th className="text-right py-2 text-sm font-medium text-foreground">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {studentsByStage.map((item, index) => (
                <tr key={item.stage} className={index % 2 === 0 ? "bg-accent/20" : ""}>
                  <td className="py-2 text-sm">{item.stage}</td>
                  <td className="text-right py-2 text-sm font-medium">{item.count}</td>
                  <td className="text-right py-2 text-sm text-muted-foreground">
                    {((item.count / mockStudents.length) * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* At-Risk Students Detail */}
        {mockStudents.filter(s => s.riskFlag).length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4 border-b pb-2">
              At-Risk Students Detail
            </h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 font-medium">Student Name</th>
                  <th className="text-left py-2 font-medium">Program</th>
                  <th className="text-left py-2 font-medium">Current Stage</th>
                  <th className="text-left py-2 font-medium">Adviser</th>
                </tr>
              </thead>
              <tbody>
                {mockStudents.filter(s => s.riskFlag).map((student, index) => (
                  <tr key={student.id} className={index % 2 === 0 ? "bg-accent/20" : ""}>
                    <td className="py-2">{student.name}</td>
                    <td className="py-2">{student.program}</td>
                    <td className="py-2">{student.currentStage}</td>
                    <td className="py-2">{student.adviser}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Alerts Summary */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4 border-b pb-2">
            Active Monitoring Alerts
          </h3>
          <div className="space-y-3">
            {mockAlerts.filter(a => a.status !== "Resolved").map(alert => (
              <div key={alert.id} className="p-3 border border-border rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm">{alert.studentName}</p>
                    <p className="text-xs text-muted-foreground">{alert.program}</p>
                  </div>
                  <p className="text-xs font-medium text-warning">{alert.alertType}</p>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  <p>Triggered: {alert.triggeredDate} • Age: {alert.age} days</p>
                  <p>Handler: {alert.assignedHandler}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommendations */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4 border-b pb-2">
            Recommended Actions
          </h3>
          <ol className="list-decimal list-inside space-y-3 text-sm">
            <li>
              <strong>Address prolonged data collection cases:</strong> Schedule progress review meetings 
              for students exceeding 90-day threshold in Data Collection stage.
            </li>
            <li>
              <strong>Escalate overdue proposal reviews:</strong> Follow up on tasks overdue by more than 
              7 days to prevent progression delays.
            </li>
            <li>
              <strong>Monitor inactivity patterns:</strong> Send reminder notifications to students with 
              no activity for 14+ days.
            </li>
          </ol>
        </div>

        {/* Footer */}
        <div className="border-t border-border pt-6 mt-8">
          <p className="text-xs text-muted-foreground">
            This report is generated by the Graduate Student Lifecycle Monitoring and Analytics Platform.
            For questions or clarifications, contact the Graduate School Office.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            <strong>Confidential:</strong> This report contains sensitive student information and should 
            be handled according to university data protection policies.
          </p>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          @page {
            margin: 1in;
          }
        }
      `}</style>
    </div>
  );
}

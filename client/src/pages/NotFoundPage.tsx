import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";

export const NotFoundPage = () => (
  <div className="flex min-h-[70vh] items-center justify-center">
    <Card className="max-w-md">
      <CardBody className="p-8 text-center">
        <p className="text-4xl font-semibold text-[var(--gs-primary)]">404</p>
        <p className="mt-2 text-lg font-semibold text-slate-900">Page Not Found</p>
        <p className="mt-1 text-sm text-slate-600">
          The requested route is not available in this Graduate School Monitoring portal context.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Link to="/">
            <Button size="sm">Go to Dashboard</Button>
          </Link>
          <Button size="sm" variant="outline" onClick={() => window.history.back()}>
            Go Back
          </Button>
        </div>
      </CardBody>
    </Card>
  </div>
);

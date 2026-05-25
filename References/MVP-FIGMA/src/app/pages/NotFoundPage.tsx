import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Home, ArrowLeft } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-12 text-center">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl font-bold text-primary">404</span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">Page Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button variant="default" asChild>
              <Link to="/">
                <Home className="h-4 w-4 mr-2" />
                Go to Dashboard
              </Link>
            </Button>
            <Button variant="outline" onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

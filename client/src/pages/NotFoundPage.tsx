import { Link } from "react-router-dom";

export const NotFoundPage = () => (
  <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
    <h2 className="text-lg font-semibold text-slate-800">Page not found</h2>
    <p className="mt-1 text-sm text-slate-500">The requested route does not exist in this MVP portal.</p>
    <Link to="/" className="mt-4 inline-block rounded-md bg-[var(--gs-primary)] px-4 py-2 text-sm text-white">
      Return to Dashboard
    </Link>
  </div>
);


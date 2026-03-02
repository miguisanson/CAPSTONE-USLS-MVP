import { Navigate, Outlet } from "react-router-dom";
import type { RoleName } from "../types/domain";
import { useAuth } from "./AuthContext";
import { hasAnyRole } from "../utils/roles";

type Props = {
  allowedRoles?: RoleName[];
};

export const ProtectedRoute = ({ allowedRoles }: Props) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Loading session...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !hasAnyRole(user.roles, allowedRoles)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};


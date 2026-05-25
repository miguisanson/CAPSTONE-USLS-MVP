import React, { createContext, useContext, useState, ReactNode } from "react";

export type UserRole = 
  | "Admin"
  | "Graduate School Staff"
  | "Academic Coordinator"
  | "Research Coordinator"
  | "Adviser"
  | "Panel Member"
  | "Student";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
  hasAccess: (allowedRoles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>({
    id: "1",
    name: "Dr. Maria Santos",
    email: "maria.santos@usls.edu.ph",
    role: "Graduate School Staff",
  });

  const logout = () => {
    setUser(null);
  };

  const hasAccess = (allowedRoles: UserRole[]) => {
    if (!user) return false;
    return allowedRoles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout, hasAccess }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

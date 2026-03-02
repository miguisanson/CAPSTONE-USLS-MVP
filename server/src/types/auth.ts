import { RoleName } from "@prisma/client";

export type AuthUser = {
  id: number;
  email: string;
  fullName: string;
  roles: RoleName[];
};


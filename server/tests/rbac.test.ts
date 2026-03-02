import request from "supertest";
import { RoleName } from "@prisma/client";

jest.mock("../src/lib/prisma", () => {
  const prisma = {
    alertThreshold: {
      findMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };
  return { prisma };
});

jest.mock("../src/middleware/authenticate", () => ({
  authenticate: (req: any, _res: any, next: () => void) => {
    const roleHeader = String(req.headers["x-role"] ?? RoleName.STUDENT);
    req.user = {
      id: 1,
      email: "mock@gs.local",
      fullName: "Mock User",
      roles: [roleHeader],
    };
    next();
  },
}));

import { prisma } from "../src/lib/prisma";
import { createApp } from "../src/app";

describe("RBAC API", () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.alertThreshold.findMany as jest.Mock).mockResolvedValue([]);
  });

  it("blocks non-admin users from admin config", async () => {
    const response = await request(app).get("/api/admin/thresholds").set("x-role", RoleName.ADVISER);
    expect(response.status).toBe(403);
  });

  it("allows admin users to read admin config", async () => {
    const response = await request(app).get("/api/admin/thresholds").set("x-role", RoleName.ADMIN);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });
});


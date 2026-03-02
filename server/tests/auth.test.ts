import request from "supertest";
import bcrypt from "bcryptjs";
import { RoleName } from "@prisma/client";

jest.mock("../src/lib/prisma", () => {
  const prisma = {
    userAccount: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
  };
  return { prisma };
});

import { prisma } from "../src/lib/prisma";
import { createApp } from "../src/app";

describe("Auth API", () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("logs in with valid credentials", async () => {
    const passwordHash = await bcrypt.hash("DemoPass123!", 10);
    (prisma.userAccount.findUnique as jest.Mock).mockResolvedValue({
      id: 99,
      email: "admin@gs.local",
      fullName: "System Admin",
      passwordHash,
      isActive: true,
      roles: [{ role: { name: RoleName.ADMIN } }],
      studentProfile: null,
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "admin@gs.local",
      password: "DemoPass123!",
    });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
    expect(response.body.user.email).toBe("admin@gs.local");
    expect(response.body.user.roles).toEqual([RoleName.ADMIN]);
  });

  it("rejects invalid credentials", async () => {
    const passwordHash = await bcrypt.hash("wrong-pass", 10);
    (prisma.userAccount.findUnique as jest.Mock).mockResolvedValue({
      id: 100,
      email: "staff@gs.local",
      fullName: "Staff",
      passwordHash,
      isActive: true,
      roles: [{ role: { name: RoleName.GRADUATE_SCHOOL_STAFF } }],
      studentProfile: null,
    });

    const response = await request(app).post("/api/auth/login").send({
      email: "staff@gs.local",
      password: "bad-password",
    });

    expect(response.status).toBe(401);
    expect(response.body.message).toMatch(/invalid email or password/i);
  });
});


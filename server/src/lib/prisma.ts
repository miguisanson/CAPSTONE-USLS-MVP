import { PrismaClient } from "@prisma/client";

// Guard against machine-level overrides that force JS client engine.
// This backend expects native/binary engine (no adapter/accelerate required).
if ((process.env.PRISMA_CLIENT_ENGINE_TYPE ?? "").toLowerCase() === "client") {
  process.env.PRISMA_CLIENT_ENGINE_TYPE = "binary";
}

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}

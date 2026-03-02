import { z } from "zod";

const boolFromString = z
  .string()
  .optional()
  .transform((value) => value === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("8h"),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),
  PORTAL_BASE_URL: z.string().url().default("http://localhost:5173"),
  UPLOAD_DIR: z.string().default("uploads"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  SMTP_SECURE: boolFromString.default(false),
  MONITOR_CRON: z.string().default("*/30 * * * *"),
  ENABLE_OPENAI_ASSIST: boolFromString.default(false),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
});

export const env = envSchema.parse(process.env);


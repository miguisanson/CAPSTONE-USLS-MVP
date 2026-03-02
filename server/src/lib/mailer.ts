import nodemailer from "nodemailer";
import { env } from "../config/env";

let transporter: nodemailer.Transporter | null = null;

const isMailerConfigured =
  Boolean(env.SMTP_HOST) && Boolean(env.SMTP_USER) && Boolean(env.SMTP_PASS) && Boolean(env.SMTP_FROM);

if (isMailerConfigured) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

export const sendSafePortalEmail = async (params: {
  to: string;
  subject: string;
  summaryLine: string;
  portalPath: string;
}): Promise<{ success: boolean; messageId?: string; reason?: string }> => {
  if (!transporter || !env.SMTP_FROM) {
    return { success: false, reason: "SMTP is not configured." };
  }

  const portalLink = `${env.PORTAL_BASE_URL}${params.portalPath}`;
  const text = `${params.summaryLine}\n\nPlease log in to the Graduate Lifecycle Portal for details:\n${portalLink}`;

  const result = await transporter.sendMail({
    from: env.SMTP_FROM,
    to: params.to,
    subject: params.subject,
    text,
  });

  return { success: true, messageId: result.messageId };
};


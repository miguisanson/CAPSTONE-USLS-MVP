import { RoleName } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env";
import { authorize } from "../../middleware/authorize";
import { asyncHandler } from "../../utils/async-handler";
import { HttpError } from "../../utils/http-error";

const draftSchema = z.object({
  prompt: z.string().min(5),
  context: z.string().optional().nullable(),
});

export const assistantRouter = Router();

assistantRouter.post(
  "/draft-notification",
  authorize(
    RoleName.ADMIN,
    RoleName.GRADUATE_SCHOOL_STAFF,
    RoleName.ACADEMIC_COORDINATOR,
    RoleName.RESEARCH_COORDINATOR
  ),
  asyncHandler(async (req, res) => {
    if (!env.ENABLE_OPENAI_ASSIST) {
      throw new HttpError(503, "AI assistance is disabled by feature flag.");
    }
    if (!env.OPENAI_API_KEY) {
      throw new HttpError(500, "OpenAI API key is missing.");
    }

    const parsed = draftSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, "Invalid request payload.");

    const systemPrompt =
      "You draft concise, non-sensitive portal notification text. Do not provide decisions or policy changes.";
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        input: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Prompt: ${parsed.data.prompt}\nContext: ${parsed.data.context ?? "N/A"}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new HttpError(502, "OpenAI request failed.");
    }

    const payload = (await response.json()) as { output_text?: string };
    res.json({ draft: payload.output_text ?? "" });
  })
);


import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function callVision(apiKey: string, prompt: string, images: string[]) {
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3.7-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...images.map((url) => ({ type: "image_url", image_url: { url } })),
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`AI request failed (${res.status}): ${detail.slice(0, 300)}`);
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return json.choices?.[0]?.message?.content ?? "";
}

function parseJsonBlock<T>(raw: string, fallback: T): T {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return fallback;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return fallback;
  }
}

export const extractIdDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { image: string }) => z.object({ image: z.string().min(32) }).parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured");
    const raw = await callVision(
      apiKey,
      'Read this physical ID document. Reply with JSON only: {"fullName":string,"idNumber":string,"documentType":string,"expiry":string,"rawText":string}. Use empty strings when unreadable.',
      [data.image],
    );
    return parseJsonBlock(raw, {
      fullName: "",
      idNumber: "",
      documentType: "",
      expiry: "",
      rawText: raw,
    });
  });

export const verifyFace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { live: string; reference: string }) =>
    z.object({ live: z.string().min(32), reference: z.string().min(8) }).parse(data),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured");
    const raw = await callVision(
      apiKey,
      'Compare the two face photos (first = live gate capture, second = registered profile photo). Reply with JSON only: {"match":boolean,"confidence":number between 0 and 1,"reason":string}.',
      [data.live, data.reference],
    );
    return parseJsonBlock(raw, { match: false, confidence: 0, reason: "Could not analyse photos" });
  });

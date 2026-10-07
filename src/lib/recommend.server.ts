import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

export type RecInput = {
  skills: string[];
  district: string;
  availability: string;
  opportunities: {
    id: string;
    title: string;
    sector: string;
    district: string;
    type: string;
    mode: string;
    skills: string[];
    pay: string;
    duration: string;
    teamAllowed: boolean;
  }[];
};
export type Rec = { id: string; score: number; fit: string; gaps: string };

export async function recommend(input: RecInput): Promise<Rec[]> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured.");
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    instructions:
      'You match Rwandan workers to opportunities. Return ONLY JSON: {"recommendations":[{"id":string,"score":number 0-100,"fit":string,"gaps":string}]}. Pick up to 4 best matches from the given list only, best first. \'fit\' is 1-2 plain sentences explaining why (skills, location/travel, availability vs duration). \'gaps\' is a short note on what\'s missing, or empty. Be honest; do not invent facts.',
    messages: [{ role: "user", content: JSON.stringify(input) }],
    providerOptions: {
      openai: {
        store: false,
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  const text = await result.text;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as { recommendations?: Rec[] };
    const ids = new Set(input.opportunities.map((o) => o.id));
    return (parsed.recommendations ?? [])
      .filter((r) => ids.has(r.id))
      .slice(0, 4)
      .map((r) => ({
        id: r.id,
        score: Math.max(0, Math.min(100, Math.round(Number(r.score) || 0))),
        fit: String(r.fit ?? "").slice(0, 400),
        gaps: String(r.gaps ?? "").slice(0, 300),
      }));
  } catch {
    return [];
  }
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  skills: z.array(z.string().trim().min(1).max(60)).min(1).max(15),
  district: z.string().trim().min(1).max(40),
  availability: z.string().trim().min(1).max(80),
  opportunities: z.array(z.object({
    id: z.string().max(40), title: z.string().max(120), sector: z.string().max(40), district: z.string().max(40),
    type: z.string().max(20), mode: z.string().max(20), skills: z.array(z.string().max(60)).max(15),
    pay: z.string().max(60), duration: z.string().max(40), teamAllowed: z.boolean(),
  })).min(1).max(40),
});

export const recommendOpportunities = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => {
    const { recommend } = await import("./recommend.server");
    try {
      return { ok: true as const, recs: await recommend(data) };
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      const msg = status === 429 ? "Too many requests — please wait a moment and try again."
        : status === 402 ? "AI credits are used up for this workspace."
        : "Couldn't get recommendations right now.";
      return { ok: false as const, error: msg };
    }
  });

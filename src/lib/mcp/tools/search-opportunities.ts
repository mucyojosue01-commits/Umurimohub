import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_opportunities",
  title: "Search opportunities",
  description: "Search open UmurimoHub work opportunities by keyword, district or sector.",
  inputSchema: {
    query: z.string().max(100).optional().describe("Keyword in the title."),
    district: z.string().max(60).optional().describe("Rwanda district, e.g. Gasabo."),
    sector: z.string().max(60).optional().describe("Sector, e.g. Construction."),
    limit: z.number().int().min(1).max(25).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, district, sector, limit }, ctx) => {
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("opportunities")
      .select("id,title,sector,district,type,pay_rwf,pay_unit,deadline,summary,is_demo")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(limit ?? 10);
    if (query) q = q.ilike("title", `%${query}%`);
    if (district) q = q.ilike("district", district);
    if (sector) q = q.ilike("sector", sector);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const items = (data ?? []).map((o) => ({
      id: String(o.id),
      title: String(o.title),
      sector: String(o.sector),
      district: String(o.district),
      type: String(o.type),
      pay_rwf: Number(o.pay_rwf),
      pay_unit: String(o.pay_unit),
      deadline: o.deadline ? String(o.deadline) : null,
      summary: String(o.summary ?? ""),
      demo: Boolean(o.is_demo),
    }));
    return { content: [{ type: "text", text: JSON.stringify(items) }], structuredContent: { opportunities: items } };
  },
});

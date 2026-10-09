import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_applications",
  title: "List my applications",
  description: "List the signed-in user's applications and their current status.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_args, ctx) => {
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("applications")
      .select("id,opportunity_id,kind,status,created_at")
      .eq("applicant_user_id", ctx.getUserId() ?? "")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const items = (data ?? []).map((a) => ({
      id: String(a.id),
      opportunity_id: String(a.opportunity_id),
      kind: String(a.kind),
      status: String(a.status),
      created_at: String(a.created_at),
    }));
    return { content: [{ type: "text", text: JSON.stringify(items) }], structuredContent: { applications: items } };
  },
});

import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_notifications",
  title: "List my notifications",
  description: "List the signed-in user's recent notifications, optionally only unread ones.",
  inputSchema: { unread_only: z.boolean().optional().describe("Only return unread notifications.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ unread_only }, ctx) => {
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("notifications")
      .select("id,text,kind,read,link,created_at")
      .eq("user_id", ctx.getUserId() ?? "")
      .order("created_at", { ascending: false })
      .limit(30);
    if (unread_only) q = q.eq("read", false);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const items = (data ?? []).map((n) => ({
      id: String(n.id),
      text: String(n.text),
      kind: String(n.kind),
      read: Boolean(n.read),
      link: n.link ? String(n.link) : null,
      created_at: String(n.created_at),
    }));
    return { content: [{ type: "text", text: JSON.stringify(items) }], structuredContent: { notifications: items } };
  },
});

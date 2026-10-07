import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  mapBusiness,
  mapOpportunity,
  mapTeam,
  mapWorker,
  type Catalog,
} from "@/features/data/mappers";

// Public, read-only catalog of everything anyone may browse. Uses the publishable
// key so row security (anon policies) decides what is visible.
export const getCatalog = createServerFn({ method: "GET" }).handler(async (): Promise<Catalog> => {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const db = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`)
          h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const [w, s, t, m, b, o] = await Promise.all([
    db
      .from("worker_profiles")
      .select("*")
      .order("is_demo")
      .order("created_at", { ascending: false })
      .limit(200),
    db.from("worker_skills").select("*").limit(1000),
    db.from("teams").select("*").limit(200),
    db.from("team_members").select("*").limit(1000),
    db.from("businesses").select("*").limit(200),
    db.from("opportunities").select("*").order("created_at", { ascending: false }).limit(200),
  ]);
  const err = w.error || s.error || t.error || m.error || b.error || o.error;
  if (err) throw new Error(err.message);
  const opps = o.data ?? [];
  return {
    workers: (w.data ?? []).map((x) => mapWorker(x, s.data ?? [], m.data ?? [])),
    teams: (t.data ?? []).map((x) => mapTeam(x, m.data ?? [])),
    businesses: (b.data ?? []).map((x) => mapBusiness(x, opps)),
    opportunities: opps.filter((x) => x.status === "open").map(mapOpportunity),
    workerUserIds: Object.fromEntries((w.data ?? []).map((x) => [x.id, x.user_id])),
    source: "database",
  };
});

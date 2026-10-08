import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";
import {
  mapBusiness,
  mapOpportunity,
  mapTeam,
  mapWorker,
  type Catalog,
} from "./mappers";

export const emptyCatalog: Catalog = {
  workers: [],
  teams: [],
  businesses: [],
  opportunities: [],
  workerUserIds: {},
  source: "database",
};

export const catalogQuery = queryOptions({
  queryKey: ["catalog"],
  queryFn: async (): Promise<Catalog> => {
    const [w, s, t, m, b, o, profiles] = await Promise.all([
      supabase.from("worker_profiles").select("*").eq("is_demo", false).order("created_at", { ascending: false }).limit(200),
      supabase.from("worker_skills").select("*").limit(2000),
      supabase.from("teams").select("*").eq("is_demo", false).order("created_at", { ascending: false }).limit(200),
      supabase.from("team_members").select("*").limit(2000),
      supabase.from("businesses").select("*").eq("is_demo", false).order("created_at", { ascending: false }).limit(200),
      supabase.from("opportunities").select("*").eq("is_demo", false).neq("status", "draft").order("created_at", { ascending: false }).limit(200),
      supabase.from("profiles").select("id,avatar_url").limit(500),
    ]);
    const err = w.error ?? s.error ?? t.error ?? m.error ?? b.error ?? o.error ?? profiles.error;
    if (err) throw new Error(err.message);

    const workers = w.data ?? [];
    const skills = s.data ?? [];
    const teams = t.data ?? [];
    const members = m.data ?? [];
    const businesses = b.data ?? [];
    const opportunities = (o.data ?? []).filter((x) => x.status === "open");
    const profileAvatars = new Map((profiles.data ?? []).map((p) => [p.id, p.avatar_url]));
    const mappedWorkers = workers.map((x) => {
      const worker = mapWorker(x, skills, members);
      return { ...worker, avatarUrl: worker.avatarUrl ?? (x.user_id ? profileAvatars.get(x.user_id) ?? null : null) };
    });
    const mappedTeams = teams.map((x) => {
      const team = mapTeam(x, members);
      return { ...team, avatarUrl: team.avatarUrl ?? (x.lead_user_id ? profileAvatars.get(x.lead_user_id) ?? null : null) };
    });

    return {
      workers: mappedWorkers,
      teams: mappedTeams,
      businesses: businesses.map((x) => mapBusiness(x, opportunities)),
      opportunities: opportunities.map(mapOpportunity),
      workerUserIds: Object.fromEntries(workers.map((x) => [x.id, x.user_id])),
      source: "database",
    };
  },
  staleTime: 15_000,
});

export function withGetters(c: Catalog) {
  return {
    ...c,
    getWorker: (id: string) => c.workers.find((w) => w.id === id),
    getTeam: (id: string) => c.teams.find((t) => t.id === id),
    getBusiness: (id: string) => c.businesses.find((b) => b.id === id),
    getOpportunity: (id: string) => c.opportunities.find((o) => o.id === id),
  };
}

export function useCatalog() {
  const q = useQuery({ ...catalogQuery, placeholderData: emptyCatalog });
  return { ...withGetters(q.data ?? emptyCatalog), refresh: q.refetch, loading: q.isLoading, error: q.error };
}
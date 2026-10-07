import { queryOptions, useQuery } from "@tanstack/react-query";
import { getCatalog } from "@/lib/catalog.functions";
import { BUSINESSES, OPPORTUNITIES, TEAMS, WORKERS } from "./demo";
import type { Catalog } from "./mappers";

// Demo fallback mirrors the seeded rows, so the UI renders identically if the
// database is unreachable.
export const emptyCatalog: Catalog = {
  workers: [],
  teams: [],
  businesses: [],
  opportunities: [],
  workerUserIds: {},
  source: "database",
};

export const demoCatalog: Catalog = {
  workers: WORKERS,
  teams: TEAMS,
  businesses: BUSINESSES,
  opportunities: OPPORTUNITIES,
  workerUserIds: Object.fromEntries(WORKERS.map((w) => [w.id, null])),
  source: "demo",
};

export const catalogQuery = queryOptions({
  queryKey: ["catalog"],
  queryFn: async () => {
    try {
      return await getCatalog();
    } catch (e) {
      console.warn("catalog fallback", e);
      return demoCatalog;
    }
  },
  staleTime: 60_000,
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
  return { ...withGetters(q.data ?? demoCatalog), refresh: q.refetch };
}

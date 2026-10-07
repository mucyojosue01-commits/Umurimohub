import { queryOptions, useQuery } from "@tanstack/react-query";
import { getCatalog } from "@/lib/catalog.functions";
import type { Catalog } from "./mappers";

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
  queryFn: async () => getCatalog(),
  staleTime: 30_000,
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
  return { ...withGetters(q.data ?? emptyCatalog), refresh: q.refetch };
}
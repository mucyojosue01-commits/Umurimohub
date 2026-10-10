import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, Card, PageHeader, Pill } from "@/features/ui/kit";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/businesses/$id")({ component: Page });
function Page() {
  const { id } = Route.useParams();
  const businessQ = useQuery({
    queryKey: ["business-profile", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("businesses").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const projectsQ = useQuery({
    queryKey: ["business-projects", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("opportunities").select("id,title,summary,status,created_at").eq("business_id", id).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
  const business = businessQ.data;
  if (businessQ.isLoading) return <div className="container-page py-16 text-sm text-muted-foreground">Loading business profile…</div>;
  if (businessQ.isError) return <div className="container-page py-16"><Card><p className="text-sm text-destructive">Could not load this business profile.</p><button className="mt-3 text-sm underline" onClick={() => void businessQ.refetch()}>Try again</button></Card></div>;
  if (!business) return <div className="container-page py-16"><Card><h1 className="font-bold">Business not found</h1><p className="mt-2 text-sm text-muted-foreground">This business may have been removed or is not available to your account.</p><Link className="mt-4 inline-block text-primary" to="/businesses">Browse businesses</Link></Card></div>;
  return <div className="container-page py-10">
    <Link to="/businesses" className="text-sm text-muted-foreground">← Businesses</Link>
    <Card className="mt-4 p-7">
      <div className="flex items-start gap-4">
        <Avatar initials={(business.name ?? "B").slice(0,2).toUpperCase()} src={business.avatar_url} alt={business.name ?? "Business"} size="lg" />
        <div className="min-w-0">
          <div className="flex items-center gap-2"><Building2 className="size-5 text-primary" /><h1 className="text-3xl font-display font-bold">{business.name}</h1></div>
          <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-4" />{business.district || "Rwanda"}</p>
          <Pill className="mt-3">{business.sector || "Business"}</Pill><Pill tone="success" className="mt-3 ml-2">{Math.round(Number(business.trust_score ?? 0))} trust</Pill>
        </div>
      </div>
      <p className="mt-6 text-muted-foreground">{business.about || "No business description yet."}</p>
      {(business.services ?? []).length > 0 && <div className="mt-4 flex flex-wrap gap-2">{business.services.map((s: string) => <Pill key={s}>{s}</Pill>)}</div>}
    </Card>
    <div className="mt-8">
      <PageHeader eyebrow="Track record" title="Past projects & opportunities" desc="Work published by this business." />
      {projectsQ.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Loading projects…</p> : projectsQ.isError ? <Card><p className="text-sm text-destructive">Could not load projects.</p><button className="mt-3 text-sm underline" onClick={() => void projectsQ.refetch()}>Try again</button></Card> : !projectsQ.data?.length ? <p className="mt-4 text-sm text-muted-foreground">No projects yet.</p> : <div className="mt-4 grid gap-4 md:grid-cols-2">{projectsQ.data.map((o) => <Link key={o.id} to="/opportunities/$id" params={{ id: o.id }}><Card className="transition hover:border-primary/40"><p className="font-semibold">{o.title}</p><p className="mt-1 text-sm text-muted-foreground">{o.summary}</p><Pill className="mt-3">{o.status}</Pill></Card></Link>)}</div>}
    </div>
  </div>;
}

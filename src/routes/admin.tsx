import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity, AlertTriangle, BriefcaseBusiness, Building2, CheckCircle2, ChevronRight,
  CircleDollarSign, ClipboardCheck, FileText, Filter, LayoutDashboard, LifeBuoy,
  RefreshCw, Search, Settings2, ShieldCheck, ShieldAlert, Users, WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/features/store/app-store";
import { PaymentDisputesAdmin } from "@/features/payments/panel";
import { supabase } from "@/integrations/supabase/client";

type AdminRow = Record<string, unknown>;
type Section = "overview" | "users" | "verification" | "opportunities" | "projects" | "payments" | "reports" | "settings";

const SECTIONS: Array<{ id: Section; label: string; description: string; icon: typeof LayoutDashboard }> = [
  { id: "overview", label: "Overview", description: "Platform health and action queues", icon: LayoutDashboard },
  { id: "users", label: "People & access", description: "Profiles and platform roles", icon: Users },
  { id: "verification", label: "Verification", description: "Workers, teams and businesses", icon: ShieldCheck },
  { id: "opportunities", label: "Opportunities", description: "Listings and applications", icon: BriefcaseBusiness },
  { id: "projects", label: "Projects & contracts", description: "Work delivery and milestones", icon: FileText },
  { id: "payments", label: "Payments & disputes", description: "Transactions and resolution", icon: WalletCards },
  { id: "reports", label: "Reports & insights", description: "Verified platform activity", icon: Activity },
  { id: "settings", label: "System & security", description: "Access and operational checks", icon: Settings2 },
];

const TABLES: Record<Exclude<Section, "overview" | "settings" | "reports">, Array<{ table: string; title: string; description: string }>> = {
  users: [
    { table: "profiles", title: "Member profiles", description: "Registered people and contact details" },
    { table: "user_roles", title: "Role assignments", description: "Roles assigned to platform accounts" },
  ],
  verification: [
    { table: "worker_profiles", title: "Worker profiles", description: "Skills, location and verification evidence" },
    { table: "businesses", title: "Businesses", description: "Employer and MSME records" },
    { table: "teams", title: "Teams", description: "Team identity and membership records" },
  ],
  opportunities: [
    { table: "opportunities", title: "Opportunity listings", description: "Work, projects and business demand" },
    { table: "applications", title: "Applications", description: "Applicant pipeline and decisions" },
  ],
  projects: [
    { table: "contracts", title: "Contracts", description: "Agreed work, status and terms" },
    { table: "milestones", title: "Milestones", description: "Deliverables and approval workflow" },
  ],
  payments: [
    { table: "payment_transactions", title: "Payment transactions", description: "Provider-confirmed payment lifecycle" },
    { table: "payment_disputes", title: "Payment disputes", description: "Open cases and recorded outcomes" },
  ],
};

const COUNT_TABLES = [
  ["profiles", "People", Users],
  ["businesses", "Businesses", Building2],
  ["opportunities", "Opportunities", BriefcaseBusiness],
  ["contracts", "Contracts", FileText],
  ["payment_transactions", "Transactions", CircleDollarSign],
  ["payment_disputes", "Disputes", ShieldAlert],
] as const;

function asText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function displayTitle(row: AdminRow, fallback: string) {
  for (const key of ["display_name", "title", "name", "business_name", "full_name", "reason", "id"]) {
    if (row[key] !== null && row[key] !== undefined && String(row[key]).trim()) return String(row[key]);
  }
  return fallback;
}

function prettyKey(key: string) {
  return key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin console — UmurimoHub" },
      { name: "description", content: "Secure operations console for UmurimoHub administrators." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { user, authReady } = useApp();
  const [section, setSection] = useState<Section>("overview");
  const [search, setSearch] = useState("");
  const [selectedTable, setSelectedTable] = useState("profiles");
  const [mobileNav, setMobileNav] = useState(false);
  const qc = useQueryClient();
  const isAdmin = user?.roles.includes("admin") === true;

  const counts = useQuery({
    queryKey: ["admin-console-counts", user?.id],
    enabled: isAdmin,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const results = await Promise.all(COUNT_TABLES.map(async ([table, label]) => {
        const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
        return { table, label, count: error ? null : (count ?? 0), error: error?.message as string | undefined };
      }));
      return results;
    },
  });

  const currentTables = section === "overview" || section === "settings" || section === "reports"
    ? []
    : TABLES[section];
  const availableTables = currentTables.map((entry) => entry.table);
  const activeTable = availableTables.includes(selectedTable) ? selectedTable : (availableTables[0] ?? "profiles");

  const rowsQuery = useQuery({
    queryKey: ["admin-console-rows", activeTable, user?.id],
    enabled: isAdmin && availableTables.length > 0,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any;
      const { data, error } = await db.from(activeTable).select("*").limit(100);
      if (error) throw error;
      return (data ?? []) as AdminRow[];
    },
  });

  const filteredRows = useMemo(() => {
    const rows = rowsQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => Object.entries(row).some(([key, value]) =>
      !["password", "password_hash", "access_token", "refresh_token", "secret"].includes(key.toLowerCase()) &&
      asText(value).toLowerCase().includes(q)
    ));
  }, [rowsQuery.data, search]);

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["admin-console-counts"] }),
      qc.invalidateQueries({ queryKey: ["admin-console-rows"] }),
      qc.invalidateQueries({ queryKey: ["payment-disputes-admin"] }),
    ]);
    await Promise.all([counts.refetch(), rowsQuery.refetch()]);
    toast.success("Admin data refreshed.");
  };

  if (!authReady) {
    return <div className="container-page flex min-h-[55vh] items-center justify-center"><p className="text-sm text-muted-foreground">Checking administrator access…</p></div>;
  }
  if (!user) {
    return <div className="container-page py-20 text-center"><ShieldAlert className="mx-auto size-10 text-muted-foreground" /><h1 className="mt-4 text-2xl font-bold">Administrator sign-in required</h1><p className="mt-2 text-muted-foreground">Sign in with an account that has an authorized admin role.</p><Button asChild className="mt-5"><Link to="/login">Sign in</Link></Button></div>;
  }
  if (!isAdmin) {
    return <div className="container-page py-20 text-center"><ShieldAlert className="mx-auto size-10 text-destructive" /><h1 className="mt-4 text-2xl font-bold">Access restricted</h1><p className="mx-auto mt-2 max-w-lg text-muted-foreground">The Admin Console is available only to accounts with the platform administrator role. Your current session has not been granted that role.</p><Button asChild variant="outline" className="mt-5"><Link to="/dashboard">Return to dashboard</Link></Button></div>;
  }

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-muted/20">
      <div className="border-b bg-background">
        <div className="container-page flex flex-wrap items-center justify-between gap-4 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><ShieldCheck className="size-5" /></div>
            <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">UmurimoHub operations</p><h1 className="text-2xl font-bold tracking-tight">Admin Console</h1><p className="text-sm text-muted-foreground">Manage trust, work, payments and platform integrity.</p></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-full border bg-background px-3 py-1.5 text-xs font-medium sm:inline-flex"><CheckCircle2 className="mr-1.5 size-3.5 text-emerald-600" /> Admin access verified</span>
            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={counts.isFetching || rowsQuery.isFetching}><RefreshCw className={`mr-2 size-4 ${counts.isFetching || rowsQuery.isFetching ? "animate-spin" : ""}`} />Refresh data</Button>
          </div>
        </div>
      </div>

      <div className="container-page grid gap-6 py-6 lg:grid-cols-[245px_minmax(0,1fr)]">
        <aside className={`${mobileNav ? "block" : "hidden"} lg:block`}>
          <div className="rounded-2xl border bg-background p-2 shadow-sm">
            <p className="px-3 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Workspace</p>
            <nav className="space-y-1" aria-label="Admin sections">
              {SECTIONS.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return <button key={item.id} onClick={() => { setSection(item.id); setSearch(""); setMobileNav(false); }} className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition ${active ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground hover:bg-muted"}`}>
                  <Icon className="mt-0.5 size-4 shrink-0" /><span className="min-w-0"><span className="block text-sm font-semibold">{item.label}</span><span className={`mt-0.5 block text-xs ${active ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{item.description}</span></span>
                </button>;
              })}
            </nav>
            <div className="mx-2 my-3 border-t" />
            <Link to="/dashboard" className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><ChevronRight className="size-4" /> Back to app dashboard</Link>
          </div>
          <div className="mt-4 rounded-2xl border bg-background p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><LifeBuoy className="size-4 text-primary" /> Operations principle</div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Verify evidence before changing trust status. Record decisions. Never mark a payment as paid without provider confirmation.</p>
          </div>
        </aside>

        <main className="min-w-0 space-y-6">
          <button className="flex w-full items-center justify-between rounded-xl border bg-background px-4 py-3 text-sm font-semibold lg:hidden" onClick={() => setMobileNav((value) => !value)}>{SECTIONS.find((item) => item.id === section)?.label}<span>{mobileNav ? "Close menu" : "Change section"}</span></button>

          {section === "overview" && (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm text-muted-foreground">Good day, {user.name.split(" ")[0]}</p><h2 className="mt-1 text-2xl font-bold">Platform overview</h2><p className="mt-1 text-sm text-muted-foreground">Live totals from records your administrator account is permitted to access.</p></div><span className="text-xs text-muted-foreground">Updated {counts.dataUpdatedAt ? new Date(counts.dataUpdatedAt).toLocaleTimeString() : "on refresh"}</span></div>
              {counts.isError && <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><AlertTriangle className="size-4 text-destructive" /> Some metrics could not be loaded. Check database access and retry.</div>}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {COUNT_TABLES.map(([table, label, Icon]) => {
                  const item = counts.data?.find((entry) => entry.table === table);
                  return <button key={table} onClick={() => { const target: Record<string, Section> = { profiles: "users", businesses: "verification", opportunities: "opportunities", contracts: "projects", payment_transactions: "payments", payment_disputes: "payments" }; setSection(target[table] ?? "overview"); setSelectedTable(table); }} className="group rounded-2xl border bg-background p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <div className="flex items-center justify-between"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span><ChevronRight className="size-4 text-muted-foreground transition group-hover:translate-x-1" /></div>
                    <p className="mt-4 text-sm text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-bold tabular-nums">{item?.count === null ? "—" : item?.count ?? (counts.isLoading ? "…" : "—")}</p>
                    {item?.error && <p className="mt-2 text-xs text-amber-700">Restricted or unavailable</p>}
                  </button>;
                })}
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border bg-background p-5"><div className="flex items-center gap-2"><ClipboardCheck className="size-5 text-primary" /><h3 className="font-bold">Operational queues</h3></div><p className="mt-1 text-sm text-muted-foreground">Go directly to the areas requiring review.</p><div className="mt-4 space-y-2">
                  {[["verification", "Review verification records", "Identity, skills, teams and businesses", ShieldCheck], ["opportunities", "Review work listings", "Opportunity quality and application activity", BriefcaseBusiness], ["payments", "Resolve payment disputes", "Review evidence and record an auditable outcome", ShieldAlert]].map(([id, title, desc, Icon]) => { const I = Icon as typeof ShieldCheck; return <button key={String(id)} onClick={() => setSection(id as Section)} className="flex w-full items-center gap-3 rounded-xl border p-3 text-left hover:bg-muted/50"><I className="size-4 shrink-0 text-primary" /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{String(title)}</span><span className="block text-xs text-muted-foreground">{String(desc)}</span></span><ChevronRight className="size-4 text-muted-foreground" /></button>; })}
                </div></div>
                <div className="rounded-2xl border bg-background p-5"><div className="flex items-center gap-2"><Activity className="size-5 text-primary" /><h3 className="font-bold">Trust & safety checklist</h3></div><div className="mt-4 space-y-3 text-sm">
                  {[["Admin access", "This screen checks the signed-in account's admin role.", CheckCircle2], ["Payment integrity", "Only provider-verified results should become paid.", ShieldCheck], ["Review traceability", "Use the dedicated review/resolution workflows.", ClipboardCheck], ["Data integrity", "Metrics are based on database records, not invented totals.", Activity]].map(([title, desc, Icon]) => { const I = Icon as typeof CheckCircle2; return <div key={String(title)} className="flex gap-3"><I className="mt-0.5 size-4 shrink-0 text-emerald-600" /><div><p className="font-medium">{String(title)}</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">{String(desc)}</p></div></div>; })}
                </div></div>
              </div>
            </>
          )}

          {currentTables.length > 0 && (
            <section className="space-y-4">
              <div><h2 className="text-2xl font-bold">{SECTIONS.find((item) => item.id === section)?.label}</h2><p className="mt-1 text-sm text-muted-foreground">{SECTIONS.find((item) => item.id === section)?.description}. Records are loaded from Supabase and remain subject to database policies.</p></div>
              <div className="flex flex-col gap-3 rounded-2xl border bg-background p-3 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search records by name, status, ID or details…" className="pl-9" /></div>
                <label className="flex items-center gap-2 text-sm"><Filter className="size-4 text-muted-foreground" /><span className="sr-only">Record type</span><select aria-label="Record type" value={activeTable} onChange={(e) => setSelectedTable(e.target.value)} className="h-10 min-w-40 rounded-xl border bg-background px-3 text-sm">{currentTables.map((entry) => <option key={entry.table} value={entry.table}>{entry.title}</option>)}</select></label>
                <Button size="sm" variant="outline" onClick={() => void rowsQuery.refetch()} disabled={rowsQuery.isFetching}><RefreshCw className={`mr-2 size-4 ${rowsQuery.isFetching ? "animate-spin" : ""}`} />Reload</Button>
              </div>
              <div className="rounded-2xl border bg-background">
                <div className="border-b px-5 py-4"><div className="font-semibold">{currentTables.find((entry) => entry.table === activeTable)?.title}</div><p className="mt-1 text-xs text-muted-foreground">{currentTables.find((entry) => entry.table === activeTable)?.description} · showing up to 100 records</p></div>
                {rowsQuery.isLoading ? <div className="space-y-3 p-5">{[1, 2, 3, 4].map((n) => <div key={n} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>
                  : rowsQuery.isError ? <div className="p-8 text-center"><AlertTriangle className="mx-auto size-7 text-amber-600" /><p className="mt-3 font-semibold">Records could not be loaded</p><p className="mt-1 text-sm text-muted-foreground">The table may be restricted by row-level security or unavailable to this project role.</p><Button className="mt-4" size="sm" variant="outline" onClick={() => void rowsQuery.refetch()}>Try again</Button></div>
                  : filteredRows.length === 0 ? <div className="p-10 text-center"><Search className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 font-semibold">{search ? "No matching records" : "No records found"}</p><p className="mt-1 text-sm text-muted-foreground">{search ? "Try a different search term." : "This table currently has no records visible to your account."}</p></div>
                  : <div className="divide-y">{filteredRows.map((row, index) => {
                    const primary = displayTitle(row, `Record ${index + 1}`);
                    const fields = Object.entries(row).filter(([key, value]) => value !== null && value !== undefined && value !== "" && !["password", "password_hash", "access_token", "refresh_token", "secret"].includes(key.toLowerCase())).slice(0, 6);
                    const status = asText(row["status"] ?? row["verification_status"] ?? row["verified"] ?? "");
                    const tone = /reject|failed|suspend|fraud|open|pending/i.test(status) ? "border-amber-200 bg-amber-50 text-amber-800" : /verified|approved|paid|completed|resolved|active/i.test(status) ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-border bg-muted/40 text-muted-foreground";
                    return <article key={asText(row["id"] ?? row["user_id"] ?? index)} className="p-4 sm:px-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-semibold">{primary}</p><p className="mt-1 break-all text-xs text-muted-foreground">{asText(row["email"] ?? row["phone"] ?? row["user_id"] ?? row["id"])}</p></div>{status !== "—" && <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>{status.replaceAll("_", " ")}</span>}</div><div className="mt-3 grid gap-x-5 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">{fields.filter(([key]) => !["id", "display_name", "title", "name", "business_name", "full_name"].includes(key)).slice(0, 5).map(([key, value]) => <div key={key} className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{prettyKey(key)}</p><p className="mt-0.5 break-words text-xs">{asText(value).slice(0, 180)}</p></div>)}</div></article>;
                  })}</div>}
                {!rowsQuery.isLoading && !rowsQuery.isError && <div className="border-t px-5 py-3 text-xs text-muted-foreground">Showing {filteredRows.length} of {(rowsQuery.data ?? []).length} loaded records. This view is for operational review; changes must use authorized workflows.</div>}
              </div>
            </section>
          )}

          {section === "payments" && <div className="space-y-4"><div><h2 className="text-2xl font-bold">Payment operations</h2><p className="mt-1 text-sm text-muted-foreground">Inspect transaction records and resolve disputes using the existing secured administrative workflow.</p></div><PaymentDisputesAdmin /></div>}

          {section === "reports" && <section className="space-y-4"><div><h2 className="text-2xl font-bold">Reports & economic insights</h2><p className="mt-1 text-sm text-muted-foreground">Platform indicators sourced from live records. These counts are operational totals, not national economic statistics.</p></div><div className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl border bg-background p-5"><h3 className="font-bold">Activity by data domain</h3><div className="mt-4 space-y-4">{(counts.data ?? []).map((item) => <div key={item.table}><div className="flex justify-between gap-3 text-sm"><span>{item.label}</span><span className="font-semibold tabular-nums">{item.count === null ? "Unavailable" : item.count.toLocaleString()}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, item.count ?? 0))}%` }} /></div></div>)}</div></div><div className="rounded-2xl border bg-background p-5"><h3 className="font-bold">Reporting standards</h3><ul className="mt-3 space-y-3 text-sm text-muted-foreground"><li>• Use completed and verified project records for impact reporting.</li><li>• Aggregate worker-level information before institutional sharing.</li><li>• Segment by district and sector only when source records contain those fields.</li><li>• Never label demo data or incomplete payment intents as confirmed economic impact.</li></ul><Button asChild variant="outline" className="mt-5"><Link to="/insights">Open economic insights <ChevronRight className="ml-1 size-4" /></Link></Button></div></div></section>}

          {section === "settings" && <section className="space-y-4"><div><h2 className="text-2xl font-bold">System & security</h2><p className="mt-1 text-sm text-muted-foreground">Readiness checks and secure operational guidance.</p></div><div className="rounded-2xl border bg-background p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 text-primary" /><div><h3 className="font-bold">Current administrator session</h3><p className="mt-1 text-sm text-muted-foreground">Role membership is read from the signed-in user's database-backed roles. This console does not grant administrator privileges or expose service-role credentials.</p><dl className="mt-4 grid gap-3 sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Account</dt><dd className="mt-1 break-all text-sm font-medium">{user.email ?? user.id}</dd></div><div><dt className="text-xs text-muted-foreground">Authorized roles</dt><dd className="mt-1 text-sm font-medium">{user.roles.join(", ")}</dd></div><div><dt className="text-xs text-muted-foreground">Profile</dt><dd className="mt-1 text-sm font-medium">{user.name}</dd></div><div><dt className="text-xs text-muted-foreground">District</dt><dd className="mt-1 text-sm font-medium">{user.district || "Not specified"}</dd></div></dl></div></div></div><div className="rounded-2xl border bg-background p-5"><h3 className="font-bold">Operational safeguards</h3><div className="mt-4 grid gap-3 sm:grid-cols-2">{[["Role-based access", "Only a database-assigned admin role can open this page."], ["Row-level security", "Database policies remain authoritative; denied queries are shown as errors."], ["Payments", "Only provider-verified payment status should be treated as paid."], ["Dispute decisions", "Use the payment dispute RPC to preserve notifications and decision records."], ["Personal data", "Access member information only for a legitimate operational purpose."], ["Secrets", "Never place provider keys or service-role keys in browser code."]].map(([title, desc]) => <div key={title} className="rounded-xl border p-3"><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{desc}</p></div>)}</div></div><div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-5 text-amber-950"><div className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><div><p className="text-sm font-semibold">Configuration changes are not exposed here yet</p><p className="mt-1 text-xs leading-5">Sensitive settings such as role grants, auth policy, provider credentials and global moderation rules must be managed through audited server-side controls. This console intentionally avoids direct client-side privilege changes.</p></div></div></div></section>}
        </main>
      </div>
    </div>
  );
}

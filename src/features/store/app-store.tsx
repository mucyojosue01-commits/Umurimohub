import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Opportunity } from "@/features/data/demo";
import { useCatalog } from "@/features/data/catalog";

export type Role = "worker" | "team_lead" | "business" | "learner" | "admin" | "institution";
export type User = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: Role;
  roles: Role[];
  district: string;
  skills: string[];
  verifiedPhone: boolean;
  workerId: string | null;
  businessIds: string[];
  leadTeamIds: string[];
  onboarded: boolean;
};
export type Application = {
  id: string;
  oppId: string;
  kind: "Individual" | "Team" | "Referral" | "Invitation" | "Rehire";
  status: string;
  note: string;
  at: string;
  teamId?: string | null;
};
export type Msg = {
  id: string;
  thread: string;
  from: "me" | "them";
  text: string;
  at: string;
  ref?: string;
};
export type Notif = { id: string; text: string; at: string; read: boolean; kind: string };
export type Milestone = {
  id: string;
  title: string;
  amount: number;
  status: "Pending" | "In progress" | "Submitted" | "Approved" | "Paid";
};

// Local-only demo state (messages, notifications, milestones) until those slices ship.
type LocalState = {
  messages: Msg[];
  notifications: Notif[];
  milestones: Milestone[];
  demoApplications: Application[];
  demoSaved: string[];
};

const initial: LocalState = {
  demoApplications: [],
  demoSaved: [],
  messages: [
    {
      id: "m1",
      thread: "Inzira Homes Ltd (demo)",
      from: "them",
      text: "Hello! We saw your crew's profile. Are you available from 1 Nov?",
      at: "09:12",
      ref: "o1",
    },
    {
      id: "m2",
      thread: "Ubumwe Builders Crew",
      from: "them",
      text: "Team, site visit Thursday 8am in Kinyinya.",
      at: "Yesterday",
    },
    {
      id: "m3",
      thread: "Kivu Hills Coffee Coop (demo)",
      from: "them",
      text: "Weekly payment for 12–18 Oct is approved.",
      at: "Mon",
    },
  ],
  notifications: [
    {
      id: "n1",
      text: "New matching opportunity: Solar install for 3 rural schools",
      at: "1h",
      read: false,
      kind: "match",
    },
    {
      id: "n2",
      text: "Inzira Homes viewed your application",
      at: "3h",
      read: false,
      kind: "viewed",
    },
    {
      id: "n3",
      text: "Milestone 1 payment approved — RWF 960,000",
      at: "1d",
      read: true,
      kind: "payment",
    },
    {
      id: "n4",
      text: "Aline Uwase recommended you for Masonry",
      at: "2d",
      read: true,
      kind: "recommendation",
    },
  ],
  milestones: [
    { id: "ms1", title: "Foundation & slab", amount: 960000, status: "Paid" },
    { id: "ms2", title: "Walls to ring beam", amount: 1440000, status: "In progress" },
    { id: "ms3", title: "Roofing structure", amount: 1200000, status: "Pending" },
    { id: "ms4", title: "Finishing & handover", amount: 1200000, status: "Pending" },
  ],
};

export type NewOpportunity = Omit<Opportunity, "id" | "businessId" | "posted" | "featured">;

type Ctx = Omit<LocalState, "demoApplications" | "demoSaved"> & {
  user: User | null;
  session: Session | null;
  authReady: boolean;
  applications: Application[];
  saved: string[];
  allOpps: Opportunity[];
  signOut: () => Promise<void>;
  reloadUser: () => Promise<void>;
  apply: (a: {
    oppId: string;
    kind: Application["kind"];
    note: string;
    teamId?: string | null;
  }) => Promise<{ ok: boolean; error?: string }>;
  refer: (
    oppId: string,
    workerId: string,
    note: string,
  ) => Promise<{ ok: boolean; error?: string }>;
  send: (thread: string, text: string) => void;
  markAllRead: () => void;
  createOpp: (o: NewOpportunity) => Promise<{ id?: string; error?: string }>;
  toggleSave: (id: string) => void;
  advanceMilestone: (id: string) => void;
};

const AppCtx = createContext<Ctx | null>(null);
const KEY = "umurimohub-demo-v2";
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function applicationErrorMessage(error: { code?: string; message?: string }) {
  if (error.code === "23505") return "You've already applied to this opportunity.";
  if (error.code === "23503") return "This opportunity is no longer available.";
  return error.message ?? "Couldn't submit the application.";
}

async function loadUser(session: Session): Promise<User> {
  const uid = session.user.id;
  const [p, r, w, bm, t] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", uid),
    supabase.from("worker_profiles").select("id, district").eq("user_id", uid).maybeSingle(),
    supabase.from("business_members").select("business_id").eq("user_id", uid),
    supabase.from("teams").select("id").eq("lead_user_id", uid),
  ]);
  const roles = (r.data ?? []).map((x) => x.role as Role);
  let skills: string[] = [];
  if (w.data)
    skills = (
      (await supabase.from("worker_skills").select("name").eq("worker_id", w.data.id)).data ?? []
    ).map((s) => s.name);
  const order: Role[] = ["admin", "institution", "business", "team_lead", "worker", "learner"];
  return {
    id: uid,
    ...(session.user.email ? { email: session.user.email } : {}),
    name:
      p.data?.display_name ??
      (session.user.user_metadata?.["full_name"] as string | undefined) ??
      session.user.email?.split("@")[0] ??
      "Member",
    phone: p.data?.phone ?? "",
    district: p.data?.district ?? w.data?.district ?? "",
    verifiedPhone: !!p.data?.phone_verified,
    roles,
    role: order.find((o) => roles.includes(o)) ?? "worker",
    skills,
    workerId: w.data?.id ?? null,
    businessIds: (bm.data ?? []).map((x) => x.business_id),
    leadTeamIds: (t.data ?? []).map((x) => x.id),
    onboarded: !!p.data && roles.length > 0,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { opportunities, refresh } = useCatalog();
  const [s, setS] = useState<LocalState>(initial);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [dbApps, setDbApps] = useState<Application[]>([]);
  const [dbSaved, setDbSaved] = useState<string[]>([]);
  const [dbNotifs, setDbNotifs] = useState<Notif[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setS({ ...initial, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  }, [s]);

  const loadPersonal = useCallback(async (sess: Session | null) => {
    if (!sess) {
      setUser(null);
      setDbApps([]);
      setDbSaved([]);
      setDbNotifs([]);
      return;
    }
    const [u, a, sv, ns] = await Promise.all([
      loadUser(sess),
      supabase
        .from("applications")
        .select("*")
        .eq("applicant_user_id", sess.user.id)
        .order("created_at", { ascending: false }),
      supabase.from("saved_opportunities").select("opportunity_id").eq("user_id", sess.user.id),
      supabase
        .from("notifications")
        .select("id,text,created_at,read,kind")
        .eq("user_id", sess.user.id)
        .order("created_at", { ascending: false }),
    ]);
    setUser(u);
    setDbApps(
      (a.data ?? []).map((x) => ({
        id: x.id,
        oppId: x.opportunity_id,
        kind: x.kind as Application["kind"],
        status: cap(x.status),
        note: x.note,
        at: new Date(x.created_at).toLocaleDateString(),
        teamId: x.team_id,
      })),
    );
    setDbSaved((sv.data ?? []).map((x) => x.opportunity_id));
    setDbNotifs(
      (ns.data ?? []).map((n) => ({
        id: n.id,
        text: n.text,
        at: new Date(n.created_at).toLocaleString(),
        read: n.read,
        kind: n.kind,
      })),
    );
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setTimeout(() => {
          void loadPersonal(sess);
        }, 0);
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadPersonal(data.session);
      setAuthReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadPersonal]);

  const notify = (text: string, kind: string): Notif => ({
    id: crypto.randomUUID(),
    text,
    at: "now",
    read: false,
    kind,
  });
  const order: Milestone["status"][] = ["Pending", "In progress", "Submitted", "Approved", "Paid"];
  const push = (n: Notif) => setS((p) => ({ ...p, notifications: [n, ...p.notifications] }));

  const value: Ctx = {
    messages: s.messages,
    notifications: session ? [...dbNotifs, ...s.notifications] : s.notifications,
    milestones: s.milestones,
    user,
    session,
    authReady,
    applications: session ? dbApps : s.demoApplications,
    saved: session ? dbSaved : s.demoSaved,
    allOpps: opportunities,
    reloadUser: () => loadPersonal(session),
    signOut: async () => {
      await qc.cancelQueries();
      await supabase.auth.signOut();
      setUser(null);
      void refresh();
    },
    apply: async (a) => {
      if (!session) {
        setS((p) => ({
          ...p,
          demoApplications: [
            {
              ...a,
              id: crypto.randomUUID(),
              status: "Submitted",
              at: new Date().toLocaleDateString(),
            },
            ...p.demoApplications,
          ],
        }));
        push(
          notify(`Demo application saved on this device (${a.kind.toLowerCase()})`, "application"),
        );
        return { ok: true };
      }
      // Validate against the canonical database before inserting. The FK remains
      // authoritative, but this prevents a stale/demo catalog entry from surfacing
      // as a raw Postgres foreign-key error in the UI.
      const { data: opportunity, error: opportunityLookupError } = await supabase
        .from("opportunities")
        .select("id,status")
        .eq("id", a.oppId)
        .maybeSingle();
      if (opportunityLookupError)
        return { ok: false, error: "We couldn't verify this opportunity. Please try again." };
      if (!opportunity || opportunity.status !== "open")
        return { ok: false, error: "This opportunity is no longer available." };

      const { error } = await supabase.from("applications").insert({
        opportunity_id: a.oppId,
        applicant_user_id: session.user.id,
        kind: a.kind,
        note: a.note.slice(0, 2000),
        team_id: a.teamId ?? null,
      });
      if (error)
        return {
          ok: false,
          error: applicationErrorMessage(error),
        };
      push(notify(`Application sent (${a.kind.toLowerCase()})`, "application"));
      await loadPersonal(session);
      return { ok: true };
    },
    refer: async (oppId, workerId, note) => {
      if (!session) return { ok: false, error: "Sign in to refer someone." };
      const { error } = await supabase.from("referrals").insert({
        referrer: session.user.id,
        referee_worker_id: workerId,
        opportunity_id: oppId,
        note: note.slice(0, 500),
      });
      if (error)
        return {
          ok: false,
          error:
            error.code === "23505" ? "You've already referred this person here." : error.message,
        };
      push(notify("Referral sent", "recommendation"));
      return { ok: true };
    },
    send: (thread, text) =>
      setS((p) => ({
        ...p,
        messages: [...p.messages, { id: crypto.randomUUID(), thread, from: "me", text, at: "now" }],
      })),
    markAllRead: () => {
      setS((p) => ({ ...p, notifications: p.notifications.map((n) => ({ ...n, read: true })) }));
      if (session) {
        setDbNotifs((p) => p.map((n) => ({ ...n, read: true })));
        void supabase
          .from("notifications")
          .update({ read: true })
          .eq("user_id", session.user.id)
          .eq("read", false);
      }
    },
    createOpp: async (o) => {
      if (!session || !user) return { error: "Sign in with a business account to publish." };
      const businessId = user.businessIds[0];
      if (!businessId) return { error: "Create your business profile first (onboarding)." };
      const { data, error } = await supabase
        .from("opportunities")
        .insert({
          business_id: businessId,
          created_by: session.user.id,
          title: o.title,
          sector: o.sector,
          district: o.district,
          type: o.type,
          pay_rwf: Math.round(o.payRwf),
          pay_unit: o.payUnit,
          mode: o.mode,
          duration: o.duration,
          deadline: o.deadline,
          team_allowed: o.teamAllowed,
          team_size: o.teamAllowed ? (o.teamSize ?? null) : null,
          skills: o.skills,
          summary: o.summary,
          responsibilities: o.responsibilities,
          requirements: o.requirements,
          status: "open",
        })
        .select("id")
        .single();
      if (error) return { error: error.message };
      push(notify(`Opportunity published: ${o.title}`, "match"));
      await refresh();
      return { id: data.id };
    },
    toggleSave: (id) => {
      if (!session) {
        setS((p) => ({
          ...p,
          demoSaved: p.demoSaved.includes(id)
            ? p.demoSaved.filter((x) => x !== id)
            : [...p.demoSaved, id],
        }));
        return;
      }
      const on = dbSaved.includes(id);
      setDbSaved((p) => (on ? p.filter((x) => x !== id) : [...p, id]));
      void (on
        ? supabase
            .from("saved_opportunities")
            .delete()
            .eq("user_id", session.user.id)
            .eq("opportunity_id", id)
        : supabase
            .from("saved_opportunities")
            .insert({ user_id: session.user.id, opportunity_id: id }));
    },
    advanceMilestone: (id) =>
      setS((p) => ({
        ...p,
        milestones: p.milestones.map((m): Milestone =>
          m.id === id
            ? {
                ...m,
                status: order[Math.min(order.indexOf(m.status) + 1, order.length - 1)] ?? m.status,
              }
            : m,
        ),
      })),
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}

import { db } from "@/lib/pending-db";
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
  avatarUrl: string | null;
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
export type Notif = { id: string; text: string; at: string; read: boolean; kind: string; link?: string | null };
export type NewOpportunity = Omit<Opportunity, "id" | "businessId" | "posted" | "featured"> & { businessId?: string };

type Ctx = {
  user: User | null;
  session: Session | null;
  authReady: boolean;
  applications: Application[];
  saved: string[];
  allOpps: Opportunity[];
  messages: Msg[];
  notifications: Notif[];
  milestones: never[];
  signOut: () => Promise<void>;
  reloadUser: () => Promise<void>;
  apply: (a: {
    oppId: string;
    kind: Application["kind"];
    note: string;
    teamId?: string | null;
  }) => Promise<{ ok: boolean; error?: string }>;
  refer: (oppId: string, workerId: string, note: string) => Promise<{ ok: boolean; error?: string }>;
  send: (thread: string, text: string) => void;
  markAllRead: () => void;
  createOpp: (o: NewOpportunity) => Promise<{ id?: string; error?: string }>;
  toggleSave: (id: string) => void;
  advanceMilestone: (id: string) => void;
};

const AppCtx = createContext<Ctx | null>(null);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function applicationErrorMessage(error: { code?: string; message?: string }) {
  if (error.code === "23505") return "You've already applied to this opportunity.";
  if (error.code === "23503") return "This opportunity is no longer available.";
  if (error.code === "42501") return "You are not authorized to do that.";
  return error.message ?? "Couldn't submit the application.";
}

async function loadUser(session: Session): Promise<User> {
  const uid = session.user.id;
  const [p, r, w, bm, t] = await Promise.all([
    db.from("profiles").select("*").eq("id", uid).maybeSingle(),
    db.from("user_roles").select("role").eq("user_id", uid),
    db.from("worker_profiles").select("id, district").eq("user_id", uid).maybeSingle(),
    db.from("business_members").select("business_id").eq("user_id", uid),
    db.from("teams").select("id").eq("lead_user_id", uid),
  ]);
  const roles = (r.data ?? []).map((x) => x.role as Role);
  let skills: string[] = [];
  if (w.data) {
    const result = await db.from("worker_skills").select("name").eq("worker_id", w.data.id);
    skills = (result.data ?? []).map((s) => s.name);
  }
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
    avatarUrl: (p.data as { avatar_url?: string | null } | null)?.avatar_url ?? null,
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
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [dbApps, setDbApps] = useState<Application[]>([]);
  const [dbSaved, setDbSaved] = useState<string[]>([]);
  const [dbNotifs, setDbNotifs] = useState<Notif[]>([]);

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
      db.from("saved_opportunities").select("opportunity_id").eq("user_id", sess.user.id),
      supabase
        .from("notifications")
        .select("id,text,created_at,read,kind,link")
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
        link: n.link,
      })),
    );
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setTimeout(() => void loadPersonal(sess), 0);
      }
    });
    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadPersonal(data.session);
      setAuthReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadPersonal]);

  useEffect(() => {
    if (!session) return;
    const channel = supabase
      .channel("user-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${session.user.id}` },
        () => void loadPersonal(session),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session, loadPersonal]);

  const value: Ctx = {
    user,
    session,
    authReady,
    applications: dbApps,
    saved: dbSaved,
    allOpps: opportunities,
    messages: [],
    notifications: dbNotifs,
    milestones: [],
    reloadUser: () => loadPersonal(session),
    signOut: async () => {
      await qc.cancelQueries();
      await supabase.auth.signOut();
      setUser(null);
      void refresh();
    },
    apply: async (a) => {
      if (!session) return { ok: false, error: "Sign in to apply for opportunities." };
      const { data: opportunity, error: lookupError } = await supabase
        .from("opportunities")
        .select("id,status")
        .eq("id", a.oppId)
        .maybeSingle();
      if (lookupError) return { ok: false, error: "We couldn't verify this opportunity. Please try again." };
      if (!opportunity || opportunity.status !== "open")
        return { ok: false, error: "This opportunity is no longer available." };
      const { error } = await db.from("applications").insert({
        opportunity_id: a.oppId,
        applicant_user_id: session.user.id,
        kind: a.kind,
        note: a.note.slice(0, 2000),
        team_id: a.teamId ?? null,
      });
      if (error) return { ok: false, error: applicationErrorMessage(error) };
      await loadPersonal(session);
      return { ok: true };
    },
    refer: async (oppId, workerId, note) => {
      if (!session) return { ok: false, error: "Sign in to refer someone." };
      const { error } = await db.from("referrals").insert({
        referrer: session.user.id,
        referee_worker_id: workerId,
        opportunity_id: oppId,
        note: note.slice(0, 500),
      });
      if (error) {
        if (error.code === "23505") return { ok: false, error: "You've already referred this person here." };
        if (error.code === "42501") return { ok: false, error: "You cannot refer this person for this opportunity." };
        return { ok: false, error: "We couldn't send the referral. Please try again." };
      }
      await loadPersonal(session);
      return { ok: true };
    },
    send: () => {
      // Legacy store API; live messaging is implemented by src/routes/messages.tsx.
      // Keeping this compatibility hook prevents older UI consumers from crashing.
    },
    markAllRead: () => {
      if (session) void db.rpc("mark_all_notifications_read").then(() => loadPersonal(session));
    },
    createOpp: async (o) => {
      if (!session || !user) return { error: "Sign in with a business account to publish." };
      const businessId = o.businessId ?? user.businessIds[0];
      if (!businessId) return { error: "Create your business profile first." };
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
          is_demo: false,
        })
        .select("id")
        .single();
      if (error) {
        if (error.code === "42501") return { error: "Your business account is not authorized to publish for this business." };
        if (error.code === "23503") return { error: "The selected business no longer exists." };
        return { error: "We couldn't publish this opportunity. Please check the details and try again." };
      }
      await refresh();
      return { id: data.id };
    },
    toggleSave: (id) => {
      if (!session) return;
      const on = dbSaved.includes(id);
      setDbSaved((p) => (on ? p.filter((x) => x !== id) : [...p, id]));
      void (on
        ? db.from("saved_opportunities").delete().eq("user_id", session.user.id).eq("opportunity_id", id)
        : db.from("saved_opportunities").insert({ user_id: session.user.id, opportunity_id: id }));
    },
    advanceMilestone: () => undefined,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const value = useContext(AppCtx);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}

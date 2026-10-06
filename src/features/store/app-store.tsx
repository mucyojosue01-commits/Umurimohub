import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { OPPORTUNITIES, type Opportunity } from "@/features/data/demo";

export type Role = "worker" | "team" | "business" | "admin";
export type User = { name: string; phone: string; email?: string; role: Role; district: string; skills: string[]; verifiedPhone: boolean };
export type Application = { id: string; oppId: string; kind: "Individual" | "Team" | "Referral" | "Invitation" | "Rehire"; status: "Submitted" | "Viewed" | "Shortlisted" | "Accepted"; note: string; at: string };
export type Msg = { id: string; thread: string; from: "me" | "them"; text: string; at: string; ref?: string };
export type Notif = { id: string; text: string; at: string; read: boolean; kind: string };
export type Milestone = { id: string; title: string; amount: number; status: "Pending" | "In progress" | "Submitted" | "Approved" | "Paid" };

type State = {
  user: User | null; applications: Application[]; messages: Msg[]; notifications: Notif[];
  created: Opportunity[]; saved: string[]; milestones: Milestone[];
};

const initial: State = {
  user: null, applications: [], created: [], saved: [],
  messages: [
    { id: "m1", thread: "Inzira Homes Ltd (demo)", from: "them", text: "Hello! We saw your crew's profile. Are you available from 1 Nov?", at: "09:12", ref: "o1" },
    { id: "m2", thread: "Ubumwe Builders Crew", from: "them", text: "Team, site visit Thursday 8am in Kinyinya.", at: "Yesterday" },
    { id: "m3", thread: "Kivu Hills Coffee Coop (demo)", from: "them", text: "Weekly payment for 12–18 Oct is approved.", at: "Mon" },
  ],
  notifications: [
    { id: "n1", text: "New matching opportunity: Solar install for 3 rural schools", at: "1h", read: false, kind: "match" },
    { id: "n2", text: "Inzira Homes viewed your application", at: "3h", read: false, kind: "viewed" },
    { id: "n3", text: "Milestone 1 payment approved — RWF 960,000", at: "1d", read: true, kind: "payment" },
    { id: "n4", text: "Aline Uwase recommended you for Masonry", at: "2d", read: true, kind: "recommendation" },
  ],
  milestones: [
    { id: "ms1", title: "Foundation & slab", amount: 960000, status: "Paid" },
    { id: "ms2", title: "Walls to ring beam", amount: 1440000, status: "In progress" },
    { id: "ms3", title: "Roofing structure", amount: 1200000, status: "Pending" },
    { id: "ms4", title: "Finishing & handover", amount: 1200000, status: "Pending" },
  ],
};

type Ctx = State & {
  setUser: (u: User | null) => void;
  apply: (a: Omit<Application, "id" | "status" | "at">) => void;
  send: (thread: string, text: string) => void;
  markAllRead: () => void;
  createOpp: (o: Opportunity) => void;
  toggleSave: (id: string) => void;
  advanceMilestone: (id: string) => void;
  allOpps: Opportunity[];
};

const AppCtx = createContext<Ctx | null>(null);
const KEY = "umurimohub-demo-v1";

export function AppProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<State>(initial);
  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setS({ ...initial, ...JSON.parse(raw) }); } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }, [s]);

  const notify = (text: string, kind: string) => ({ id: crypto.randomUUID(), text, at: "now", read: false, kind });
  const order: Milestone["status"][] = ["Pending", "In progress", "Submitted", "Approved", "Paid"];

  const value: Ctx = {
    ...s,
    allOpps: [...s.created, ...OPPORTUNITIES],
    setUser: (user) => setS((p) => ({ ...p, user })),
    apply: (a) => setS((p) => ({ ...p,
      applications: [{ ...a, id: crypto.randomUUID(), status: "Submitted", at: new Date().toLocaleDateString() }, ...p.applications],
      notifications: [notify(`Application sent (${a.kind.toLowerCase()})`, "application"), ...p.notifications] })),
    send: (thread, text) => setS((p) => ({ ...p, messages: [...p.messages, { id: crypto.randomUUID(), thread, from: "me", text, at: "now" }] })),
    markAllRead: () => setS((p) => ({ ...p, notifications: p.notifications.map((n) => ({ ...n, read: true })) })),
    createOpp: (o) => setS((p) => ({ ...p, created: [o, ...p.created], notifications: [notify(`Opportunity published: ${o.title}`, "match"), ...p.notifications] })),
    toggleSave: (id) => setS((p) => ({ ...p, saved: p.saved.includes(id) ? p.saved.filter((x) => x !== id) : [...p.saved, id] })),
    advanceMilestone: (id) => setS((p) => ({ ...p, milestones: p.milestones.map((m) => m.id === id ? { ...m, status: order[Math.min(order.indexOf(m.status) + 1, 4)] } : m) })),
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}

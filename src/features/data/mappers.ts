// Pure mappers: database rows -> UI shapes used by existing components.
// Keeping the UI types stable means pages don't change when the source changes.
import type { Tables } from "@/integrations/supabase/types";
import type {
  Business,
  Opportunity,
  Rep,
  Sector,
  SkillLevel,
  Team,
  Verification,
  Worker,
} from "./demo";

export type Catalog = {
  workers: Worker[];
  teams: Team[];
  businesses: Business[];
  opportunities: Opportunity[];
  workerUserIds: Record<string, string | null>; // worker id -> account id
  source: "database";
};

const emptyRep: Rep = {
  completion: 0,
  onTime: 0,
  repeat: 0,
  verifiedProjects: 0,
  skillsVerified: 0,
  recommendations: 0,
  response: 0,
};

export function relTime(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1) return "today";
  if (d < 7) return `${Math.floor(d)}d`;
  return `${Math.floor(d / 7)}w`;
}

export function mapWorker(
  w: Tables<"worker_profiles">,
  skills: Tables<"worker_skills">[],
  members: Tables<"team_members">[],
): Worker {
  return {
    id: w.id,
    name: w.name,
    title: w.title,
    district: w.district,
    sector: w.sector as Sector,
    rateRwf: w.rate_rwf,
    rateUnit: w.rate_unit as Worker["rateUnit"],
    available: w.available,
    years: w.years,
    rating: Number(w.rating),
    reviews: w.reviews,
    verified: w.verified,
    initials:
      w.initials ||
      w.name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    skills: skills
      .filter((s) => s.worker_id === w.id)
      .map((s) => ({
        name: s.name,
        level: s.level as SkillLevel,
        verification: s.verification as Verification,
      })),
    bio: w.bio,
    rep: { ...emptyRep, ...((w.rep as Partial<Rep>) ?? {}) },
    teamIds: members
      .filter((m) => m.worker_id === w.id && m.status === "active")
      .map((m) => m.team_id),
  };
}

export function mapTeam(t: Tables<"teams">, members: Tables<"team_members">[]): Team {
  return {
    id: t.id,
    name: t.name,
    leadId: t.lead_worker_id ?? "",
    sector: t.sector as Sector,
    areas: t.areas,
    memberIds: members
      .filter((m) => m.team_id === t.id && m.status === "active")
      .map((m) => m.worker_id),
    rating: Number(t.rating),
    projects: t.projects,
    available: t.available,
    summary: t.summary,
    skills: t.skills,
  };
}

export function mapBusiness(b: Tables<"businesses">, opps: Tables<"opportunities">[]): Business {
  return {
    id: b.id,
    name: b.name,
    sector: b.sector as Sector,
    district: b.district,
    verified: b.verified,
    rating: Number(b.rating),
    about: b.about,
    services: b.services,
    hiring: opps.filter((o) => o.business_id === b.id && o.status === "open").length,
  };
}

export function mapOpportunity(o: Tables<"opportunities">): Opportunity {
  return {
    id: o.id,
    title: o.title,
    businessId: o.business_id,
    sector: o.sector as Sector,
    district: o.district,
    type: o.type as Opportunity["type"],
    payRwf: o.pay_rwf,
    payUnit: o.pay_unit as Opportunity["payUnit"],
    mode: o.mode as Opportunity["mode"],
    duration: o.duration,
    deadline: o.deadline,
    teamAllowed: o.team_allowed,
    ...(o.team_size ? { teamSize: o.team_size } : {}),
    skills: o.skills,
    summary: o.summary,
    responsibilities: o.responsibilities,
    requirements: o.requirements,
    featured: o.featured,
    posted: relTime(o.created_at),
  };
}

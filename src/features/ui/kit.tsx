import { Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Bookmark,
  Clock,
  MapPin,
  Star,
  Users,
  Building2,
  ShieldCheck,
  Info,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  rwf,
  trustScore,
  type Business,
  type Opportunity,
  type Team,
  type Worker,
} from "@/features/data/demo";
import { useCatalog } from "@/features/data/catalog";
import { useApp } from "@/features/store/app-store";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-2xl border bg-card p-5 shadow-soft", className)}>{children}</div>
  );
}

export function Pill({
  children,
  tone = "muted",
  className,
}: {
  children: ReactNode;
  tone?: "muted" | "primary" | "accent" | "success" | "warning";
  className?: string;
}) {
  const tones = {
    muted: "bg-muted text-muted-foreground",
    primary: "bg-secondary text-secondary-foreground",
    accent: "bg-accent/20 text-accent-foreground",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-accent-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function DemoNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border border-dashed bg-muted/60 px-3 py-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <Info className="mt-0.5 size-3.5 shrink-0" />
      <span>
        Demo data — names, businesses and figures shown are fictional samples for this prototype,
        not real statistics.
      </span>
    </div>
  );
}

export function Avatar({ initials, src, alt = "", size = "md" }: { initials: string; src?: string | null; alt?: string; size?: "sm" | "md" | "lg" }) {
  const s = { sm: "size-8 text-xs", md: "size-11 text-sm", lg: "size-20 text-2xl" }[size];
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-secondary font-display font-bold text-secondary-foreground ring-2 ring-card",
        s,
      )}
    >
      {src ? <img src={src} alt={alt} className="size-full object-cover" /> : initials}
    </div>
  );
}

export function AvatarGroup({ ids }: { ids: string[] }) {
  const { getWorker } = useCatalog();
  return (
    <div className="flex -space-x-2">
      {ids.map((id) => {
        const w = getWorker(id);
        return w ? <Avatar key={id} initials={w.initials} size="sm" /> : null;
      })}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  desc,
  actions,
}: {
  eyebrow?: string;
  title: string;
  desc?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 pb-8 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl font-extrabold md:text-4xl">{title}</h1>
        {desc && <p className="mt-3 text-muted-foreground">{desc}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4 text-primary" />
        {label}
      </div>
      <div className="mt-2 font-display text-2xl font-bold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  desc,
  action,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed p-10 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-secondary">
        <Icon className="size-5 text-primary" />
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{desc}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function TrustMeter({ w }: { w: Worker }) {
  const score = trustScore(w.rep);
  const rows: [string, number][] = [
    ["Completion", w.rep.completion],
    ["On time", w.rep.onTime],
    ["Response", w.rep.response],
  ];
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <ShieldCheck className="size-4 text-primary" />
          Trust score
        </span>
        <span className="font-display text-2xl font-bold">{score}</span>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map(([k, v]) => (
          <div key={k}>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{k}</span>
              <span>{v}%</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${v}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-lg bg-muted p-2">
          <div className="font-bold">{w.rep.repeat}</div>repeat employers
        </div>
        <div className="rounded-lg bg-muted p-2">
          <div className="font-bold">{w.rep.verifiedProjects}</div>verified projects
        </div>
        <div className="rounded-lg bg-muted p-2">
          <div className="font-bold">{w.rep.recommendations}</div>recommendations
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Calculated from track record, not star rating alone.
      </p>
    </div>
  );
}

export function OpportunityCard({ o }: { o: Opportunity }) {
  const { getBusiness, workers, workerUserIds } = useCatalog();
  const b = getBusiness(o.businessId);
  const author = o.authorType === "user" ? workers.find((w) => workerUserIds[w.id] === o.createdBy) : undefined;
  const { saved, toggleSave } = useApp();
  const isSaved = saved.includes(o.id);
  return (
    <Card className="group flex flex-col transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Pill tone="primary">{o.type}</Pill>
          {o.featured && <Pill tone="accent">Featured</Pill>}
          {o.teamAllowed && (
            <Pill>
              <Users className="size-3" />
              Teams welcome
            </Pill>
          )}
        </div>
        <button
          aria-label={isSaved ? "Unsave" : "Save"}
          onClick={() => toggleSave(o.id)}
          className="rounded-full p-1.5 hover:bg-muted"
        >
          <Bookmark className={cn("size-4", isSaved && "fill-primary text-primary")} />
        </button>
      </div>
      <Link
        to="/opportunities/$id"
        params={{ id: o.id }}
        className="mt-3 font-display text-lg font-bold leading-snug hover:text-primary"
      >
        {o.title}
      </Link>
      <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
        <Avatar
          initials={(author?.initials ?? b?.name ?? "U").slice(0, 2).toUpperCase()}
          src={author?.avatarUrl ?? b?.avatarUrl}
          alt={author?.name ?? b?.name ?? "Publisher"}
          size="sm"
        />
        <span>{author?.name ?? b?.name ?? "UmurimoHub member"}</span>
        {b?.verified && <BadgeCheck className="size-3.5 text-primary" />}
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{o.summary}</p>
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-sm">
        <span className="font-semibold">
          {rwf(o.payRwf)}
          <span className="font-normal text-muted-foreground"> / {o.payUnit}</span>
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <MapPin className="size-3.5" />
          {o.district}
        </span>
        <span className="flex items-center gap-1 text-muted-foreground">
          <Clock className="size-3.5" />
          {o.duration}
        </span>
      </div>
    </Card>
  );
}

export function WorkerCard({ w }: { w: Worker }) {
  return (
    <Link to="/workers/$id" params={{ id: w.id }} className="block">
      <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-lift">
        <div className="flex items-start gap-3">
          <Avatar initials={w.initials} src={w.avatarUrl} alt={w.name} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 font-semibold">
              {w.name}
              {w.verified && <BadgeCheck className="size-4 text-primary" />}
            </div>
            <div className="truncate text-sm text-muted-foreground">{w.title}</div>
          </div>
          <div className="text-right">
            <div className="font-display text-lg font-bold">{trustScore(w.rep)}</div>
            <div className="text-[10px] uppercase text-muted-foreground">trust</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {w.skills.map((s) => (
            <Pill key={s.name}>
              {s.name} · {s.level}
            </Pill>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="size-3.5" />
            {w.district}
          </span>
          <span className="flex items-center gap-1">
            <Star className="size-3.5 fill-accent text-accent" />
            {w.rating} ({w.reviews})
          </span>
          <span className="font-semibold">
            {rwf(w.rateRwf)}/{w.rateUnit}
          </span>
        </div>
        {w.knownBy && (
          <div className="mt-3 rounded-lg bg-secondary px-2.5 py-1.5 text-xs text-secondary-foreground">
            {w.knownBy}
          </div>
        )}
        <div className="mt-3">
          {w.available ? <Pill tone="success">Available now</Pill> : <Pill>Booked</Pill>}
        </div>
      </Card>
    </Link>
  );
}

export function TeamCard({ t }: { t: Team }) {
  return (
    <Link to="/teams/$id" params={{ id: t.id }} className="block">
      <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-lift">
        <div className="flex items-center justify-between">
          <Pill tone="primary">{t.sector}</Pill>
          {t.available ? <Pill tone="success">Available</Pill> : <Pill>Booked</Pill>}
        </div>
        <div className="mt-3 flex items-center gap-3"><Avatar initials={t.name.slice(0,2).toUpperCase()} src={t.avatarUrl} alt={t.name} /><h3 className="font-display text-lg font-bold">{t.name}</h3></div>
        <p className="mt-1 text-sm text-muted-foreground">{t.summary}</p>
        <div className="mt-4 flex items-center justify-between">
          <AvatarGroup ids={t.memberIds} />
          <span className="flex items-center gap-1 text-sm">
            <Star className="size-3.5 fill-accent text-accent" />
            {t.rating} · {t.projects} projects
          </span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Serves {t.areas.join(", ")}</p>
      </Card>
    </Link>
  );
}

export function BusinessCard({ b }: { b: Business }) {
  return (
    <Link to="/businesses/$id" params={{ id: b.id }} className="block h-full">
    <Card className="h-full">
      <div className="flex items-center gap-3">
        <Avatar initials={b.name.slice(0,2).toUpperCase()} src={b.avatarUrl} alt={b.name} size="md" />
        <div>
          <div className="flex items-center gap-1 font-semibold">
            {b.name}
            {b.verified && <BadgeCheck className="size-4 text-primary" />}
          </div>
          <div className="text-sm text-muted-foreground">
            {b.sector} · {b.district}
          </div>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{b.about}</p>
      <div className="mt-4 flex justify-between text-sm">
        <span>{b.hiring} open roles</span>
        <span className="flex items-center gap-1">
          <Star className="size-3.5 fill-accent text-accent" />
          {b.rating}
        </span>
      </div>
    </Card>
    </Link>
  );
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            className={cn(
              "grid size-7 place-items-center rounded-full text-xs font-bold",
              i <= current
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {i + 1}
          </span>
          <span
            className={cn("text-sm", i === current ? "font-semibold" : "text-muted-foreground")}
          >
            {s}
          </span>
          {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-border" />}
        </li>
      ))}
    </ol>
  );
}

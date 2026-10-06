import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Menu, MessageSquare, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/store/app-store";

const NAV = [
  { to: "/opportunities", label: "Opportunities" },
  { to: "/workers", label: "Workers" },
  { to: "/teams", label: "Teams" },
  { to: "/agriculture", label: "Agriculture" },
  { to: "/training", label: "Training" },
  { to: "/pricing", label: "For business" },
] as const;

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-display text-lg font-extrabold">
      <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground">U</span>
      UmurimoHub
    </Link>
  );
}

export function SiteHeader() {
  const { user, notifications, setUser } = useApp();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const unread = notifications.filter((n) => !n.read).length;
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV.map((n) => <Link key={n.to} to={n.to} className="rounded-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground" activeProps={{ className: "text-foreground font-semibold" }}>{n.label}</Link>)}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link to="/messages" aria-label="Messages" className="rounded-full p-2 hover:bg-muted"><MessageSquare className="size-5" /></Link>
              <Link to="/notifications" aria-label="Notifications" className="relative rounded-full p-2 hover:bg-muted"><Bell className="size-5" />{unread > 0 && <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">{unread}</span>}</Link>
              <Button size="sm" asChild className="hidden sm:inline-flex"><Link to="/dashboard">Dashboard</Link></Button>
              <Button size="sm" variant="ghost" className="hidden sm:inline-flex" onClick={() => { setUser(null); nav({ to: "/", replace: true }); }}>Sign out</Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" asChild className="hidden sm:inline-flex"><Link to="/login">Sign in</Link></Button>
              <Button size="sm" asChild><Link to="/register">Join free</Link></Button>
            </>
          )}
          <button className="rounded-full p-2 hover:bg-muted lg:hidden" aria-label="Menu" onClick={() => setOpen(!open)}>{open ? <X className="size-5" /> : <Menu className="size-5" />}</button>
        </div>
      </div>
      {open && (
        <nav className="border-t lg:hidden"><div className="container-page grid gap-1 py-3">
          {[...NAV, { to: "/how-it-works", label: "How it works" }, { to: "/insights", label: "Insights" }].map((n) => <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 hover:bg-muted">{n.label}</Link>)}
          {user && <button className="rounded-xl px-3 py-2.5 text-left hover:bg-muted" onClick={() => { setUser(null); setOpen(false); nav({ to: "/", replace: true }); }}>Sign out</button>}
        </div></nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  const cols = [
    ["Platform", [["/opportunities", "Opportunities"], ["/workers", "Workers"], ["/teams", "Teams"], ["/businesses", "Businesses"]]],
    ["Grow", [["/training", "Training"], ["/agriculture", "Agriculture"], ["/insights", "Economic insights"], ["/pricing", "Business plans"]]],
    ["Company", [["/about", "About"], ["/how-it-works", "How it works"], ["/help", "Help"], ["/terms", "Terms & privacy"]]],
  ] as const;
  return (
    <footer className="mt-24 border-t bg-card">
      <div className="container-page grid gap-10 py-12 md:grid-cols-4">
        <div><Logo /><p className="mt-3 text-sm text-muted-foreground">Turning demand into trusted work across Rwanda's 30 districts.</p></div>
        {cols.map(([h, links]) => (
          <div key={h}><h4 className="text-sm font-semibold">{h}</h4><ul className="mt-3 space-y-2 text-sm text-muted-foreground">{links.map(([to, l]) => <li key={to}><Link to={to} className="hover:text-foreground">{l}</Link></li>)}</ul></div>
        ))}
      </div>
      <div className="container-page border-t py-5 text-xs text-muted-foreground">UmurimoHub is a work platform, not a bank. Payments will be processed by licensed partners. Prototype with demo data.</div>
    </footer>
  );
}

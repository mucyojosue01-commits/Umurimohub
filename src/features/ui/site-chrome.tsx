import { Link, useNavigate } from "@tanstack/react-router";
import { Bell, Menu, MessageSquare, Plus, Settings, UserCircle, X, LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/store/app-store";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/opportunities", label: "Opportunities" },
  { to: "/match", label: "AI match" },
  { to: "/workers", label: "Workers" },
  { to: "/teams", label: "Teams" },
  { to: "/agriculture", label: "Agriculture" },
  { to: "/training", label: "Training" },
  { to: "/grow", label: "Grow" },
  { to: "/company", label: "Company" },
  { to: "/pricing", label: "For business" },
] as const;

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-display text-lg font-extrabold">
      <img src="/umurimohub-mark.svg" alt="" className="size-8 rounded-xl" />
      UmurimoHub
    </Link>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("") || "U";
}

export function SiteHeader() {
  const { user, notifications, signOut } = useApp();
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Create">
                    <Plus className="size-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild><Link to="/opportunities/new">Post opportunity</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/training">Create training</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><a href="/register?create=business">Create business</a></DropdownMenuItem>
                  <DropdownMenuItem asChild><a href="/register?create=team">Create team</a></DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Link to="/messages" aria-label="Messages" className="rounded-full p-2 hover:bg-muted"><MessageSquare className="size-5" /></Link>
              <Link to="/notifications" aria-label="Notifications" className="relative rounded-full p-2 hover:bg-muted"><Bell className="size-5" />{unread > 0 && <span className="absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">{unread}</span>}</Link>
              <Link to="/network" className="hidden rounded-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground md:inline-flex">Network</Link>
              <Button size="sm" asChild className="hidden sm:inline-flex"><Link to="/dashboard">Dashboard</Link></Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button aria-label="Account menu" className="rounded-full outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
                    <Avatar className="size-9">
                      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name} />}
                      <AvatarFallback>{initials(user.name)}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-2 py-2"><p className="font-semibold">{user.name}</p><p className="truncate text-xs text-muted-foreground">{user.email}</p></div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild><Link to="/settings"><UserCircle className="mr-2 size-4" />Profile & settings</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/dashboard"><Settings className="mr-2 size-4" />Dashboard</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { void signOut(); nav({ to: "/", replace: true }); }}><LogOut className="mr-2 size-4" />Log out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
      {open && <nav className="border-t lg:hidden"><div className="container-page grid gap-1 py-3">{[...NAV,{to:"/how-it-works",label:"How it works"},{to:"/insights",label:"Insights"}].map((n)=><Link key={n.to} to={n.to} onClick={()=>setOpen(false)} className="rounded-xl px-3 py-2.5 hover:bg-muted">{n.label}</Link>)}{user && <Link to="/settings" onClick={()=>setOpen(false)} className="rounded-xl px-3 py-2.5 hover:bg-muted">Profile & settings</Link>}{user && <button className="rounded-xl px-3 py-2.5 text-left hover:bg-muted" onClick={()=>{void signOut();setOpen(false);nav({to:"/",replace:true});}}>Log out</button>}</div></nav>}
    </header>
  );
}

export function SiteFooter() {
  const cols = [
    ["Platform", [["/opportunities","Opportunities"],["/workers","Workers"],["/teams","Teams"],["/businesses","Businesses"]]],
    ["Grow", [["/training","Training"],["/agriculture","Agriculture"],["/insights","Economic insights"],["/pricing","Business plans"]]],
    ["Company", [["/about","About"],["/how-it-works","How it works"],["/help","Help"],["/terms","Terms of Service"],["/privacy","Privacy Policy"]]],
  ] as const;
  return <footer className="mt-24 border-t bg-card"><div className="container-page grid gap-10 py-12 md:grid-cols-4"><div><Logo /><p className="mt-3 text-sm text-muted-foreground">Turning demand into trusted work across Rwanda's 30 districts.</p></div>{cols.map(([h,links])=><div key={h}><h4 className="text-sm font-semibold">{h}</h4><ul className="mt-3 space-y-2 text-sm text-muted-foreground">{links.map(([to,l])=><li key={to}><Link to={to} className="hover:text-foreground">{l}</Link></li>)}</ul></div>)}</div><div className="container-page border-t py-5 text-xs text-muted-foreground">UmurimoHub is a work platform, not a bank. Payments will be processed by licensed partners. Live platform. Data shown is created by UmurimoHub members.</div></footer>;
}
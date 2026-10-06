import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useApp, type Role } from "@/features/store/app-store";
import { Card, DemoNotice } from "@/features/ui/kit";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — UmurimoHub" }, { name: "description", content: "Sign in to your UmurimoHub account." }, { property: "og:title", content: "Sign in — UmurimoHub" }, { property: "og:description", content: "Access your work dashboard." }] }),
  component: Page,
});

function Page() {
  const { setUser } = useApp();
  const nav = useNavigate();
  const [name, setName] = useState(""); const [phone, setPhone] = useState(""); const [role, setRole] = useState<Role>("worker");
  return (
    <div className="container-page max-w-md py-16">
      <Card className="p-6">
        <h1 className="text-2xl font-extrabold">Sign in or join</h1>
        <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); if (!name.trim() || !/^07\d{8}$/.test(phone)) return; setUser({ name: name.trim(), phone, role, district: "Gasabo", skills: [], verifiedPhone: false }); nav({ to: "/dashboard" }); }}>
          <label className="block text-sm">Full name<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} className="mt-1 h-11 w-full rounded-xl border bg-card px-3" /></label>
          <label className="block text-sm">Phone (07XXXXXXXX)<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" pattern="07\d{8}" required className="mt-1 h-11 w-full rounded-xl border bg-card px-3" /></label>
          <label className="block text-sm">I am a<select value={role} onChange={(e) => setRole(e.target.value as Role)} className="mt-1 h-11 w-full rounded-xl border bg-card px-3"><option value="worker">Worker</option><option value="team">Team leader</option><option value="business">Business / MSME</option><option value="admin">Admin (demo)</option></select></label>
          <Button type="submit" className="w-full" size="lg">Continue</Button>
        </form>
        <DemoNotice className="mt-4" />
      </Card>
    </div>
  );
}

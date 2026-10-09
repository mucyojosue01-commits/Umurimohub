import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/features/store/app-store";
import { Card } from "@/features/ui/kit";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — UmurimoHub" },
      { name: "description", content: "Sign in or create your UmurimoHub account." },
      { property: "og:title", content: "Sign in — UmurimoHub" },
      { property: "og:description", content: "Access your work dashboard." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//")
      ? { next: s.next }
      : {},
  component: Page,
});

const creds = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "At least 8 characters").max(72),
});
const inp = "mt-1 h-11 w-full rounded-xl border bg-card px-3";

function Page() {
  const { user, authReady } = useApp();
  const nav = useNavigate();
  const { next } = Route.useSearch();
  const back = next ? window.location.origin + next : null;
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (authReady && user && next) { window.location.href = next; return; }
    if (authReady && user) nav({ to: user.onboarded ? "/dashboard" : "/register", replace: true });
  }, [authReady, user, nav, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    const p = creds.safeParse({ email, password });
    if (!p.success) {
      setErr(p.error.issues[0]?.message ?? "Check your details");
      return;
    }
    setBusy(true);
    const r =
      mode === "in"
        ? await supabase.auth.signInWithPassword(p.data)
        : await supabase.auth.signUp({
            ...p.data,
            options: { emailRedirectTo: back ?? `${window.location.origin}/register` },
          });
    setBusy(false);
    if (r.error) {
      setErr(r.error.message);
      return;
    }
    if (mode === "up" && !r.data.session)
      toast.success("Check your email to confirm your account, then sign in.");
  };

  return (
    <div className="container-page max-w-md py-16">
      <Card className="p-6">
        <h1 className="text-2xl font-extrabold">
          {mode === "in" ? "Sign in" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Workers, teams, businesses and learners use one account.
        </p>
        <Button
          type="button"
          variant="outline"
          className="mt-5 w-full"
          size="lg"
          onClick={async () => {
            const r = await supabase.auth.signInWithOAuth({
              provider: "google",
              options: { redirectTo: back ?? window.location.origin + "/register" },
            });
            if (r.error) setErr(r.error.message ?? "Google sign-in failed");
          }}
        >
          Continue with Google
        </Button>
        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>
        <form className="space-y-3" onSubmit={submit}>
          <label className="block text-sm">
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inp}
            />
          </label>
          <label className="block text-sm">
            Password
            <input
              type="password"
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className={inp}
            />
          </label>
          {err && (
            <p role="alert" className="text-sm text-destructive">
              {err}
            </p>
          )}
          <Button type="submit" className="w-full" size="lg" disabled={busy}>
            {busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {mode === "in" ? "New to UmurimoHub? " : "Already have an account? "}
          <button
            className="font-semibold text-primary"
            onClick={() => {
              setMode(mode === "in" ? "up" : "in");
              setErr("");
            }}
          >
            {mode === "in" ? "Create an account" : "Sign in"}
          </button>
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Phone sign-in is coming soon.{" "}
          <Link to="/terms" className="underline">
            Terms & privacy
          </Link>
        </p>
      </Card>
    </div>
  );
}

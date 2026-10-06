import { Link } from "@tanstack/react-router";
import { UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/features/store/app-store";

const RELATIONS = [["worked_with", "We've worked together"], ["trained_with", "We trained together"], ["employer", "I employed them"], ["community", "Community / neighbour"]] as const;

/** Request a trusted-network connection with the account behind a profile. */
export function ConnectButton({ userId, name }: { userId: string | null; name: string }) {
  const { session } = useApp();
  const [status, setStatus] = useState<string | null>(null);
  const [relation, setRelation] = useState<(typeof RELATIONS)[number][0]>("worked_with");
  const me = session?.user.id;

  useEffect(() => {
    if (!me || !userId) return;
    supabase.from("connections").select("status").or(`and(requester.eq.${me},addressee.eq.${userId}),and(requester.eq.${userId},addressee.eq.${me})`).maybeSingle()
      .then(({ data }) => setStatus(data?.status ?? null));
  }, [me, userId]);

  if (!userId) return <Button variant="outline" disabled title="Demo profile — no real account">Connect (demo profile)</Button>;
  if (!me) return <Button variant="outline" asChild><Link to="/login">Sign in to connect</Link></Button>;
  if (me === userId) return null;
  if (status) return <Button variant="outline" disabled>{status === "accepted" ? "Connected" : "Request pending"}</Button>;
  return (
    <div className="flex gap-2">
      <select aria-label="How do you know them?" value={relation} onChange={(e) => setRelation(e.target.value as typeof relation)} className="h-10 rounded-full border bg-card px-3 text-sm">
        {RELATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <Button variant="outline" onClick={async () => {
        const { error } = await supabase.from("connections").insert({ requester: me, addressee: userId, relation });
        if (error) { toast.error(error.message); return; }
        setStatus("pending"); toast.success(`Connection request sent to ${name}`);
      }}><UserPlus />Connect</Button>
    </div>
  );
}

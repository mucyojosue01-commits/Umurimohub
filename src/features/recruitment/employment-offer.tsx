import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/store/app-store";
import { Card } from "@/features/ui/kit";
import { supabase } from "@/integrations/supabase/client";

type PublishedOpportunity = {
  id: string;
  title: string;
  business_id: string;
  companyName: string;
};

export function EmploymentOffer({
  workerId,
  workerUserId,
}: {
  workerId: string;
  workerUserId: string | null;
}) {
  const { user } = useApp();
  const [opportunityId, setOpportunityId] = useState("");
  const [employmentType, setEmploymentType] = useState("full_time");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const query = useQuery({
    queryKey: ["published-employment-opportunities", user?.id, user?.businessIds],
    enabled: !!user && user.businessIds.length > 0,
    queryFn: async (): Promise<PublishedOpportunity[]> => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("id,title,business_id,opportunity_type,type")
        .in("business_id", user!.businessIds)
        .eq("opportunity_type", "company_position")
        .eq("type", "Job")
        .eq("status", "open")
        .eq("is_demo", false)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ids = [...new Set((data ?? []).map((item) => item.business_id))];
      const { data: companies, error: companyError } = ids.length
        ? await supabase.from("businesses").select("id,name").in("id", ids)
        : { data: [], error: null };
      if (companyError) throw companyError;

      return (data ?? []).map((item) => ({
        ...item,
        companyName:
          companies?.find((company) => company.id === item.business_id)?.name ?? "Company",
      }));
    },
  });

  const submit = async () => {
    const opportunity = query.data?.find((item) => item.id === opportunityId);
    if (!user || !workerUserId || !opportunity) return;

    setBusy(true);
    const { error } = await supabase.from("employment_offers").insert({
      business_id: opportunity.business_id,
      opportunity_id: opportunity.id,
      worker_id: workerId,
      worker_user_id: workerUserId,
      position_name: opportunity.title,
      employment_type: employmentType,
      details: details.trim(),
      offered_by: user.id,
    });
    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Employment offer sent.");
    setOpportunityId("");
    setDetails("");
  };

  return (
    <Card>
      <h2 className="font-bold">Send employment offer</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose one of your company’s open employment positions. Project opportunities are kept separate.
      </p>
      <label className="mt-3 block text-sm">
        Opportunity
        <select
          value={opportunityId}
          onChange={(event) => setOpportunityId(event.target.value)}
          className="mt-1 h-11 w-full rounded-xl border bg-card px-3"
        >
          <option value="">Choose an opportunity</option>
          {(query.data ?? []).map((item) => (
            <option key={item.id} value={item.id}>
              {item.title} — {item.companyName}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 block text-sm">
        Employment type
        <select
          value={employmentType}
          onChange={(event) => setEmploymentType(event.target.value)}
          className="mt-1 h-11 w-full rounded-xl border bg-card px-3"
        >
          <option value="full_time">Full-time</option>
          <option value="part_time">Part-time</option>
          <option value="contract">Contract</option>
          <option value="temporary">Temporary</option>
          <option value="apprenticeship">Apprenticeship</option>
        </select>
      </label>
      <label className="mt-3 block text-sm">
        Details (optional)
        <textarea
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          rows={2}
          className="mt-1 w-full rounded-xl border bg-card p-3"
        />
      </label>
      <Button
        className="mt-3"
        disabled={busy || !opportunityId}
        onClick={() => void submit()}
      >
        {busy ? "Sending…" : "Send offer"}
      </Button>
      {query.isError && (
        <p className="mt-2 text-sm text-destructive">Could not load published opportunities.</p>
      )}
    </Card>
  );
}

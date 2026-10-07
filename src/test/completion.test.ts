import { describe, expect, it } from "vitest";
import {
  completionReadiness,
  evidenceSummary,
  type CompletionStatus,
  type MilestoneSummary,
} from "@/features/completion/service";

describe("completion readiness", () => {
  it("allows zero-milestone active contracts", () => {
    expect(completionReadiness("active", [])).toEqual({
      eligible: true,
      reason: null,
    });
  });

  it("blocks active contracts with an unapproved milestone", () => {
    const milestones: MilestoneSummary[] = [{ status: "approved" }, { status: "submitted" }];
    expect(completionReadiness("active", milestones)).toEqual({
      eligible: false,
      reason: "Approve all milestones before requesting completion.",
    });
  });

  it("blocks non-active contracts", () => {
    expect(completionReadiness("completed", [])).toEqual({
      eligible: false,
      reason: "Only active contracts can be completed.",
    });
  });
});

describe("reputation evidence summary", () => {
  it("counts evidence by type without inventing a score", () => {
    expect(
      evidenceSummary([
        { evidence_type: "verified_project_completed" },
        { evidence_type: "verified_project_completed" },
        { evidence_type: "verified_on_time_completion" },
        { evidence_type: "repeat_employer_relationship" },
      ]),
    ).toEqual({
      verifiedProjects: 2,
      onTimeCompletions: 1,
      repeatEmployers: 1,
      verifiedMilestones: 0,
      verifiedRecommendations: 0,
      verifiedCollaborations: 0,
    });
  });
});

describe("completion status", () => {
  it("accepts the database lifecycle statuses", () => {
    const statuses: CompletionStatus[] = ["requested", "rejected", "confirmed"];
    expect(statuses).toHaveLength(3);
  });
});

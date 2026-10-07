import { describe, expect, it } from "vitest";
import { validateProposal } from "@/features/contracts/service";

describe("contract proposal validation", () => {
  const base = {
    applicationId: "application-1",
    title: "Masonry project contract",
    scope: "Complete the agreed masonry works and handover.",
    amountRwf: 4800000,
  };

  it("accepts a valid RWF proposal", () => {
    expect(validateProposal(base)).toBeNull();
  });

  it("rejects non-integer or non-positive RWF amounts", () => {
    expect(validateProposal({ ...base, amountRwf: 0 })).toContain("whole number");
    expect(validateProposal({ ...base, amountRwf: 12.5 })).toContain("whole number");
  });

  it("rejects invalid dates", () => {
    expect(
      validateProposal({ ...base, startDate: "2026-11-10", endDate: "2026-11-01" }),
    ).toContain("End date");
  });

  it("enforces scope and title limits", () => {
    expect(validateProposal({ ...base, title: "x" })).toContain("Title");
    expect(validateProposal({ ...base, scope: "short" })).toContain("Scope");
  });
});

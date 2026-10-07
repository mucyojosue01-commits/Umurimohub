import { describe, expect, it } from "vitest";
import {
  milestoneStatuses,
  validateMilestone,
} from "@/features/milestones/service";

describe("milestone validation", () => {
  const base = {
    contractId: "contract-1",
    sequence: 1,
    title: "Foundation works",
    description: "Complete and hand over the foundation works.",
    amountRwf: 500000,
    dueDate: "2026-11-15",
  };

  it("accepts a valid milestone", () => {
    expect(validateMilestone(base)).toBeNull();
  });

  it("rejects non-positive integer RWF amounts", () => {
    expect(validateMilestone({ ...base, amountRwf: 0 })).toContain("whole number");
    expect(validateMilestone({ ...base, amountRwf: 12.5 })).toContain("whole number");
  });

  it("rejects invalid sequence values", () => {
    expect(validateMilestone({ ...base, sequence: 0 })).toContain("Sequence");
    expect(validateMilestone({ ...base, sequence: 1.5 })).toContain("Sequence");
  });

  it("rejects short or oversized text", () => {
    expect(validateMilestone({ ...base, title: "x" })).toContain("Title");
    expect(validateMilestone({ ...base, description: "short" })).toContain("description");
    expect(validateMilestone({ ...base, title: "x".repeat(201) })).toContain("Title");
  });

  it("rejects an invalid due date", () => {
    expect(validateMilestone({ ...base, dueDate: "not-a-date" })).toContain("date");
  });
});

describe("milestone status model", () => {
  it("exposes the approved lifecycle", () => {
    expect(milestoneStatuses).toEqual(["pending", "submitted", "disputed", "approved"]);
  });
});

import { describe, expect, it } from "vitest";

import { applicationErrorMessage } from "@/features/store/app-store";

describe("application integrity error handling", () => {
  it("turns a stale opportunity foreign-key failure into a safe user message", () => {
    expect(applicationErrorMessage({ code: "23503", message: "raw foreign key detail" })).toBe(
      "This opportunity is no longer available.",
    );
  });

  it("preserves duplicate-application messaging", () => {
    expect(applicationErrorMessage({ code: "23505", message: "duplicate key" })).toBe(
      "You've already applied to this opportunity.",
    );
  });

  it("falls back to the database message for unknown errors", () => {
    expect(applicationErrorMessage({ code: "PGRST500", message: "temporary failure" })).toBe(
      "temporary failure",
    );
  });
});

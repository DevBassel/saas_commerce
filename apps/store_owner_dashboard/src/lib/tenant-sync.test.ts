import { describe, expect, it } from "vitest";

import { resolveTenantSync } from "./tenant-sync";

describe("resolveTenantSync", () => {
  it("seeds without resetting on the first resolution after mount", () => {
    const first = resolveTenantSync(
      { slug: null, initialized: false },
      "my-store",
    );
    expect(first.shouldReset).toBe(false);
    expect(first.state).toEqual({ slug: "my-store", initialized: true });
  });

  it("does not reset when the slug is unchanged", () => {
    const result = resolveTenantSync(
      { slug: "my-store", initialized: true },
      "my-store",
    );
    expect(result.shouldReset).toBe(false);
  });

  it("resets when the slug changes after mount", () => {
    const result = resolveTenantSync({ slug: "old", initialized: true }, "new");
    expect(result.shouldReset).toBe(true);
  });

  it("treats null-to-slug and slug-to-null as changes", () => {
    expect(
      resolveTenantSync({ slug: null, initialized: true }, "a").shouldReset,
    ).toBe(true);
    expect(
      resolveTenantSync({ slug: "a", initialized: true }, null).shouldReset,
    ).toBe(true);
  });
});

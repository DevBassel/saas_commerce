import { describe, expect, it } from "vitest";

import { normalizeTenant, tenantMatchesSlug } from "./tenant";

describe("normalizeTenant", () => {
  it("lowercases and strips non-alphanumeric characters", () => {
    expect(normalizeTenant("Acme_Store-01")).toBe("acmestore01");
  });

  it("treats null/undefined as an empty string", () => {
    expect(normalizeTenant(null)).toBe("");
    expect(normalizeTenant(undefined)).toBe("");
  });
});

describe("tenantMatchesSlug", () => {
  it("matches ignoring case and separators", () => {
    expect(tenantMatchesSlug("acme-store", "acmestore")).toBe(true);
  });

  it("does not match different tenants", () => {
    expect(tenantMatchesSlug("acme", "globex")).toBe(false);
  });

  it("skips the check when the host slug cannot be derived", () => {
    expect(tenantMatchesSlug("acme", null)).toBe(true);
  });

  it("skips the check when the token has no tenant claim", () => {
    expect(tenantMatchesSlug(undefined, "acme")).toBe(true);
  });
});

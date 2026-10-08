import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getTenantSlugFromHost,
  getTenantSlugFromParam,
  isValidTenantSlug,
  normalizeTenant,
  resolveTenantSlugFrom,
  tenantMatchesSlug,
  withTenantParam,
} from "./tenant";

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

  it("matches the tenant schema name against the bare slug", () => {
    expect(tenantMatchesSlug("tenant_demo", "demo")).toBe(true);
    expect(tenantMatchesSlug("tenant_my-store", "my-store")).toBe(true);
    expect(tenantMatchesSlug("tenant_demo", "other")).toBe(false);
  });

  it("skips the check when the host slug cannot be derived", () => {
    expect(tenantMatchesSlug("acme", null)).toBe(true);
  });

  it("skips the check when the token has no tenant claim", () => {
    expect(tenantMatchesSlug(undefined, "acme")).toBe(true);
  });
});

describe("isValidTenantSlug", () => {
  it("accepts lowercase DNS labels", () => {
    expect(isValidTenantSlug("my-store")).toBe(true);
    expect(isValidTenantSlug("a")).toBe(true);
    expect(isValidTenantSlug("a".repeat(63))).toBe(true);
  });

  it("rejects uppercase, separators, leading/trailing hyphens and empties", () => {
    expect(isValidTenantSlug("MyStore")).toBe(false);
    expect(isValidTenantSlug("my_store")).toBe(false);
    expect(isValidTenantSlug("-bad")).toBe(false);
    expect(isValidTenantSlug("bad-")).toBe(false);
    expect(isValidTenantSlug("")).toBe(false);
    expect(isValidTenantSlug("a".repeat(64))).toBe(false);
  });
});

describe("getTenantSlugFromHost", () => {
  it("returns the label for a single-label subdomain of the root", () => {
    expect(getTenantSlugFromHost("my-store.localhost")).toBe("my-store");
    expect(getTenantSlugFromHost("MY-STORE.localhost")).toBe("my-store");
    expect(getTenantSlugFromHost("my-store.example.com", "example.com")).toBe(
      "my-store",
    );
  });

  it("returns null for the apex and www", () => {
    expect(getTenantSlugFromHost("localhost")).toBeNull();
    expect(getTenantSlugFromHost("www.localhost")).toBeNull();
    expect(getTenantSlugFromHost("example.com", "example.com")).toBeNull();
  });

  it("returns null for invalid or lookalike hosts", () => {
    expect(getTenantSlugFromHost("my_store.localhost")).toBeNull();
    expect(getTenantSlugFromHost("deep.my-store.localhost")).toBeNull();
    expect(
      getTenantSlugFromHost("my-store.example.com.evil.com", "example.com"),
    ).toBeNull();
    expect(getTenantSlugFromHost("")).toBeNull();
  });
});

describe("getTenantSlugFromParam", () => {
  it("returns a valid tenant parameter", () => {
    expect(getTenantSlugFromParam(new URLSearchParams("tenant=my-store"))).toBe(
      "my-store",
    );
  });

  it("returns null for an invalid or absent parameter", () => {
    expect(getTenantSlugFromParam(new URLSearchParams("tenant=BAD_SLUG"))).toBeNull();
    expect(getTenantSlugFromParam(new URLSearchParams(""))).toBeNull();
    expect(getTenantSlugFromParam(null)).toBeNull();
  });
});

describe("resolveTenantSlugFrom", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the legacy first label when subdomain mode is on", () => {
    vi.stubEnv("VITE_ALLOW_SUBDOMAIN", "true");
    expect(
      resolveTenantSlugFrom({
        hostname: "app.example.com",
        search: "?tenant=other",
        persistedSlug: "persisted",
      }),
    ).toBe("app");
  });

  it("prefers the host label over the parameter", () => {
    vi.stubEnv("VITE_ALLOW_SUBDOMAIN", "false");
    expect(
      resolveTenantSlugFrom({
        hostname: "my-store.localhost",
        search: "?tenant=other",
      }),
    ).toBe("my-store");
  });

  it("uses a valid parameter on the apex", () => {
    vi.stubEnv("VITE_ALLOW_SUBDOMAIN", "false");
    expect(
      resolveTenantSlugFrom({ hostname: "localhost", search: "?tenant=my-store" }),
    ).toBe("my-store");
    expect(
      resolveTenantSlugFrom({ hostname: "www.localhost", search: "?tenant=my-store" }),
    ).toBe("my-store");
  });

  it("ignores an invalid parameter and falls back to the persisted slug", () => {
    vi.stubEnv("VITE_ALLOW_SUBDOMAIN", "false");
    expect(
      resolveTenantSlugFrom({
        hostname: "localhost",
        search: "?tenant=BAD_SLUG",
        persistedSlug: "persisted",
      }),
    ).toBe("persisted");
  });

  it("uses the persisted slug when there is no host or parameter", () => {
    vi.stubEnv("VITE_ALLOW_SUBDOMAIN", "false");
    expect(
      resolveTenantSlugFrom({
        hostname: "localhost",
        search: "",
        persistedSlug: "persisted",
      }),
    ).toBe("persisted");
  });

  it("returns null on the apex with no parameter or persisted slug", () => {
    vi.stubEnv("VITE_ALLOW_SUBDOMAIN", "false");
    expect(resolveTenantSlugFrom({ hostname: "localhost", search: "" })).toBeNull();
  });
});

describe("withTenantParam", () => {
  it("appends the tenant parameter while preserving existing query", () => {
    expect(withTenantParam("/verify-email?email=a%40b.c", "my-store")).toBe(
      "/verify-email?email=a%40b.c&tenant=my-store",
    );
  });

  it("preserves the hash fragment", () => {
    expect(withTenantParam("/path?a=1#frag", "my-store")).toBe(
      "/path?a=1&tenant=my-store#frag",
    );
  });

  it("replaces an existing tenant parameter idempotently", () => {
    expect(withTenantParam("/?tenant=old", "new-store")).toBe("/?tenant=new-store");
  });

  it("returns the path unchanged without a slug", () => {
    expect(withTenantParam("/path", null)).toBe("/path");
  });
});

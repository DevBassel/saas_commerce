import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getGuardTenantSlug } from "@/api/tenant";
import {
  clearVerificationContext,
  readVerificationContext,
  writeVerificationContext,
} from "./verification-context";

vi.mock("@/api/tenant", () => ({
  getGuardTenantSlug: vi.fn(),
}));

const STORAGE_KEY = "email-verification-context";
const NOW = new Date("2026-11-11T18:00:00.000Z");

describe("verification context", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    sessionStorage.clear();
    vi.mocked(getGuardTenantSlug).mockReturnValue("acme");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it("round trips a valid trimmed email", () => {
    expect(writeVerificationContext("  owner@example.com  ", 30)).toEqual({
      email: "owner@example.com",
      tenantSlug: "acme",
      resendAvailableAt: NOW.getTime() + 30_000,
    });

    expect(readVerificationContext()).toEqual({
      email: "owner@example.com",
      tenantSlug: "acme",
      resendAvailableAt: NOW.getTime() + 30_000,
    });
  });

  it("clears malformed JSON while reading", () => {
    sessionStorage.setItem(STORAGE_KEY, "{not-json");

    expect(readVerificationContext()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("clears context belonging to another tenant", () => {
    writeVerificationContext("owner@example.com", 30);
    vi.mocked(getGuardTenantSlug).mockReturnValue("globex");

    expect(readVerificationContext()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("calculates absolute deadlines and keeps zero cooldown available", () => {
    expect(
      writeVerificationContext("owner@example.com", 45)?.resendAvailableAt,
    ).toBe(NOW.getTime() + 45_000);
    expect(
      writeVerificationContext("owner@example.com", 0)?.resendAvailableAt,
    ).toBe(NOW.getTime());
  });

  it("clears stored context", () => {
    writeVerificationContext("owner@example.com", 30);

    clearVerificationContext();

    expect(readVerificationContext()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

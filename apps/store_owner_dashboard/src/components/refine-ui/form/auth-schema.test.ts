import { describe, expect, it } from "vitest";

import {
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "./auth-schema";

describe("verifyEmailSchema", () => {
  it("accepts a numeric code", () => {
    expect(verifyEmailSchema.safeParse({ code: "123456" }).success).toBe(true);
  });

  it("rejects a non-numeric code", () => {
    expect(verifyEmailSchema.safeParse({ code: "12ab" }).success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts a valid email", () => {
    expect(
      forgotPasswordSchema.safeParse({ email: "owner@store.com" }).success,
    ).toBe(true);
  });

  it("rejects a malformed email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(
      false,
    );
  });
});

describe("resetPasswordSchema", () => {
  const base = { code: "123456", password: "new-password", confirm: "new-password" };

  it("accepts a matching password and numeric code", () => {
    expect(resetPasswordSchema.safeParse(base).success).toBe(true);
  });

  it("rejects mismatched passwords with a confirm error", () => {
    const result = resetPasswordSchema.safeParse({
      ...base,
      confirm: "different",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["confirm"]);
    }
  });

  it("rejects a password outside the 8-16 character range", () => {
    expect(
      resetPasswordSchema.safeParse({ ...base, password: "short", confirm: "short" })
        .success,
    ).toBe(false);
  });
});

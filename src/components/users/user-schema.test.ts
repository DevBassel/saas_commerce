import { describe, expect, it } from "vitest";

import { userCreateSchema, userSchema } from "./user-schema";

describe("userSchema", () => {
  it("accepts a valid name", () => {
    expect(userSchema.safeParse({ name: "Alice" }).success).toBe(true);
  });

  it("trims the name", () => {
    expect(userSchema.parse({ name: "  Alice  " }).name).toBe("Alice");
  });

  it("rejects a name shorter than 2 characters", () => {
    expect(userSchema.safeParse({ name: "A" }).success).toBe(false);
  });

  it("rejects a name longer than 100 characters", () => {
    expect(userSchema.safeParse({ name: "a".repeat(101) }).success).toBe(false);
  });

  it("rejects a missing name", () => {
    expect(userSchema.safeParse({}).success).toBe(false);
  });
});

describe("userCreateSchema", () => {
  const valid = {
    name: "Alice",
    email: "alice@example.com",
    password: "supersecret",
  };

  it("accepts a valid payload", () => {
    expect(userCreateSchema.safeParse(valid).success).toBe(true);
  });

  it("trims the name and email", () => {
    const result = userCreateSchema.parse({
      ...valid,
      name: "  Alice  ",
      email: "  alice@example.com  ",
    });
    expect(result.name).toBe("Alice");
    expect(result.email).toBe("alice@example.com");
  });

  it("rejects an invalid email", () => {
    expect(
      userCreateSchema.safeParse({ ...valid, email: "not-an-email" }).success,
    ).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(
      userCreateSchema.safeParse({ ...valid, password: "short" }).success,
    ).toBe(false);
  });

  it("rejects a password longer than 16 characters", () => {
    expect(
      userCreateSchema.safeParse({ ...valid, password: "a".repeat(17) })
        .success,
    ).toBe(false);
  });
});

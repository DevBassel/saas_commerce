import { describe, expect, it } from "vitest";

import { formatBytes, storagePercent } from "./utils";

describe("formatBytes", () => {
  it("formats gigabytes", () => {
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe("2 GB");
  });

  it("formats megabytes", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");
  });

  it("formats kilobytes", () => {
    expect(formatBytes(3 * 1024)).toBe("3 KB");
  });

  it("formats plain bytes", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats fractional gigabytes with up to two decimals", () => {
    expect(formatBytes(1.5 * 1024 * 1024 * 1024)).toBe("1.5 GB");
  });

  it("falls back to 0 B for non-finite values", () => {
    expect(formatBytes(Number.NaN)).toBe("0 B");
  });
});

describe("storagePercent", () => {
  it("computes the used fraction of capacity", () => {
    expect(storagePercent(50, 100)).toBe(50);
  });

  it("clamps usage above capacity to 100", () => {
    expect(storagePercent(200, 100)).toBe(100);
  });

  it("clamps negative usage to 0", () => {
    expect(storagePercent(-10, 100)).toBe(0);
  });

  it("returns 0 when capacity is zero or negative", () => {
    expect(storagePercent(10, 0)).toBe(0);
    expect(storagePercent(10, -5)).toBe(0);
  });

  it("returns 0 for non-finite values", () => {
    expect(storagePercent(Number.NaN, 100)).toBe(0);
  });
});

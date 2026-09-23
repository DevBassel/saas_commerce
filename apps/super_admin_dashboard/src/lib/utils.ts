import { ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(value: string | number): string {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return "0 B";
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    })} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    })} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    })} KB`;
  }
  return `${bytes.toLocaleString()} B`;
}

export function storagePercent(
  usedBytes: string | number,
  capacityBytes: string | number
): number {
  const used = Number(usedBytes);
  const capacity = Number(capacityBytes);
  if (!Number.isFinite(used) || !Number.isFinite(capacity) || capacity <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, (used / capacity) * 100));
}

import { ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatKb(kb: number): string {
  if (kb >= 1024 * 1024) {
    return `${(kb / (1024 * 1024)).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    })} GB`;
  }
  if (kb >= 1024) {
    return `${(kb / 1024).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    })} MB`;
  }
  return `${kb.toLocaleString()} KB`;
}

export function storagePercent(usedKb: number, capacityKb: number): number {
  if (capacityKb <= 0) return 0;
  return Math.min(100, Math.max(0, (usedKb / capacityKb) * 100));
}

import { getGuardTenantSlug } from "@/api/tenant";

const STORAGE_KEY = "email-verification-context";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type VerificationContext = {
  email: string;
  tenantSlug: string | null;
  resendAvailableAt: number;
};

const getSessionStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const getCurrentTenantSlug = (): string | null => {
  try {
    return getGuardTenantSlug();
  } catch {
    return null;
  }
};

const normalizeEmail = (email: unknown): string | null => {
  if (typeof email !== "string") return null;
  const normalized = email.trim();
  return EMAIL_PATTERN.test(normalized) ? normalized : null;
};

const removeStoredContext = (storage: Storage): void => {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be disabled or unavailable.
  }
};

export const readVerificationContext = (): VerificationContext | null => {
  const storage = getSessionStorage();
  if (!storage) return null;

  let rawContext: string | null;
  try {
    rawContext = storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }

  if (!rawContext) return null;

  try {
    const parsed: unknown = JSON.parse(rawContext);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      removeStoredContext(storage);
      return null;
    }

    const candidate = parsed as Partial<VerificationContext>;
    const email = normalizeEmail(candidate.email);
    const tenantSlug = candidate.tenantSlug;
    const resendAvailableAt = candidate.resendAvailableAt;

    if (
      !email ||
      candidate.email !== email ||
      (tenantSlug !== null && typeof tenantSlug !== "string") ||
      typeof resendAvailableAt !== "number" ||
      !Number.isFinite(resendAvailableAt) ||
      resendAvailableAt < 0 ||
      tenantSlug !== getCurrentTenantSlug()
    ) {
      removeStoredContext(storage);
      return null;
    }

    return { email, tenantSlug, resendAvailableAt };
  } catch {
    removeStoredContext(storage);
    return null;
  }
};

export const writeVerificationContext = (
  email: string,
  resendCooldownSeconds: number,
): VerificationContext | null => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const cooldownSeconds = Number.isFinite(resendCooldownSeconds)
    ? Math.max(0, resendCooldownSeconds)
    : 0;
  const context: VerificationContext = {
    email: normalizedEmail,
    tenantSlug: getCurrentTenantSlug(),
    resendAvailableAt: Date.now() + cooldownSeconds * 1000,
  };

  const storage = getSessionStorage();
  if (storage) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(context));
    } catch {
      // Keep the in-memory result usable when storage is unavailable.
    }
  }

  return context;
};

export const clearVerificationContext = (): void => {
  const storage = getSessionStorage();
  if (storage) removeStoredContext(storage);
};

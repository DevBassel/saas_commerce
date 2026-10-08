/**
 * Public subscription-plan reads for the platform `/plans` page.
 *
 * `GET /platform/subscription-plans` is `@Public` on the API (the class-level
 * `@Roles([SUPER_ADMIN])` is skipped for `@Public` methods) and lives under the
 * `@Platform` scope, so it is callable anonymously from the apex with no tenant
 * header. This fetch therefore goes out directly and never attaches
 * `x-tenant-slug`; it is cached under a platform tag, never a `store:<slug>` tag.
 */

export interface IPlanLimit {
  key: string;
  value: number | null;
  type: "BYTES" | "COUNT";
}

export interface IPlanFeature {
  key: string;
  enabled: boolean;
}

export interface ISubscriptionPlan {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;
  active: boolean;
  isPublic: boolean;
  sortOrder: number;
  trialDays: number;
  limits?: IPlanLimit[];
  features?: IPlanFeature[];
}

export type PublicPlansResult =
  | { status: "ok"; plans: ISubscriptionPlan[] }
  | { status: "error"; message: string };

export async function getPublicPlans(): Promise<PublicPlansResult> {
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!baseUrl) {
    return { status: "error", message: "The store service is not configured." };
  }

  try {
    const response = await fetch(
      `${baseUrl}/platform/subscription-plans?active=true&isPublic=true`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 300, tags: ["platform:plans"] },
      },
    );
    if (!response.ok) {
      return {
        status: "error",
        message: `Plans are unavailable right now (${response.status}).`,
      };
    }
    return { status: "ok", plans: (await response.json()) as ISubscriptionPlan[] };
  } catch {
    return { status: "error", message: "Couldn't reach the plans service." };
  }
}

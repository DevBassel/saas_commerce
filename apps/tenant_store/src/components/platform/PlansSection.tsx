import Link from "next/link";
import {
  ArrowRight,
  Check,
  CircleDollarSign,
  PackageOpen,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { getPublicPlans, type ISubscriptionPlan } from "@/api/plansApi";
import { buttonVariants } from "@/components/ui/button";
import {
  formatFeature,
  formatLimit,
  isFreePlan,
  planPrices,
} from "@/lib/platform/plans";
import { cn } from "@/lib/utils";
import { PlansRetryButton } from "./PlansRetryButton";

const sectionClassName =
  "relative scroll-mt-24 overflow-hidden rounded-[2rem] border border-white/8 bg-[#080A0A] px-5 py-14 sm:px-8 lg:px-12 lg:py-20";

function PlansHeader() {
  return (
    <header className="relative mx-auto mb-10 max-w-2xl text-center lg:mb-14">
      <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#00C58A]/25 bg-[#00C58A]/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#00C58A]">
        <Sparkles className="size-3.5" />
        Flexible pricing
      </span>
      <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
        A plan for every stage
      </h2>
      <p className="mt-4 text-sm leading-6 text-zinc-400 sm:text-base">
        Start your storefront, then scale your products, team, and tools as your
        business grows.
      </p>
    </header>
  );
}

function PlanCard({ plan }: { plan: ISubscriptionPlan }) {
  const prices = planPrices(plan);
  const limits = (plan.limits ?? []).map(formatLimit);
  const features = (plan.features ?? []).map(formatFeature);
  const free = isFreePlan(plan);

  return (
    <article className="group relative flex min-h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0D1110] p-6 transition duration-300 hover:-translate-y-1 hover:border-[#00C58A]/45 hover:shadow-[0_28px_80px_-38px_rgba(0,197,138,0.65)] sm:p-7">
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#00C58A]/80 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
          {plan.description ? (
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              {plan.description}
            </p>
          ) : null}
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[#00C58A]/20 bg-[#00C58A]/10 text-[#00C58A]">
          <CircleDollarSign className="size-5" />
        </span>
      </div>

      <div className="mb-6 space-y-2 border-b border-white/8 pb-6">
        {prices.map((price, index) => (
          <div
            key={price.interval}
            className={cn(
              "flex items-baseline gap-2",
              index > 0 && "text-zinc-400",
            )}
          >
            <span
              className={cn(
                "font-semibold tracking-tight",
                index === 0 ? "text-4xl text-white" : "text-lg text-zinc-200",
              )}
            >
              {price.amount}
            </span>
            <span className="text-sm text-zinc-500">{price.cadence}</span>
          </div>
        ))}
        {plan.trialDays > 0 ? (
          <p className="pt-1 text-xs font-medium text-[#00C58A]">
            Includes a {plan.trialDays}-day trial
          </p>
        ) : null}
      </div>

      <div className="flex-1 space-y-6">
        {limits.length > 0 ? (
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Plan limits
            </h4>
            <ul className="space-y-3">
              {limits.map((limit) => (
                <li
                  key={limit}
                  className="flex items-start gap-2.5 text-sm text-zinc-300"
                >
                  <Check className="mt-0.5 size-4 shrink-0 text-[#00C58A]" />
                  <span>{limit}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {features.length > 0 ? (
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Features
            </h4>
            <ul className="space-y-3">
              {features.map((feature) => (
                <li
                  key={feature.label}
                  className={cn(
                    "flex items-start gap-2.5 text-sm",
                    feature.enabled ? "text-zinc-300" : "text-zinc-600",
                  )}
                >
                  {feature.enabled ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-[#00C58A]" />
                  ) : (
                    <X className="mt-0.5 size-4 shrink-0" />
                  )}
                  <span>{feature.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <Link
        href="/register-store"
        aria-label={`${free ? "Start a store with" : "Select"} ${plan.name}`}
        className={cn(
          buttonVariants({ variant: free ? "outline" : "default", size: "lg" }),
          "mt-8 w-full",
          free
            ? "border-white/15 bg-white/5 text-white hover:bg-white/10"
            : "bg-[#00C58A] text-[#04110D] hover:bg-[#16D49C]",
        )}
      >
        {free ? "Start a store" : "Select plan"}
        <ArrowRight />
      </Link>
    </article>
  );
}

export async function PlansSection() {
  const result = await getPublicPlans();

  if (result.status === "error") {
    return (
      <section id="plans" className={sectionClassName}>
        <PlansHeader />
        <div className="relative mx-auto flex max-w-xl flex-col items-center rounded-3xl border border-dashed border-white/15 bg-white/[0.025] px-6 py-12 text-center">
          <TriangleAlert className="size-9 text-amber-400" />
          <h3 className="mt-4 text-lg font-semibold text-white">
            Plans are temporarily unavailable
          </h3>
          <p className="mb-5 mt-2 text-sm text-zinc-400">{result.message}</p>
          <PlansRetryButton />
        </div>
      </section>
    );
  }

  const plans = result.plans.filter((plan) => plan.active && plan.isPublic);

  return (
    <section id="plans" className={sectionClassName}>
      <div className="pointer-events-none absolute left-1/2 top-0 h-56 w-2/3 -translate-x-1/2 rounded-full bg-[#00C58A]/8 blur-3xl" />
      <PlansHeader />
      {plans.length > 0 ? (
        <div className="relative grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      ) : (
        <div className="relative mx-auto flex max-w-xl flex-col items-center rounded-3xl border border-dashed border-white/15 bg-white/[0.025] px-6 py-12 text-center">
          <PackageOpen className="size-10 text-[#00C58A]" />
          <h3 className="mt-4 text-lg font-semibold text-white">
            No plans are available yet
          </h3>
          <p className="mt-2 text-sm text-zinc-400">
            Public subscription options will appear here when they become
            available.
          </p>
        </div>
      )}
    </section>
  );
}

export function PlansSectionSkeleton() {
  return (
    <section
      id="plans"
      aria-label="Loading subscription plans"
      aria-busy="true"
      className={sectionClassName}
    >
      <PlansHeader />
      <div className="relative grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="min-h-[32rem] animate-pulse rounded-3xl border border-white/8 bg-[#0D1110] p-7"
          >
            <div className="h-6 w-1/3 rounded bg-white/10" />
            <div className="mt-4 h-4 w-full rounded bg-white/5" />
            <div className="mt-2 h-4 w-4/5 rounded bg-white/5" />
            <div className="mt-8 h-11 w-1/2 rounded bg-white/10" />
            <div className="mt-8 space-y-4 border-t border-white/8 pt-7">
              {Array.from({ length: 5 }, (_, row) => (
                <div key={row} className="h-4 rounded bg-white/5" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

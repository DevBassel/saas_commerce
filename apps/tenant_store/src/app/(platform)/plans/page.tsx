import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getPublicPlans } from "@/api/plansApi";
import {
  formatLimit,
  planFeatureLabels,
  planPrice,
} from "@/lib/platform/plans";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Plans",
  description:
    "Simple, scalable plans for every stage — from your first product to an unlimited catalog.",
  alternates: { canonical: "/plans" },
};

export default async function PlatformPlansPage() {
  const result = await getPublicPlans();
  const plans = result.status === "ok" ? result.plans : [];

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Plans & pricing</h1>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          Start free and upgrade as you grow. Every plan includes an isolated
          storefront on your own subdomain.
        </p>
      </header>

      {result.status === "error" ? (
        <p className="text-center text-sm text-muted-foreground">
          {result.message}
        </p>
      ) : plans.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          No plans are available right now.
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {plans.map((plan, index) => {
            const price = planPrice(plan);
            const features = planFeatureLabels(plan);
            const limits = plan.limits ?? [];
            const highlighted = index === 2;

            return (
              <Card
                key={plan.slug}
                className={cn(
                  "flex flex-col",
                  highlighted && "border-primary shadow-lg",
                )}
              >
                <CardHeader>
                  {highlighted && (
                    <span className="mb-2 w-fit rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
                      Most popular
                    </span>
                  )}
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{price.amount}</span>
                    <span className="text-sm text-muted-foreground">
                      {price.cadence}
                    </span>
                  </div>
                  {plan.description && (
                    <CardDescription>{plan.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-6">
                  <ul className="flex flex-col gap-2 text-sm">
                    {limits.length === 0 ? (
                      <li className="flex items-center gap-2">
                        <Check className="size-4 text-primary" />
                        <span>Unlimited products, storage & admins</span>
                      </li>
                    ) : (
                      limits.map((limit) => (
                        <li
                          key={limit.key}
                          className="flex items-center gap-2"
                        >
                          <Check className="size-4 text-primary" />
                          <span>{formatLimit(limit)}</span>
                        </li>
                      ))
                    )}
                    {features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <Check className="size-4 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/register-store"
                    className={cn(
                      buttonVariants({
                        variant: highlighted ? "default" : "outline",
                      }),
                      "mt-auto w-full",
                    )}
                  >
                    Get started
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

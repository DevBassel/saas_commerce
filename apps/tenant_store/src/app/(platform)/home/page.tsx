import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Globe,
  ShieldCheck,
  Store,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Launch your online store",
  description:
    "Start selling in minutes on an isolated storefront with your own subdomain.",
  alternates: { canonical: "/" },
};

const highlights = [
  {
    icon: Globe,
    title: "Your own subdomain",
    description:
      "Every store goes live on its own address with an isolated database schema.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by default",
    description:
      "Tenant isolation, stateless auth and role-based access are built in.",
  },
  {
    icon: BarChart3,
    title: "Built to grow",
    description:
      "Plans scale from your first product to a high-volume catalog.",
  },
];

/**
 * Platform landing page. The proxy rewrites the apex `/` here, so the public
 * URL stays `/` while the tenant storefront keeps its own `/`.
 */
export default function PlatformHomePage() {
  return (
    <div className="flex flex-col gap-16">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 md:p-14">
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex max-w-2xl flex-col gap-5">
          <span className="w-fit rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            Multi-tenant commerce
          </span>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Launch your online store in minutes.
          </h1>
          <p className="text-muted-foreground md:text-lg">
            Spin up an isolated storefront on your own subdomain, manage your
            catalog and orders, and get paid — all from one platform.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link
              href="/register-store"
              className={cn(buttonVariants({ size: "lg" }))}
            >
              <Store className="size-4" />
              Start a store
            </Link>
            <Link
              href="/plans"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              View plans
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {highlights.map((item) => (
          <div
            key={item.title}
            className="rounded-3xl border border-border bg-card p-6"
          >
            <span className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <item.icon className="size-6" />
            </span>
            <h2 className="text-lg font-semibold">{item.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {item.description}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}

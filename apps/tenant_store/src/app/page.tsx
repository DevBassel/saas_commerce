"use client";
import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiClient } from "@/api/apiClient";

export default function Home() {
  return (
    <div className="flex flex-col gap-12">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 md:p-14">
        <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 size-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex max-w-2xl flex-col gap-4">
          <span className="w-fit rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            New season
          </span>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            Everything you need, in one store.
          </h1>
          <p className="text-muted-foreground md:text-lg">
            Browse the latest arrivals and check out in a couple of clicks.
          </p>
          <div className="mt-2 flex flex-wrap gap-3">
            <Link
              href="/products"
              className={cn(buttonVariants({ size: "lg" }))}
            >
              <ShoppingBag className="size-4" />
              Shop products
            </Link>
            <Link
              href="/cart"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              View cart
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">New arrivals</h2>
            <p className="text-sm text-muted-foreground">
              Fresh picks from the catalog
            </p>
          </div>
          <Link
            href="/products"
            className="text-sm font-medium text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        <Button
          onClick={async () => {
            const data = await apiClient.get("/products");

            console.log("🚀 ~ page.tsx:62 ~ Home ~ data:", data);
          }}
        >
          test
        </Button>
      </section>
    </div>
  );
}

import Link from "next/link";
import { HeroSection } from "@/components/home/HeroSection";
import { getTenantParam } from "@/lib/tenant";
import { withTenantParam } from "@/lib/tenant/url";

export default async function Home() {
  const tenantParam = await getTenantParam();

  return (
    <div className="flex flex-col gap-12">
      <HeroSection tenantParam={tenantParam} />

      <section className="flex flex-col gap-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">New arrivals</h2>
            <p className="text-sm text-muted-foreground">
              Fresh picks from the catalog
            </p>
          </div>
          <Link
            href={withTenantParam("/products", tenantParam)}
            className="text-sm font-medium text-primary hover:underline"
          >
            View all
          </Link>
        </div>
      </section>
    </div>
  );
}

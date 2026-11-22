import { HeroSection } from "@/components/home/HeroSection";
import {
  NewArrivalsSection,
  NewArrivalsSkeleton,
} from "@/components/home/NewArrivalsSection";
import {
  ShopByCategorySection,
  ShopByCategorySkeleton,
} from "@/components/home/ShopByCategorySection";
import { getTenantParam } from "@/lib/tenant";
import { Suspense } from "react";

export default async function Home() {
  const tenantParam = await getTenantParam();

  return (
    <div className="flex flex-col gap-12">
      <HeroSection tenantParam={tenantParam} />
      <Suspense fallback={<NewArrivalsSkeleton tenantParam={tenantParam} />}>
        <NewArrivalsSection tenantParam={tenantParam} />
      </Suspense>
      <Suspense
        fallback={<ShopByCategorySkeleton tenantParam={tenantParam} />}
      >
        <ShopByCategorySection tenantParam={tenantParam} />
      </Suspense>
    </div>
  );
}

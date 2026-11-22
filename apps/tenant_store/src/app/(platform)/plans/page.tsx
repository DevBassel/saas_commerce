import type { Metadata } from "next";
import { Suspense } from "react";
import {
  PlansSection,
  PlansSectionSkeleton,
} from "@/components/platform/PlansSection";

export const metadata: Metadata = {
  title: "Plans",
  description:
    "Simple, scalable plans for every stage — from your first product to an unlimited catalog.",
  alternates: { canonical: "/plans" },
};

export default function PlatformPlansPage() {
  return (
    <Suspense fallback={<PlansSectionSkeleton />}>
      <PlansSection />
    </Suspense>
  );
}

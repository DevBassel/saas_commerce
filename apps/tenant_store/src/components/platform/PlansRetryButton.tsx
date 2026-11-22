"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PlansRetryButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      disabled={isPending}
      onClick={() => startTransition(() => router.refresh())}
      className="border-white/15 bg-white/5 text-white hover:bg-white/10"
    >
      <RotateCw className={isPending ? "animate-spin" : undefined} />
      {isPending ? "Retrying" : "Try again"}
    </Button>
  );
}

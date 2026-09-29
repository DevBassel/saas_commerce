"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GetOrder, type IOrder } from "@/api/orderApi";

const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 20;

export default function OrderPaymentWatcher({ orders }: { orders: IOrder[] }) {
  const router = useRouter();

  const pendingKey = orders
    .filter((order) => order.paymentStatus === "PENDING")
    .map((order) => order.id)
    .join(",");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") !== "return") return;

    const status = params.get("redirect_status");
    if (status === "succeeded") {
      toast.success("Payment received");
    } else if (status === "failed") {
      toast.error("Payment failed");
    } else {
      toast.info("Payment is processing");
    }

    window.history.replaceState({}, "", "/orders");
  }, []);

  useEffect(() => {
    if (!pendingKey) return;

    const ids = pendingKey.split(",").map(Number);
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      attempts += 1;

      try {
        const watched = await Promise.all(ids.map((id) => GetOrder(id)));
        const settled = watched.some(
          (order) =>
            order.paymentStatus === "PAID" ||
            order.paymentStatus === "FAILED",
        );
        if (settled || attempts >= MAX_ATTEMPTS) {
          router.refresh();
          return;
        }
      } catch {
        // Transient failure: keep polling until the attempt bound.
      }

      if (!cancelled) {
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    timer = setTimeout(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pendingKey, router]);

  return null;
}

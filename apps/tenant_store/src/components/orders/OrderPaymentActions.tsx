"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { type IOrder, type PaymentStatus } from "@/api/orderApi";
import StripePaymentStep from "@/components/payments/StripePaymentStep";

const PAYABLE: PaymentStatus[] = ["UNPAID", "PENDING", "FAILED"];

export default function OrderPaymentActions({ order }: { order: IOrder }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (order.status === "CANCELLED" || !PAYABLE.includes(order.paymentStatus)) {
    return null;
  }

  const handleSuccess = () => {
    toast.success("Payment received");
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Pay now</DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payment</DialogTitle>
        </DialogHeader>
        <StripePaymentStep
          orderId={order.id}
          orderNumber={order.orderNumber}
          amount={order.total}
          onSuccess={handleSuccess}
        />
      </DialogContent>
    </Dialog>
  );
}

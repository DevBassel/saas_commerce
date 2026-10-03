"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "@refinedev/react-hook-form";
import type { HttpError } from "@refinedev/core";

import {
  CreateView,
  CreateViewHeader,
} from "@/components/refine-ui/views/create-view";
import { CouponForm } from "@/components/coupons/coupon-form";
import {
  couponSchema,
  type CouponFormValues,
} from "@/components/coupons/coupon-schema";
import { buildCouponPayload } from "@/lib/coupons";
import type { Coupon } from "@/types/coupon";

export const CouponsCreate = () => {
  const form = useForm<Coupon, HttpError, CouponFormValues>({
    resolver: zodResolver(couponSchema),
    refineCoreProps: {
      resource: "coupons",
      action: "create",
      redirect: "edit",
    },
    defaultValues: {
      code: "",
      description: "",
      discountType: "PERCENTAGE",
      discountValue: undefined,
      minOrderAmount: undefined,
      maxDiscountAmount: undefined,
      usageLimit: undefined,
      perUserLimit: undefined,
      startsAt: undefined,
      expiresAt: undefined,
      isActive: true,
    },
  });

  return (
    <CreateView>
      <CreateViewHeader />
      <CouponForm
        form={form}
        onSubmit={(values) =>
          form.refineCore.onFinish(buildCouponPayload(values))
        }
        isSubmitting={form.refineCore.formLoading}
        submitLabel="Create coupon"
      />
    </CreateView>
  );
};

CouponsCreate.displayName = "CouponsCreate";

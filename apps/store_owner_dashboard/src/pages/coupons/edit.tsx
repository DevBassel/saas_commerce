"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "@refinedev/react-hook-form";
import type { HttpError } from "@refinedev/core";

import { EditView, EditViewHeader } from "@/components/refine-ui/views/edit-view";
import { CouponForm } from "@/components/coupons/coupon-form";
import {
  couponSchema,
  type CouponFormValues,
} from "@/components/coupons/coupon-schema";
import { buildCouponPayload } from "@/lib/coupons";
import type { Coupon } from "@/types/coupon";

export const CouponsEdit = () => {
  const form = useForm<Coupon, HttpError, CouponFormValues>({
    resolver: zodResolver(couponSchema),
    refineCoreProps: {
      resource: "coupons",
      action: "edit",
      redirect: "list",
    },
  });

  return (
    <EditView>
      <EditViewHeader />
      <CouponForm
        form={form}
        onSubmit={(values) =>
          form.refineCore.onFinish(buildCouponPayload(values))
        }
        isSubmitting={form.refineCore.formLoading}
        submitLabel="Save changes"
      />
    </EditView>
  );
};

CouponsEdit.displayName = "CouponsEdit";

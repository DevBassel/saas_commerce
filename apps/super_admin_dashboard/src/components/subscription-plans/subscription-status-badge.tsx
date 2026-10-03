"use client";

import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/components/subscription-plans/plan-labels";
import type { SubscriptionStatus } from "@/types/subscription";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const VARIANTS: Record<SubscriptionStatus, BadgeVariant> = {
  ACTIVE: "default",
  TRIALING: "default",
  PAST_DUE: "destructive",
  CANCELED: "secondary",
  PAUSED: "secondary",
  UNPAID: "outline",
  INCOMPLETE: "outline",
  INCOMPLETE_EXPIRED: "outline",
};

export const SubscriptionStatusBadge = ({
  status,
}: {
  status: SubscriptionStatus;
}) => (
  <Badge variant={VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
);

SubscriptionStatusBadge.displayName = "SubscriptionStatusBadge";

"use client";

import { useState } from "react";
import { useInvalidate, useNotification } from "@refinedev/core";
import { Loader2Icon, PencilIcon, TrashIcon } from "lucide-react";

import { toApiError } from "@/api/client";
import {
  SUBSCRIPTION_PLANS_RESOURCE,
  subscriptionsApi,
} from "@/api/subscriptions.api";
import { EditButton } from "@/components/refine-ui/buttons/edit";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SubscriptionPlan } from "@/types/subscription";

export const PlanRowActions = ({ plan }: { plan: SubscriptionPlan }) => {
  const { open } = useNotification();
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);

  const refresh = () =>
    invalidate({
      resource: SUBSCRIPTION_PLANS_RESOURCE,
      invalidates: ["list"],
    });

  const handleDelete = async () => {
    setBusy(true);
    try {
      const result = await subscriptionsApi.deletePlan(plan.id);
      open?.({
        type: "success",
        message: result.deactivated
          ? "Plan deactivated (in use)"
          : "Plan deleted",
        description: result.deactivated
          ? "The plan is referenced by a subscription, so it was deactivated instead of removed."
          : undefined,
      });
      await refresh();
    } catch (error) {
      open?.({ type: "error", message: toApiError(error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("flex", "items-center", "gap-1")}>
      <EditButton
        resource={SUBSCRIPTION_PLANS_RESOURCE}
        recordItemId={plan.id}
        variant="ghost"
        size="icon"
        aria-label="Edit plan"
      >
        <PencilIcon className="h-4 w-4" />
      </EditButton>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete plan"
            disabled={busy}
          >
            <TrashIcon className={cn("h-4", "w-4", "text-destructive")} />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{plan.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              A plan still referenced by a subscription is deactivated instead
              of deleted. Unreferenced plans are permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => void handleDelete()}
            >
              {busy ? (
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

PlanRowActions.displayName = "PlanRowActions";

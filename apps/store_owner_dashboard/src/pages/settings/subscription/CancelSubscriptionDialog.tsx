"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { toApiError } from "@/api/client";
import { subscriptionsApi } from "@/api/subscriptions.api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CancelSubscriptionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deadline: string | null;
  onCancelled: () => void;
};

const formatDate = (value: string | null) =>
  value ? new Date(value).toLocaleDateString() : null;

export const CancelSubscriptionDialog = ({
  open,
  onOpenChange,
  deadline,
  onCancelled,
}: CancelSubscriptionDialogProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (!next) setError(null);
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await subscriptionsApi.cancelSubscription();
      toast.success("Subscription cancelled and refund requested");
      onCancelled();
      handleOpenChange(false);
    } catch (e) {
      setError(toApiError(e).message);
    } finally {
      setSubmitting(false);
    }
  };

  const deadlineLabel = formatDate(deadline);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel subscription &amp; request refund?</DialogTitle>
          <DialogDescription>
            This cannot be undone. Your latest payment will be refunded in full
            and your store will immediately drop to the Free plan.
            {deadlineLabel
              ? ` The refund window closes on ${deadlineLabel}.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Keep subscription
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={submitting}
            className="h-auto w-full whitespace-normal text-center sm:w-auto"
          >
            {submitting ? (
              <>
                <LoaderCircle className="animate-spin" />
                Cancelling…
              </>
            ) : (
              "Cancel subscription & request refund"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

CancelSubscriptionDialog.displayName = "CancelSubscriptionDialog";

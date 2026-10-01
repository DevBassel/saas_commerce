"use client";

import { useState } from "react";
import { useInvalidate, useNotification } from "@refinedev/core";
import { Loader2Icon } from "lucide-react";

import { toApiError } from "@/api/client";
import {
  CURRENCY_REQUESTS_RESOURCE,
  currencyRequestsApi,
} from "@/api/currency-requests.api";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CurrencyChangeRequest } from "@/types/currency-request";

export const CurrencyRequestActions = ({
  request,
}: {
  request: CurrencyChangeRequest;
}) => {
  const { open } = useNotification();
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [note, setNote] = useState("");

  const refresh = () =>
    invalidate({
      resource: CURRENCY_REQUESTS_RESOURCE,
      invalidates: ["list"],
    });

  if (request.status !== "PENDING") {
    return <span className={cn("text-xs", "text-muted-foreground")}>—</span>;
  }

  const handleApprove = async () => {
    setBusy(true);
    try {
      await currencyRequestsApi.approve(request.id);
      open?.({
        type: "success",
        message: "Currency change approved",
        description:
          "Display currency updated. Existing prices are not converted.",
      });
      await refresh();
    } catch (error) {
      open?.({ type: "error", message: toApiError(error).message });
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    const trimmed = note.trim();
    if (!trimmed) {
      open?.({ type: "error", message: "A reason is required to reject" });
      return;
    }
    setBusy(true);
    try {
      await currencyRequestsApi.reject(request.id, trimmed);
      open?.({ type: "success", message: "Currency change rejected" });
      setRejectOpen(false);
      setNote("");
      await refresh();
    } catch (error) {
      open?.({ type: "error", message: toApiError(error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("flex", "items-center", "gap-2")}>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" disabled={busy}>
            Approve
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve currency change?</AlertDialogTitle>
            <AlertDialogDescription>
              This changes the display currency only. Existing prices keep their
              numeric values and are not converted, and card payments are still
              charged in USD.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => void handleApprove()}
            >
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Button
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => setRejectOpen(true)}
      >
        Reject
      </Button>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject currency change</DialogTitle>
            <DialogDescription>
              Provide a short reason. The store owner will see this note.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            placeholder="Reason for rejection"
          />
          <DialogFooter>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setRejectOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy || !note.trim()}
              onClick={() => void handleReject()}
            >
              {busy ? <Loader2Icon className="h-4 w-4 animate-spin" /> : null}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

CurrencyRequestActions.displayName = "CurrencyRequestActions";

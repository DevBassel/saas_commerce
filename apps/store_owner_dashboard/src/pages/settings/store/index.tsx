"use client";

import { useState } from "react";
import { useCustom, useNotification } from "@refinedev/core";
import { Loader2 } from "lucide-react";

import { currencyApi } from "@/api/currency.api";
import { toApiError } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { CURRENCIES, currencyLabel } from "@/lib/currency";
import { cn } from "@/lib/utils";
import type {
  CurrencyChangeRequest,
  StoreCurrencyState,
} from "@/types/currency";

const STATUS_VARIANT: Record<
  CurrencyChangeRequest["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  PENDING: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
  CANCELLED: "outline",
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "—";

export const StoreSettings = () => {
  const { open } = useNotification();
  const [selected, setSelected] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const { query } = useCustom<StoreCurrencyState>({
    url: "store/currency",
    method: "get",
  });

  const state = query.data?.data;
  const currentCurrency = state?.currency ?? "usd";
  const pending = state?.pendingRequest ?? null;
  const apiError = query.error ? toApiError(query.error) : null;

  const handleSubmit = async () => {
    if (busy || !selected || selected === currentCurrency) return;
    setBusy(true);
    try {
      await currencyApi.createRequest({
        requestedCurrency: selected,
        reason: reason.trim() || undefined,
      });
      open?.({
        type: "success",
        message: "Currency change requested",
        description: "A platform administrator will review your request.",
      });
      setSelected("");
      setReason("");
      await query.refetch();
    } catch (error) {
      open?.({
        type: "error",
        message: "Could not submit the request",
        description: toApiError(error).message,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async (request: CurrencyChangeRequest) => {
    if (busy) return;
    setBusy(true);
    try {
      await currencyApi.cancelRequest(request.id);
      open?.({
        type: "success",
        message: "Request cancelled",
      });
      await query.refetch();
    } catch (error) {
      open?.({
        type: "error",
        message: "Could not cancel the request",
        description: toApiError(error).message,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("flex", "flex-col", "gap-6", "p-4")}>
      <div className={cn("flex", "flex-col", "gap-1")}>
        <h1 className="text-2xl font-semibold">Store settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage the currency used to display prices across your store.
        </p>
      </div>

      {query.isLoading ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className={cn("flex", "flex-col", "gap-3")}>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ) : apiError ? (
        <Card>
          <CardHeader>
            <CardTitle>Could not load store currency</CardTitle>
            <CardDescription>{apiError.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              onClick={() => void query.refetch()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className={cn("flex", "flex-row", "items-center", "justify-between")}>
              <div className={cn("flex", "flex-col", "gap-1")}>
                <CardTitle>Display currency</CardTitle>
                <CardDescription>
                  Current currency: {currencyLabel(currentCurrency)}
                </CardDescription>
              </div>
              <Badge variant="default">{currentCurrency.toUpperCase()}</Badge>
            </CardHeader>
            <CardContent className={cn("flex", "flex-col", "gap-4")}>
              <p className="text-sm text-muted-foreground">
                Currency is a display setting only. Existing prices keep their
                numeric values and are not converted. Card payments are still
                charged in USD.
              </p>

              {pending ? (
                <div
                  className={cn(
                    "flex",
                    "flex-col",
                    "gap-3",
                    "rounded-md",
                    "border",
                    "p-4",
                  )}
                >
                  <div className={cn("flex", "items-center", "justify-between")}>
                    <div className={cn("flex", "flex-col", "gap-1")}>
                      <span className="text-sm font-medium">
                        Pending request
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {pending.currentCurrency.toUpperCase()} →{" "}
                        {pending.requestedCurrency.toUpperCase()}
                      </span>
                    </div>
                    <Badge variant="secondary">Pending</Badge>
                  </div>
                  {pending.reason ? (
                    <span className="text-sm text-muted-foreground">
                      Reason: {pending.reason}
                    </span>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void handleCancel(pending)}
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Cancel request
                  </Button>
                </div>
              ) : (
                <div className={cn("flex", "flex-col", "gap-3")}>
                  <Select value={selected} onValueChange={setSelected}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a new currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((option) => (
                        <SelectItem
                          key={option.code}
                          value={option.code}
                          disabled={option.code === currentCurrency}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Optional reason for the change"
                    maxLength={500}
                  />
                  <Button
                    type="button"
                    disabled={
                      busy || !selected || selected === currentCurrency
                    }
                    onClick={() => void handleSubmit()}
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Request currency change
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {state?.history?.length ? (
            <Card>
              <CardHeader>
                <CardTitle>Recent requests</CardTitle>
              </CardHeader>
              <CardContent className={cn("flex", "flex-col")}>
                {state.history.map((request, index) => (
                  <div key={request.id}>
                    {index > 0 ? <Separator /> : null}
                    <div
                      className={cn(
                        "flex",
                        "items-center",
                        "justify-between",
                        "gap-4",
                        "py-3",
                      )}
                    >
                      <div className={cn("flex", "flex-col", "gap-1")}>
                        <span className="text-sm font-medium">
                          {request.currentCurrency.toUpperCase()} →{" "}
                          {request.requestedCurrency.toUpperCase()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(request.createdAt)}
                          {request.reviewNote
                            ? ` · ${request.reviewNote}`
                            : ""}
                        </span>
                      </div>
                      <Badge variant={STATUS_VARIANT[request.status]}>
                        {request.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
};

StoreSettings.displayName = "StoreSettings";

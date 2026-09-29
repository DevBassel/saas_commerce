"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useCustom, useNotification, useShow } from "@refinedev/core";
import { format } from "date-fns";
import { ChevronDownIcon, Loader2, RefreshCcw } from "lucide-react";

import { PAYMENTS_RESOURCE, paymentsApi } from "@/api/payments.api";
import { toApiError } from "@/api/client";
import { DetailRow } from "@/components/refine-ui/views/detail-row";
import {
  BalanceValue,
  StatusRow,
} from "@/components/payments/stripe-display";
import {
  ShowView,
  ShowViewHeader,
} from "@/components/refine-ui/views/show-view";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatCurrency, formatMinorUnits } from "@/lib/utils";
import type {
  PlatformCharge,
  PlatformChargesResponse,
  PlatformPaymentOverview,
  PlatformPayout,
  PlatformPayoutsResponse,
} from "@/types/payments";

const CHARGE_PAGE_SIZE = 25;
const PAYOUT_PAGE_SIZE = 25;

const LoadingRows = () => (
  <div className={cn("flex", "flex-col", "gap-2", "rounded-md", "border", "p-4")}>
    {Array.from({ length: 5 }).map((_, index) => (
      <Skeleton key={`loading-row-${index}`} className="h-8 w-full" />
    ))}
  </div>
);

const InfoCard = ({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      {description ? <CardDescription>{description}</CardDescription> : null}
    </CardHeader>
    {action ? <CardContent>{action}</CardContent> : null}
  </Card>
);

const RetryAction = ({ onRetry }: { onRetry: () => void }) => (
  <Button variant="outline" onClick={onRetry}>
    Retry
  </Button>
);

const PauseControl = ({
  title,
  description,
  paused,
  disabled,
  busy,
  onToggle,
}: {
  title: string;
  description: string;
  paused: boolean;
  disabled?: boolean;
  busy?: boolean;
  onToggle: () => void;
}) => (
  <div
    className={cn(
      "flex",
      "items-center",
      "justify-between",
      "gap-4",
      "py-3",
    )}
  >
    <div className={cn("flex", "flex-col", "gap-0.5")}>
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </div>
    <div className={cn("flex", "items-center", "gap-3")}>
      <Badge variant={paused ? "destructive" : "default"}>
        {paused ? "Paused" : "Active"}
      </Badge>
      {busy ? (
        <Loader2
          className={cn("h-4", "w-4", "animate-spin", "text-muted-foreground")}
        />
      ) : null}
      <Switch
        checked={paused}
        disabled={disabled || busy}
        onCheckedChange={() => onToggle()}
        aria-label={paused ? `Resume ${title}` : `Pause ${title}`}
      />
    </div>
  </div>
);

const OverviewTab = ({
  overview,
  onRefetch,
}: {
  overview: PlatformPaymentOverview;
  onRefetch: () => Promise<unknown>;
}) => {
  const { open } = useNotification();
  const [busy, setBusy] = useState<"payments" | "payouts" | null>(null);
  const [pending, setPending] = useState<{
    kind: "payments" | "payouts";
    nextPaused: boolean;
  } | null>(null);

  const tenantId = overview.tenant.id;
  const connected = overview.account.connected;

  const pendingNoun = pending?.kind === "payments" ? "Payments" : "Payouts";
  const pendingAction = pending?.nextPaused ? "Pause" : "Resume";

  const describePending = (): string => {
    if (!pending) return "";
    if (pending.kind === "payments") {
      return pending.nextPaused
        ? "New checkouts for this store will be blocked until you resume payments."
        : "Payments will be accepted again for this store.";
    }
    return pending.nextPaused
      ? "Automatic payouts to the store's bank account will be held until you resume them."
      : "Automatic payouts to the store's bank account will resume.";
  };

  const confirmToggle = async () => {
    if (!pending) return;
    const { kind, nextPaused } = pending;
    const noun = kind === "payments" ? "Payments" : "Payouts";

    setBusy(kind);
    try {
      if (kind === "payments") {
        await paymentsApi.setPaymentsPaused(tenantId, nextPaused);
      } else {
        await paymentsApi.setPayoutsPaused(tenantId, nextPaused);
      }
      open?.({
        type: "success",
        message: `${noun} ${nextPaused ? "paused" : "resumed"}`,
      });
      setPending(null);
      await onRefetch();
    } catch (error) {
      open?.({ type: "error", message: toApiError(error).message });
    } finally {
      setBusy(null);
    }
  };

  const balance = overview.balance;

  return (
    <div className={cn("flex", "flex-col", "gap-4")}>
      <Card>
        <CardHeader>
          <div className={cn("flex", "items-center", "justify-between", "gap-4")}>
            <div className={cn("flex", "flex-col", "gap-1")}>
              <CardTitle className={cn("flex", "items-center", "gap-3")}>
                Stripe account
                <Badge variant={connected ? "default" : "secondary"}>
                  {connected ? "Connected" : "Not connected"}
                </Badge>
              </CardTitle>
              <CardDescription>
                {connected
                  ? "Connected account status and balances."
                  : "This store has not connected a Stripe account yet."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent>
          <div className={cn("flex", "flex-col")}>
            <StatusRow label="Charges" enabled={overview.account.chargesEnabled} />
            <Separator />
            <StatusRow label="Payouts" enabled={overview.account.payoutsEnabled} />
            <Separator />
            <StatusRow
              label="Details submitted"
              enabled={overview.account.detailsSubmitted}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Money flow</CardTitle>
          <CardDescription>
            Available and pending balances on the connected account.
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent>
          {connected && balance ? (
            <div
              className={cn(
                "grid",
                "gap-6",
                "sm:grid-cols-2",
                "lg:grid-cols-3",
              )}
            >
              <DetailRow
                label="Available balance"
                value={<BalanceValue entries={balance.available} />}
              />
              <DetailRow
                label="Pending balance"
                value={<BalanceValue entries={balance.pending} />}
              />
              <DetailRow
                label="Payout schedule"
                value={overview.payoutScheduleInterval ?? "—"}
              />
            </div>
          ) : (
            <p className={cn("text-sm", "text-muted-foreground")}>
              Balance is unavailable until the store is connected to Stripe.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pause controls</CardTitle>
          <CardDescription>
            Pausing payments blocks new checkouts; pausing payouts sets the
            connected account's payout schedule to manual.
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className={cn("flex", "flex-col", "divide-y")}>
          <PauseControl
            title="Payments"
            description="Block new payment attempts for this store"
            paused={overview.paymentsPaused}
            busy={busy === "payments"}
            onToggle={() =>
              setPending({
                kind: "payments",
                nextPaused: !overview.paymentsPaused,
              })
            }
          />
          <PauseControl
            title="Payouts"
            description={
              connected
                ? "Hold automatic payouts to the store's bank account"
                : "Available once the store is connected to Stripe"
            }
            paused={overview.payoutsPaused}
            disabled={!connected}
            busy={busy === "payouts"}
            onToggle={() =>
              setPending({
                kind: "payouts",
                nextPaused: !overview.payoutsPaused,
              })
            }
          />
        </CardContent>
      </Card>

      <AlertDialog
        open={pending !== null}
        onOpenChange={(next) => {
          if (!next && busy === null) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction} {pendingNoun.toLowerCase()} for{" "}
              {overview.tenant.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>{describePending()}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                buttonVariants({
                  variant: pending?.nextPaused ? "destructive" : "default",
                }),
              )}
              disabled={busy !== null}
              onClick={(event) => {
                event.preventDefault();
                void confirmToggle();
              }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {pendingAction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const PayoutsTab = ({
  tenantId,
  connected,
}: {
  tenantId: number;
  connected: boolean;
}) => {
  const [items, setItems] = useState<PlatformPayout[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const { query } = useCustom<PlatformPayoutsResponse>({
    url: `${PAYMENTS_RESOURCE}/${tenantId}/payouts`,
    method: "get",
    config: {
      query: cursor
        ? { limit: PAYOUT_PAGE_SIZE, startingAfter: cursor }
        : { limit: PAYOUT_PAGE_SIZE },
    },
    queryOptions: { enabled: connected },
  });

  const page = query.data?.data;

  useEffect(() => {
    if (!page) return;
    setItems((previous) => {
      const seen = new Set(previous.map((item) => item.id));
      const next = page.data.filter((item) => !seen.has(item.id));
      return next.length > 0 ? [...previous, ...next] : previous;
    });
  }, [page]);

  if (!connected) {
    return (
      <InfoCard
        title="Not connected to Stripe"
        description="Payouts are only available for stores with a connected Stripe account."
      />
    );
  }

  if (query.isLoading && items.length === 0) return <LoadingRows />;

  if (query.isError) {
    return (
      <InfoCard
        title="Could not load payouts"
        description={toApiError(query.error).message}
        action={<RetryAction onRetry={() => void query.refetch()} />}
      />
    );
  }

  if (items.length === 0) {
    return (
      <InfoCard
        title="No payouts yet"
        description="This connected account has no payouts to display."
        action={<RetryAction onRetry={() => void query.refetch()} />}
      />
    );
  }

  const handleRefresh = () => {
    setItems([]);
    if (cursor === undefined) void query.refetch();
    else setCursor(undefined);
  };

  return (
    <div className={cn("flex", "flex-col", "gap-4")}>
      <div className={cn("flex", "justify-end")}>
        <Button
          variant="outline"
          size="sm"
          disabled={query.isFetching}
          onClick={handleRefresh}
        >
          <RefreshCcw
            className={cn("h-4 w-4", { "animate-spin": query.isFetching })}
          />
          Refresh
        </Button>
      </div>
      <div className={cn("rounded-md", "border")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Currency</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Arrival</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((payout) => (
              <TableRow key={payout.id}>
                <TableCell className="font-mono text-xs">{payout.id}</TableCell>
                <TableCell>{formatMinorUnits(payout.amount, payout.currency)}</TableCell>
                <TableCell className="uppercase">{payout.currency}</TableCell>
                <TableCell>{payout.status}</TableCell>
                <TableCell>{payout.method}</TableCell>
                <TableCell>
                  {format(new Date(payout.arrivalDate * 1000), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  {format(new Date(payout.created * 1000), "MMM d, yyyy HH:mm")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {page?.hasMore && page.nextCursor ? (
        <div className={cn("flex", "justify-center")}>
          <Button
            variant="outline"
            disabled={query.isFetching}
            onClick={() => setCursor(page.nextCursor ?? undefined)}
          >
            {query.isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
};

type ChargeGroup = {
  key: string;
  orderId: number;
  orderNumber: string | null;
  charges: PlatformCharge[];
};

/** Groups the page's charges by order, keeping the API's newest-first order. */
const groupChargesByOrder = (charges: PlatformCharge[]): ChargeGroup[] => {
  const groups = new Map<string, ChargeGroup>();
  for (const charge of charges) {
    const key = charge.orderNumber ?? `#${charge.orderId}`;
    const existing = groups.get(key);
    if (existing) {
      existing.charges.push(charge);
    } else {
      groups.set(key, {
        key,
        orderId: charge.orderId,
        orderNumber: charge.orderNumber,
        charges: [charge],
      });
    }
  }
  return Array.from(groups.values());
};

const CHARGE_GRID =
  "grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.6fr)_minmax(0,0.9fr)_minmax(0,1.1fr)_minmax(0,0.8fr)_1rem] items-center gap-3";

const chargeOrderLabel = (charge: PlatformCharge) =>
  charge.orderNumber ?? `#${charge.orderId}`;

const formatTimestamp = (value: string | null) =>
  value ? format(new Date(value), "MMM d, yyyy HH:mm") : "—";

const ChargeSummaryCells = ({
  charge,
  trailing,
}: {
  charge: PlatformCharge;
  trailing?: ReactNode;
}) => (
  <>
    <span className="text-muted-foreground">
      {format(new Date(charge.createdAt), "MMM d, yyyy HH:mm")}
    </span>
    <span className="flex min-w-0 items-center gap-2 font-medium">
      <span className="truncate">{chargeOrderLabel(charge)}</span>
      {trailing}
    </span>
    <span>{formatCurrency(charge.amount, charge.currency)}</span>
    <span className="uppercase">{charge.currency}</span>
    <span>{charge.status}</span>
    <span className="truncate font-mono text-xs">
      {charge.paymentRef ?? "—"}
    </span>
    <span>{formatCurrency(charge.refundedAmount, charge.currency)}</span>
  </>
);

type ChargeBadgeVariant = "default" | "secondary" | "destructive" | "outline";

const chargeBadgeVariant = (status: string): ChargeBadgeVariant => {
  switch (status) {
    case "PAID":
      return "default";
    case "FAILED":
    case "CANCELED":
      return "destructive";
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
      return "secondary";
    default:
      return "outline";
  }
};

const chargeDotClass = (status: string) =>
  status === "PAID"
    ? "bg-primary"
    : status === "FAILED" || status === "CANCELED"
      ? "bg-destructive"
      : "bg-muted-foreground";

const HistoryChild = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <span className={cn("grid", "grid-cols-[5.5rem_1fr]", "gap-2")}>
    <span>{label}</span>
    <span className={cn("text-foreground/80")}>{children}</span>
  </span>
);

/** Renders the order's payment attempts as a tree, newest first. */
const OrderHistoryTree = ({ charges }: { charges: PlatformCharge[] }) => (
  <div className={cn("flex", "flex-col")}>
    {charges.map((charge, index) => (
      <div
        key={charge.id}
        className={cn("relative", "pb-4", "pl-6", "last:pb-0")}
      >
        {index < charges.length - 1 ? (
          <span
            aria-hidden
            className={cn(
              "absolute",
              "top-4",
              "bottom-0",
              "left-[7px]",
              "w-px",
              "bg-border",
            )}
          />
        ) : null}
        <span
          aria-hidden
          className={cn(
            "absolute",
            "top-1.5",
            "left-1",
            "size-2",
            "rounded-full",
            chargeDotClass(charge.status),
          )}
        />
        <div
          className={cn(
            "flex",
            "flex-wrap",
            "items-center",
            "gap-2",
            "text-sm",
          )}
        >
          <span className="font-medium">Attempt #{charge.id}</span>
          <Badge variant={chargeBadgeVariant(charge.status)}>
            {charge.status}
          </Badge>
          <span className={cn("font-mono", "text-xs", "text-muted-foreground")}>
            {charge.paymentRef ?? "—"}
          </span>
        </div>
        <div
          className={cn(
            "mt-1",
            "ml-[7px]",
            "flex",
            "flex-col",
            "gap-1",
            "border-l",
            "border-border",
            "py-1",
            "pl-4",
            "text-xs",
            "text-muted-foreground",
          )}
        >
          <HistoryChild label="Created">
            {formatTimestamp(charge.createdAt)}
          </HistoryChild>
          <HistoryChild label="Paid">
            {formatTimestamp(charge.paidAt)}
          </HistoryChild>
          <HistoryChild label="Refunded">
            {formatTimestamp(charge.refundedAt)}
          </HistoryChild>
          <HistoryChild label="Amount">
            {formatCurrency(charge.amount, charge.currency)}
            {charge.refundedAmount > 0
              ? ` · refunded ${formatCurrency(
                  charge.refundedAmount,
                  charge.currency,
                )}`
              : ""}
          </HistoryChild>
        </div>
      </div>
    ))}
  </div>
);

const ChargesTab = ({ tenantId }: { tenantId: number }) => {
  const [page, setPage] = useState(1);

  const { query } = useCustom<PlatformChargesResponse>({
    url: `${PAYMENTS_RESOURCE}/${tenantId}/charges`,
    method: "get",
    config: { query: { page, limit: CHARGE_PAGE_SIZE } },
  });

  const result = query.data?.data;
  const charges = useMemo(() => result?.data ?? [], [result]);
  const total = result?.total ?? 0;
  const pageCount = Math.max(Math.ceil(total / CHARGE_PAGE_SIZE), 1);

  const orderGroups = useMemo(() => groupChargesByOrder(charges), [charges]);

  if (query.isLoading) return <LoadingRows />;

  if (query.isError) {
    return (
      <InfoCard
        title="Could not load charges"
        description={toApiError(query.error).message}
        action={<RetryAction onRetry={() => void query.refetch()} />}
      />
    );
  }

  if (charges.length === 0) {
    return (
      <InfoCard
        title="No charges yet"
        description="This store has no local payment records."
      />
    );
  }

  return (
    <div className={cn("flex", "flex-col", "gap-4")}>
      <Accordion
        type="multiple"
        className={cn("overflow-hidden", "rounded-md", "border")}
      >
        <div
          className={cn(
            CHARGE_GRID,
            "border-b",
            "bg-muted/40",
            "px-4",
            "py-2",
            "text-xs",
            "font-medium",
            "text-muted-foreground",
          )}
        >
          <span>Date</span>
          <span>Order</span>
          <span>Amount</span>
          <span>Currency</span>
          <span>Status</span>
          <span>Payment ref</span>
          <span>Refunded</span>
          <span aria-hidden />
        </div>

        {orderGroups.map((group) => (
          <AccordionItem key={group.key} value={group.key}>
            <AccordionTrigger
              className={cn(
                "group",
                "px-4",
                "py-3",
                "text-sm",
                "hover:no-underline",
                "[&>svg]:hidden",
              )}
            >
              <div className={cn(CHARGE_GRID, "flex-1")}>
                <ChargeSummaryCells
                  charge={group.charges[0]}
                  trailing={
                    <Badge variant="secondary">
                      {group.charges.length} payment
                      {group.charges.length === 1 ? "" : "s"}
                    </Badge>
                  }
                />
                <ChevronDownIcon
                  className={cn(
                    "size-4",
                    "text-muted-foreground",
                    "transition-transform",
                    "duration-200",
                    "group-data-[state=open]:rotate-180",
                  )}
                />
              </div>
            </AccordionTrigger>
            <AccordionContent className={cn("px-4")}>
              <div className={cn("flex", "flex-col", "gap-2")}>
                <span
                  className={cn(
                    "text-xs",
                    "font-medium",
                    "tracking-wide",
                    "text-muted-foreground",
                    "uppercase",
                  )}
                >
                  Order history
                </span>
                <OrderHistoryTree charges={group.charges} />
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <div className={cn("flex", "items-center", "justify-between")}>
        <span className="text-sm text-muted-foreground">
          Page {page} of {pageCount} · {total} charge{total === 1 ? "" : "s"} ·{" "}
          {orderGroups.length} order{orderGroups.length === 1 ? "" : "s"} on this
          page
        </span>
        <div className={cn("flex", "gap-2")}>
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || query.isFetching}
            onClick={() => setPage((current) => Math.max(current - 1, 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount || query.isFetching}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};

export const PaymentsShow = () => {
  const { query } = useShow<PlatformPaymentOverview>({
    resource: PAYMENTS_RESOURCE,
  });
  const [activeTab, setActiveTab] = useState("overview");

  const overview = query.data?.data;
  const connected = overview?.account.connected ?? false;

  return (
    <ShowView>
      <ShowViewHeader title={overview?.tenant.name} hideEdit />
      {query.isLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <Skeleton className="h-6 w-48" />
            </CardTitle>
          </CardHeader>
          <CardContent className={cn("flex", "flex-col", "gap-4")}>
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={`overview-skeleton-${index}`} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : !overview ? (
        <p
          className={cn(
            "py-8",
            "text-center",
            "text-sm",
            "text-muted-foreground",
          )}
        >
          Tenant not found.
        </p>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="payouts" disabled={!connected}>
              Payouts
            </TabsTrigger>
            <TabsTrigger value="charges">Charges</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <OverviewTab
              overview={overview}
              onRefetch={() => query.refetch()}
            />
          </TabsContent>
          <TabsContent value="payouts">
            {activeTab === "payouts" ? (
              <PayoutsTab
                tenantId={overview.tenant.id}
                connected={connected}
              />
            ) : null}
          </TabsContent>
          <TabsContent value="charges">
            {activeTab === "charges" ? (
              <ChargesTab tenantId={overview.tenant.id} />
            ) : null}
          </TabsContent>
        </Tabs>
      )}
    </ShowView>
  );
};

PaymentsShow.displayName = "PaymentsShow";

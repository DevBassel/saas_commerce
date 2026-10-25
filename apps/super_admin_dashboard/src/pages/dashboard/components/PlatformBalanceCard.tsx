import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { DetailRow } from "@/components/refine-ui/views/detail-row";
import { BalanceValue } from "@/components/payments/stripe-display";
import type { PlatformStripeSummary } from "@/types/payments";

interface PlatformBalanceCardProps {
  stripeQuery: {
    isLoading: boolean;
    data?: { data?: PlatformStripeSummary | null } | null;
  };
}

export function PlatformBalanceCard({ stripeQuery }: PlatformBalanceCardProps) {
  const stripeSummary = stripeQuery.data?.data;
  const stripeBalance = stripeSummary?.balance ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform balance</CardTitle>
        <CardDescription>
          Available and pending balances on the platform account.
        </CardDescription>
      </CardHeader>
      <Separator />
      <CardContent>
        {stripeQuery.isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : stripeBalance ? (
          <div className="grid gap-6 sm:grid-cols-2">
            <DetailRow
              label="Available"
              value={<BalanceValue entries={stripeBalance.available} />}
            />
            <DetailRow
              label="Pending"
              value={<BalanceValue entries={stripeBalance.pending} />}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Balance is unavailable.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
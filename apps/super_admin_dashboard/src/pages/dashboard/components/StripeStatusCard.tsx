import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { StatusRow } from "@/components/payments/stripe-display";
import type { PlatformStripeSummary } from "@/types/payments";

interface StripeStatusCardProps {
  stripeQuery: {
    isLoading: boolean;
    data?: { data?: PlatformStripeSummary | null } | null;
  };
}

export function StripeStatusCard({ stripeQuery }: StripeStatusCardProps) {
  const stripeSummary = stripeQuery.data?.data;
  const stripeAccount = stripeSummary?.account ?? null;
  const stripeUnavailableMessage =
    stripeSummary?.error ?? "Stripe is unavailable";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          Platform Stripe status
          {stripeQuery.isLoading ? (
            <Skeleton className="h-5 w-24" />
          ) : (
            <Badge variant={stripeAccount ? "default" : "secondary"}>
              {stripeAccount ? "Connected" : "Unavailable"}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Capability status of the platform's own Stripe account.
        </CardDescription>
      </CardHeader>
      <Separator />
      <CardContent>
        {stripeQuery.isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : stripeAccount ? (
          <div className="flex flex-col">
            <StatusRow label="Charges" enabled={stripeAccount.chargesEnabled} />
            <Separator />
            <StatusRow label="Payouts" enabled={stripeAccount.payoutsEnabled} />
            <Separator />
            <StatusRow
              label="Details submitted"
              enabled={stripeAccount.detailsSubmitted}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {stripeUnavailableMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
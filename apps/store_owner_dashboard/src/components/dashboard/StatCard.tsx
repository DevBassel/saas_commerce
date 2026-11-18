import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

export const StatCard = ({
  title,
  value,
  icon: Icon,
  isLoading,
  isError,
  className,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  isLoading: boolean;
  isError: boolean;
  className?: string;
}) => (
  <Card className={className}>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">
        {title}
      </CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <Skeleton className="h-8 w-16" />
      ) : (
        <div className="text-2xl font-bold">{isError ? "—" : value}</div>
      )}
    </CardContent>
  </Card>
);

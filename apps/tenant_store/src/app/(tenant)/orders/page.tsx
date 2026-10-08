import { GetUserOrdersPage, type IOrder } from "@/api/orderApi";
import { toApiError } from "@/api/handleError";
import ApiErrorFallback from "@/components/ApiErrorFallback";
import OrderItem from "@/components/cart/orderItem";
import OrderPaymentWatcher from "@/components/orders/OrderPaymentWatcher";
import Pagination from "@/components/shared/Pagination";
import { BrushCleaning } from "lucide-react";
import { apiClient } from "@/api/apiClient";

const PAGE_SIZE = 10;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const parsedPage = Number(pageParam);
  const page = Number.isInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

  let orders: IOrder[] = [];
  let total = 0;
  let pageCount = 1;
  let loadError: string | null = null;

  try {
    const result = await GetUserOrdersPage(
      { page, limit: PAGE_SIZE },
      undefined,
      apiClient,
    );
    orders = result.data;
    total = result.total;
    pageCount = Math.max(Math.ceil(result.total / result.limit), 1);
  } catch (error) {
    loadError = toApiError(error).message;
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Your orders</h1>
        {!loadError && (
          <p className="text-muted-foreground">
            {total} {total === 1 ? "order" : "orders"} placed
          </p>
        )}
      </header>

      {orders.length > 0 && <OrderPaymentWatcher orders={orders} />}

      {loadError ? (
        <ApiErrorFallback
          title="Couldn't load your orders"
          message={loadError}
        />
      ) : total > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {orders.map((order) => (
              <OrderItem key={`order-item-${order.id}`} order={order} />
            ))}
          </div>
          <Pagination basePath="/orders" page={page} pageCount={pageCount} />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 py-24">
          <BrushCleaning size={200} className="text-muted-foreground/40" />
          <p className="text-2xl">No orders yet</p>
        </div>
      )}
    </div>
  );
}

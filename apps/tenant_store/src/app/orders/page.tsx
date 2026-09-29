import { GetUserOrders, type IOrder } from "@/api/orderApi";
import { toApiError } from "@/api/handelError";
import ApiErrorFallback from "@/components/ApiErrorFallback";
import OrderItem from "@/components/cart/orderItem";
import OrderPaymentWatcher from "@/components/orders/OrderPaymentWatcher";
import { BrushCleaning } from "lucide-react";
import { apiClient } from "@/api/apiClient";

export default async function OrdersPage() {
  let orders: IOrder[] = [];
  let loadError: string | null = null;

  try {
    orders = await GetUserOrders(undefined, apiClient);
  } catch (error) {
    loadError = toApiError(error).message;
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Your orders</h1>
        {!loadError && (
          <p className="text-muted-foreground">
            {orders.length} {orders.length === 1 ? "order" : "orders"} placed
          </p>
        )}
      </header>

      {orders.length > 0 && <OrderPaymentWatcher orders={orders} />}

      {loadError ? (
        <ApiErrorFallback
          title="Couldn't load your orders"
          message={loadError}
        />
      ) : orders.length ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {orders.map((order) => (
            <OrderItem key={`order-item-${order.id}`} order={order} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 py-24">
          <BrushCleaning size={200} className="text-muted-foreground/40" />
          <p className="text-2xl">No orders yet</p>
        </div>
      )}
    </div>
  );
}

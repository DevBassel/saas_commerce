import { apiClient } from "@/api/apiClient";
import { GetUserCart, type ICart } from "@/api/cartApi";
import ApiErrorFallback from "@/components/ApiErrorFallback";
import CartItems from "@/components/cart/CartItems";

export default async function CartPage() {
  let userCart: ICart | null = null;
  let loadError: string | null = null;

  try {
    userCart = await GetUserCart(apiClient);
  } catch (error) {
    loadError = (error as Error).message;
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Your cart</h1>
        <p className="text-muted-foreground">
          Review your items before checkout.
        </p>
      </header>
      {loadError ? (
        <ApiErrorFallback title="Couldn't load your cart" message={loadError} />
      ) : (
        <CartItems items={userCart?.items || []} />
      )}
    </div>
  );
}

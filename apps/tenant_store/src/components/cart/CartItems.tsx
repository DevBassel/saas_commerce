"use client";
import { ICartItem } from "@/api/cartApi";
import { Button } from "../ui/button";
import { BrushCleaning } from "lucide-react";
import { useRouter } from "next/navigation";
import CartItemCard from "./cartItemCard";
import PlaceOrder from "./PlaceOrder";

export default function CartItems({ items }: { items: ICartItem[] }) {
  const router = useRouter();
  const subtotal = items.reduce((acc, item) => acc + item.lineTotal, 0);
  const totalQuantity = items.reduce((acc, item) => acc + item.quantity, 0);

  if (!items.length) {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-4 py-24">
        <BrushCleaning size={200} className="text-muted-foreground/40" />
        <p className="text-2xl">Your cart is empty</p>
        <Button onClick={() => router.push("/products")}>Shop now</Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="flex flex-col gap-4">
        {items.map((item) => (
          <CartItemCard key={`CART_ITEM_${item.productId}`} item={item} />
        ))}
      </div>

      <aside className="flex h-fit flex-col gap-4 rounded-3xl border border-border bg-card p-5 lg:sticky lg:top-24">
        <h2 className="text-lg font-semibold">Order summary</h2>
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Items</span>
            <span>{totalQuantity}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-4">
          <span className="font-medium">Total</span>
          <span className="text-xl font-bold text-primary">
            ${subtotal.toFixed(2)}
          </span>
        </div>
        <PlaceOrder />
      </aside>
    </div>
  );
}

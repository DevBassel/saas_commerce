"use client";
import { ICartItem, RemoveItemFromCart } from "@/api/cartApi";
import Image from "next/image";
import { Button } from "../ui/button";
import { Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useCurrency } from "@/components/currency/currency-provider";
import { formatMoney } from "@/lib/money";

export default function CartItemCard({ item }: { item: ICartItem }) {
  const router = useRouter();
  const currency = useCurrency();

  const removeItem = async () => {
    try {
      await RemoveItemFromCart({ productId: item.productId });
      toast.success("Item removed from cart");
      router.refresh();
    } catch (error) {}
  };

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-4 sm:flex-row">
      <div className="relative h-40 w-full overflow-hidden rounded-xl bg-muted sm:h-24 sm:w-24 sm:shrink-0">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.name}
            fill
            sizes="96px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            No image
          </div>
        )}
      </div>

      <div className="flex w-full flex-col gap-1">
        <h3 className="line-clamp-1 font-semibold">{item.name}</h3>
        <p className="text-sm text-muted-foreground">
          {formatMoney(item.unitPrice, currency)} each
        </p>
        <p className="text-sm text-muted-foreground">
          Quantity: {item.quantity}
        </p>
        {!item.isAvailable && (
          <p className="text-sm text-destructive">
            Unavailable (only {item.availableStock} in stock)
          </p>
        )}
        <p className="mt-1 font-medium text-primary">
          {formatMoney(item.lineTotal, currency)}
        </p>
      </div>

      <div className="flex w-full gap-2 sm:w-fit sm:flex-col">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => router.push(`/products/${item.productId}`)}
        >
          <Eye className="size-4" />
          View
        </Button>
        <Button variant="destructive" className="flex-1" onClick={removeItem}>
          <Trash2 className="size-4" />
          Remove
        </Button>
      </div>
    </div>
  );
}

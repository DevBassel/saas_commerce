"use client";
import { useState } from "react";
import { Button } from "../ui/button";
import { IProduct } from "@/api/productsApi";
import { AddToCart as AddToCartRequest } from "@/api/cartApi";
import { handelError } from "@/api/handelError";
import { toast } from "sonner";
import { Input } from "../ui/input";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingCart } from "lucide-react";

export default function AddToCart({ product }: { product: IProduct }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const maxQuantity = Math.max(1, product.stock);
  const soldOut = product.stock <= 0;

  const submit = async () => {
    setSubmitting(true);
    try {
      await AddToCartRequest({ productId: product.id, quantity });
      toast.success("Product added to cart");
      router.push("/cart");
    } catch (error) {
      handelError(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Quantity</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={soldOut}
            onClick={() => setQuantity((current) => Math.max(1, current - 1))}
          >
            <Minus className="size-4" />
          </Button>
          <Input
            type="number"
            min={1}
            max={maxQuantity}
            value={quantity}
            disabled={soldOut}
            onChange={(e) =>
              setQuantity(
                Math.min(maxQuantity, Math.max(1, Number(e.target.value) || 1)),
              )
            }
            className="w-16 text-center font-semibold [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <Button
            variant="outline"
            size="icon"
            disabled={soldOut}
            onClick={() =>
              setQuantity((current) => Math.min(maxQuantity, current + 1))
            }
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <span className="text-sm text-muted-foreground">Total</span>
        <span className="text-2xl font-bold text-primary">
          ${(quantity * product.price).toFixed(2)}
        </span>
      </div>

      <Button
        size="lg"
        className="w-full"
        onClick={submit}
        disabled={submitting || soldOut}
      >
        <ShoppingCart className="size-4" />
        {soldOut ? "Sold out" : "Add to cart"}
      </Button>
    </div>
  );
}

"use client";
import { SyntheticEvent, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  createAddress,
  getAddresses,
  type IAddress,
  type ICreateAddress,
} from "@/api/addressesApi";
import { PlaceOrderReq, type IOrder } from "@/api/orderApi";
import { handelError } from "@/api/handelError";
import StripePaymentStep from "@/components/payments/StripePaymentStep";

const optionalField = (formData: FormData, name: string) => {
  const value = String(formData.get(name) ?? "").trim();
  return value.length > 0 ? value : undefined;
};

export default function PlaceOrder() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"address" | "payment">("address");
  const [order, setOrder] = useState<IOrder | null>(null);
  const [addresses, setAddresses] = useState<IAddress[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadAddresses = async (preferId?: number) => {
    setLoading(true);
    try {
      const list = await getAddresses();
      setAddresses(list);
      setSelectedId(
        preferId ??
          list.find((address) => address.isDefault)?.id ??
          list[0]?.id ??
          null,
      );
      setShowCreate(list.length === 0);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    setStep("address");
    setOrder(null);
    if (next) void loadAddresses();
  };

  const handleCreateAddress = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const dto: ICreateAddress = {
      recipientName: String(formData.get("recipientName") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim(),
      line1: String(formData.get("line1") ?? "").trim(),
      line2: optionalField(formData, "line2"),
      city: String(formData.get("city") ?? "").trim(),
      state: optionalField(formData, "state"),
      postalCode: String(formData.get("postalCode") ?? "").trim(),
      country: String(formData.get("country") ?? "")
        .trim()
        .toUpperCase(),
      label: optionalField(formData, "label"),
    };

    setSubmitting(true);
    try {
      const created = await createAddress(dto);
      toast.success("Address added");
      form.reset();
      setShowCreate(false);
      await loadAddresses(created.id);
    } catch (error) {
    } finally {
      setSubmitting(false);
    }
  };

  const handlePlaceOrder = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (selectedId == null) {
      toast.error("Select a delivery address first.");
      return;
    }

    setSubmitting(true);
    try {
      const placed = await PlaceOrderReq({ addressId: selectedId });
      setOrder(placed);
      setStep("payment");
    } catch (error) {
      handelError(error);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePaid = () => {
    toast.success("Payment received");
    setOpen(false);
    setStep("address");
    setOrder(null);
    router.push("/orders");
    router.refresh();
  };

  const addressItems = addresses.map((address) => ({
    value: String(address.id),
    label: `${address.recipientName} — ${address.line1}, ${address.city}${
      address.isDefault ? " (default)" : ""
    }`,
  }));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className="w-full bg-primary rounded-2xl p-2 cursor-pointer">
        Confirm Order
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "payment" ? "Payment" : "Confirm Order"}
          </DialogTitle>
        </DialogHeader>

        {step === "payment" && order ? (
          <StripePaymentStep
            orderId={order.id}
            orderNumber={order.orderNumber}
            amount={order.total}
            onSuccess={handlePaid}
          />
        ) : (
          <>
            <form onSubmit={handlePlaceOrder} className="flex flex-col gap-4">
              {loading ? (
                <p className="text-sm text-muted-foreground">
                  Loading addresses…
                </p>
              ) : addresses.length > 0 ? (
                <div className="space-y-2">
                  <Label htmlFor="addressId">Delivery Address *</Label>
                  <Select
                    id="addressId"
                    items={addressItems}
                    value={selectedId == null ? null : String(selectedId)}
                    onValueChange={(value) =>
                      setSelectedId(value == null ? null : Number(value))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a delivery address" />
                    </SelectTrigger>
                    <SelectContent>
                      {addressItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Add a delivery address to place your order.
                </p>
              )}

              <DialogFooter className="sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCreate((current) => !current)}
                >
                  {showCreate ? "Cancel new address" : "Add new address"}
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  type="submit"
                  disabled={submitting || selectedId == null}
                >
                  Place Order
                </Button>
              </DialogFooter>
            </form>

            {showCreate && (
              <form
                onSubmit={handleCreateAddress}
                className="flex flex-col gap-3 border-t-2 pt-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="recipientName">Recipient name *</Label>
                  <Input id="recipientName" name="recipientName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone *</Label>
                  <Input id="phone" name="phone" type="tel" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="line1">Address line 1 *</Label>
                  <Input id="line1" name="line1" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="line2">Address line 2</Label>
                  <Input id="line2" name="line2" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="city">City *</Label>
                    <Input id="city" name="city" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input id="state" name="state" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal code *</Label>
                    <Input id="postalCode" name="postalCode" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country *</Label>
                    <Input
                      id="country"
                      name="country"
                      placeholder="US"
                      minLength={2}
                      maxLength={2}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="label">Label</Label>
                  <Input id="label" name="label" placeholder="Home" />
                </div>
                <Button type="submit" disabled={submitting}>
                  Save address
                </Button>
              </form>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

import type { Metadata } from "next";
import { RegisterStoreForm } from "./register-store-form";

export const metadata: Metadata = {
  title: "Start a store",
  description:
    "Create your storefront and owner account in one step, then open your store on its own subdomain.",
  alternates: { canonical: "/register-store" },
};

export default function RegisterStorePage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3 text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          Start your store
        </h1>
        <p className="mx-auto max-w-2xl text-muted-foreground">
          Set up an isolated storefront on your own subdomain. You can add
          products and customize it right after.
        </p>
      </header>
      <RegisterStoreForm />
    </div>
  );
}

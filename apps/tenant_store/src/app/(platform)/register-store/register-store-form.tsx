"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Store } from "lucide-react";
import {
  registerStoreRequest,
  type IRegisterStore,
} from "@/api/storeRegistrationApi";
import { handleError } from "@/api/toastError";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { allowSubdomain, getAppRootDomain } from "@/lib/tenant/host";
import { cn } from "@/lib/utils";

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function storeOrigin(slug: string, subdomain: string): string {
  const root = getAppRootDomain();
  const port = window.location.port ? `:${window.location.port}` : "";
  if (!allowSubdomain()) {
    // Param mode: the storefront is served from the platform apex and the
    // tenant is selected by the store slug (`?tenant=`), not a subdomain.
    return `${window.location.protocol}//${root}${port}/?tenant=${encodeURIComponent(slug)}`;
  }
  const host = `${subdomain || slug}.${root}`;
  return `${window.location.protocol}//${host}${port}`;
}

export function RegisterStoreForm() {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [storeUrl, setStoreUrl] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const storeSlug = String(formData.get("storeSlug") ?? "")
      .trim()
      .toLowerCase();
    const subdomain = String(formData.get("subdomain") ?? "")
      .trim()
      .toLowerCase()
      .replace(/\.+$/, "");

    if (!SLUG_REGEX.test(storeSlug) || storeSlug.length < 2) {
      setError(
        "Store address must be lowercase letters, numbers and hyphens (2-50 characters).",
      );
      return;
    }
    if (subdomain && (!SLUG_REGEX.test(subdomain) || subdomain.length < 2)) {
      setError(
        "Subdomain must be lowercase letters, numbers and hyphens (2-50 characters).",
      );
      return;
    }

    const data: IRegisterStore = {
      storeName: String(formData.get("storeName") ?? "").trim(),
      storeSlug,
      subdomain: subdomain || undefined,
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
    };

    setSubmitting(true);
    try {
      await registerStoreRequest(data);
      setStoreUrl(storeOrigin(storeSlug, subdomain));
    } catch (err) {
      handleError(err);
      setError(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (storeUrl) {
    return (
      <Card className="mx-auto w-full max-w-md text-center">
        <CardHeader className="items-center gap-2 text-center">
          <span className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <CheckCircle2 className="size-6" />
          </span>
          <CardTitle className="text-xl">Your store is ready</CardTitle>
          <CardDescription>
            Your storefront is live. Open it to sign in and start adding
            products.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <a
            href={storeUrl}
            className={cn(buttonVariants({ size: "lg" }), "w-full")}
          >
            Open {storeUrl}
          </a>
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Back to home
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="items-center gap-2 text-center">
        <span className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Store className="size-6" />
        </span>
        <CardTitle className="text-xl">Start your store</CardTitle>
        <CardDescription>
          Create your storefront and owner account in one step.
        </CardDescription>
      </CardHeader>

      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4 pb-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="storeName">Store name</Label>
            <Input
              id="storeName"
              name="storeName"
              type="text"
              placeholder="Nike Store"
              required
              minLength={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="storeSlug">Store address</Label>
            <Input
              id="storeSlug"
              name="storeSlug"
              type="text"
              placeholder="nike-store"
              required
              minLength={2}
              maxLength={50}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              title="Lowercase letters, numbers and hyphens only."
            />
            <p className="text-sm text-muted-foreground">
              Used for your store URL. Lowercase letters, numbers and hyphens.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subdomain">Subdomain (optional)</Label>
            <Input
              id="subdomain"
              name="subdomain"
              type="text"
              placeholder="Defaults to the store address"
              maxLength={50}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              title="Lowercase letters, numbers and hyphens only."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Your name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="John Doe"
              required
              minLength={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="owner@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={16}
            />
            <p className="text-sm text-muted-foreground">
              Must be 8-16 characters.
            </p>
          </div>
        </CardContent>

        <CardContent className="pt-0">
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={submitting}
          >
            {submitting ? "Creating your store…" : "Create store"}
          </Button>
        </CardContent>
      </form>
    </Card>
  );
}

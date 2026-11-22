"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe2,
  LockKeyhole,
  Mail,
  Store,
  UserRound,
} from "lucide-react";
import {
  registerStoreRequest,
  type IRegisterStore,
} from "@/api/storeRegistrationApi";
import { handleError } from "@/api/toastError";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { allowSubdomain, getAppRootDomain } from "@/lib/tenant/host";
import { cn } from "@/lib/utils";

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const inputClassName =
  "h-11 border border-white/8 bg-[#080A0A] pl-10 text-white placeholder:text-zinc-600 focus-visible:border-[#00C58A]/70 focus-visible:ring-[#00C58A]/20";

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
  const [showPassword, setShowPassword] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const subdomain = String(formData.get("subdomain") ?? "")
      .trim()
      .toLowerCase()
      .replace(/\.+$/, "");
    const storeSlug = subdomain;

    if (!SLUG_REGEX.test(subdomain) || subdomain.length < 2) {
      setError(
        "Subdomain must be lowercase letters, numbers and hyphens (2-50 characters).",
      );
      return;
    }

    const data: IRegisterStore = {
      storeName: String(formData.get("storeName") ?? "").trim(),
      storeSlug,
      subdomain,
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
      <div className="relative flex min-h-[40rem] flex-col items-center justify-center overflow-hidden rounded-3xl border border-[#00C58A]/25 bg-[#0D1110] p-7 text-center shadow-[0_30px_90px_-45px_rgba(0,197,138,0.6)] sm:p-10">
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#00C58A] to-transparent" />
        <div className="pointer-events-none absolute left-1/2 top-16 size-48 -translate-x-1/2 rounded-full bg-[#00C58A]/10 blur-3xl" />

        <div className="relative flex size-16 items-center justify-center rounded-3xl border border-[#00C58A]/30 bg-[#00C58A]/12 text-[#00C58A]">
          <CheckCircle2 className="size-8" />
        </div>
        <span className="relative mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-[#00C58A]">
          Provisioning complete
        </span>
        <h2 className="relative mt-2 text-3xl font-bold tracking-tight text-white">
          Your store is live
        </h2>
        <p className="relative mt-3 max-w-sm text-sm leading-6 text-zinc-400">
          Your storefront and owner account are ready. Open the store to sign in
          and start building your catalog.
        </p>

        <div className="relative mt-7 w-full max-w-md rounded-2xl border border-white/8 bg-[#080A0A] p-4 text-left">
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-zinc-600">
            Store URL
          </p>
          <p className="mt-1 truncate font-mono text-sm text-zinc-300">
            {storeUrl}
          </p>
        </div>

        <ul className="relative my-7 grid w-full max-w-md gap-3 text-left text-sm text-zinc-400 sm:grid-cols-3">
          {[
            "Store created",
            "Owner added",
            "Ready to sign in",
          ].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <Check className="size-4 shrink-0 text-[#00C58A]" />
              {item}
            </li>
          ))}
        </ul>

        <div className="relative flex w-full max-w-md flex-col gap-3">
          <a
            href={storeUrl}
            className={cn(
              buttonVariants({ size: "lg" }),
              "w-full bg-[#00C58A] text-[#04110D] hover:bg-[#16D49C]",
            )}
          >
            Open your storefront
            <ArrowRight />
          </a>
          <Link
            href="/"
            className="py-2 text-sm font-medium text-zinc-500 transition-colors hover:text-white"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0D1110] p-5 shadow-[0_30px_90px_-50px_rgba(0,197,138,0.5)] sm:p-8">
      <div className="pointer-events-none absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-[#00C58A]/80 to-transparent" />
      <div className="mb-8 flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-[#00C58A]/25 bg-[#00C58A]/10 text-[#00C58A]">
          <Store className="size-5" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#00C58A]">
            Store setup
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            Create your storefront
          </h2>
          <p className="mt-1 text-sm leading-6 text-zinc-500">
            Add the essentials now. You can customize everything else later.
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit}>
        <div className="space-y-8">
          {error && (
            <Alert
              variant="destructive"
              className="border-destructive/30 bg-destructive/8"
            >
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <fieldset className="space-y-5">
            <legend className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Store details
            </legend>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="storeName" className="text-zinc-300">
                  Store name
                </Label>
                <div className="relative">
                  <Store className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
                  <Input
                    id="storeName"
                    name="storeName"
                    type="text"
                    placeholder="Nike Store"
                    autoComplete="organization"
                    className={inputClassName}
                    required
                    minLength={2}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subdomain" className="text-zinc-300">
                  Subdomain
                </Label>
                <div className="relative">
                  <Globe2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
                  <Input
                    id="subdomain"
                    name="subdomain"
                    type="text"
                    placeholder="nike-store"
                    className={inputClassName}
                    aria-describedby="subdomain-hint"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    minLength={2}
                    maxLength={50}
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    title="Lowercase letters, numbers and hyphens only."
                  />
                </div>
                <p id="subdomain-hint" className="text-xs leading-5 text-zinc-600">
                  Lowercase letters, numbers, and hyphens.
                </p>
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-5 border-t border-white/8 pt-7">
            <legend className="px-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Owner account
            </legend>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-zinc-300">
                  Your name
                </Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="John Doe"
                    autoComplete="name"
                    className={inputClassName}
                    required
                    minLength={2}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-zinc-300">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="owner@example.com"
                    autoComplete="email"
                    className={inputClassName}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-zinc-300">
                Password
              </Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a secure password"
                  autoComplete="new-password"
                  className={`${inputClassName} pr-10`}
                  aria-describedby="password-hint"
                  required
                  minLength={8}
                  maxLength={16}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C58A]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden="true" />
                  ) : (
                    <Eye className="size-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              <p id="password-hint" className="text-xs leading-5 text-zinc-600">
                Use 8-16 characters.
              </p>
            </div>
          </fieldset>

          <Button
            type="submit"
            className="h-11 w-full bg-[#00C58A] text-[#04110D] hover:bg-[#16D49C]"
            size="lg"
            disabled={submitting}
          >
            {submitting ? "Creating your store…" : "Create store"}
            {!submitting && <ArrowRight />}
          </Button>
          <p className="text-center text-xs leading-5 text-zinc-600">
            One submission creates both your isolated storefront and owner
            account.
          </p>
        </div>
      </form>
    </div>
  );
}

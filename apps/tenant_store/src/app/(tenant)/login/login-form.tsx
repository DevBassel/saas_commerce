"use client";

import { useState, type SyntheticEvent } from "react";
import { getSession, signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import {
  TenantLink as Link,
  useTenantParam,
  useTenantRouter,
} from "@/lib/tenant/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Store } from "lucide-react";

/**
 * Keep post-login navigation on the current store subdomain origin.
 *
 * Absolute URLs (e.g. a bare apex `http://localhost:3000/`) are reduced to
 * their path + query so the browser never leaves the subdomain, and any
 * non-relative result falls back to `/`.
 */
function sanitizeCallbackUrl(callbackUrl: string): string {
  if (typeof window === "undefined") return "/";
  try {
    const target = new URL(callbackUrl, window.location.origin);
    const path = `${target.pathname}${target.search}`;
    return path.startsWith("/") ? path : "/";
  } catch {
    return "/";
  }
}

export default function LoginForm() {
  const router = useTenantRouter();
  const tenantParam = useTenantParam();
  const searchParams = useSearchParams();
  const callbackUrl = sanitizeCallbackUrl(
    searchParams.get("callbackUrl") || "/",
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    const verifyUrl = "/verify-email";

    try {
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
        callbackUrl,
        // Carries the tenant into NextAuth's `authorize`, which runs under
        // `/api/auth/*` (outside the proxy) where no `x-tenant-slug` header
        // exists; empty in subdomain mode, where the host resolves it instead.
        tenant: tenantParam ?? "",
      });

      if (result?.error) {
        // The backend can still reject an unverified login outright
        // (OTP_REQUIRE_EMAIL_VERIFIED); send the user straight to verification.
        if (result.error.includes("EMAIL_NOT_VERIFIED")) {
          router.push(verifyUrl);
          return;
        }
        setError(result.error || "Invalid email or password.");
        return;
      }

      // Otherwise login succeeded and its response carries `verified`. An
      // unverified account must confirm its email before using the storefront.
      const session = await getSession();
      if (session?.user?.verified === false) {
        router.push(verifyUrl);
        return;
      }

      router.push(callbackUrl);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    }
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="items-center gap-2 text-center">
        <span className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Store className="size-6" />
        </span>
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>
          Sign in to browse the catalog and track your orders.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 pb-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </CardContent>

        <CardFooter className="flex-col gap-3 pt-4">
          <Button type="submit" className="w-full" size="lg">
            Sign in
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => router.push("/register")}
            >
              Create one
            </button>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

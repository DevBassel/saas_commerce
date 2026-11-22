"use client";

import { useState, type SyntheticEvent } from "react";
import { getSession, signIn, signOut } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import {
  TenantLink as Link,
  useTenantParam,
  useTenantRouter,
} from "@/lib/tenant/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TenantAuthShell } from "@/components/auth/TenantAuthShell";
import {
  clearVerificationContext,
  writeVerificationContext,
} from "@/lib/auth/verification-context";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  LogIn,
  Mail,
} from "lucide-react";

const inputClassName =
  "h-11 border-border/80 bg-background pl-10 focus-visible:border-primary focus-visible:ring-primary/20";

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
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    const verifyUrl = "/verify-email";

    setSubmitting(true);
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
          await signOut({ redirect: false });
          writeVerificationContext(email, 0);
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
        writeVerificationContext(email, 0);
        router.push(verifyUrl);
        return;
      }

      clearVerificationContext();
      router.push(callbackUrl);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TenantAuthShell variant="login">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm shadow-primary/20">
            <LogIn className="size-5" aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight">Sign in</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Enter your account details to continue to the store.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive" className="border-destructive/30">
              <AlertDescription id="login-error">{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                className={inputClassName}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "login-error" : undefined}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
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
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete="current-password"
                className={`${inputClassName} pr-10`}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "login-error" : undefined}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          </div>

          <Button
            type="submit"
            className="h-11 w-full shadow-sm shadow-primary/20"
            size="lg"
            disabled={submitting}
          >
            {submitting ? "Signing in…" : "Sign in"}
            {!submitting && <ArrowRight aria-hidden="true" />}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-medium text-primary hover:underline"
            >
              Create one
            </Link>
          </p>
        </form>
      </div>
    </TenantAuthShell>
  );
}

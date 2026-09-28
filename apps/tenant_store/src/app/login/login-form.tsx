"use client";

import { useState, type SyntheticEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const router = useRouter();
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

    try {
      const tenantSlug = "";
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
        tenantSlug,
        callbackUrl,
      });

      if (result?.error) {
        setError(result.error || "Invalid email or password.");
      } else {
        router.push(callbackUrl);
      }
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
            <Label htmlFor="password">Password</Label>
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

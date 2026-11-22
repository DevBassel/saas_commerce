"use client";

import { useState } from "react";
import { IRegister, registerRequest } from "@/api/authApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TenantAuthShell } from "@/components/auth/TenantAuthShell";
import { TenantLink as Link, useTenantRouter } from "@/lib/tenant/nav";
import { writeVerificationContext } from "@/lib/auth/verification-context";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  UserPlus,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { handleError } from "@/api/toastError";

const inputClassName =
  "h-11 border-border/80 bg-background pl-10 focus-visible:border-primary focus-visible:ring-primary/20";

export default function Register() {
  const router = useTenantRouter();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: IRegister = {
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
    };
    setSubmitting(true);
    try {
      const response = await registerRequest(data);
      writeVerificationContext(data.email, response.resendCooldownSeconds);
      toast.success("Account created. Check your email for a verification code.");
      router.push("/verify-email");
    } catch (error) {
      handleError(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="py-4 sm:py-8">
      <TenantAuthShell variant="register">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm shadow-primary/20">
              <UserPlus className="size-5" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-3xl font-bold tracking-tight">
              Create your account
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Join this storefront and keep checkout and orders in one place.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
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
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="john@example.com"
                  autoComplete="email"
                  className={inputClassName}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a secure password"
                  autoComplete="new-password"
                  className={`${inputClassName} pr-10`}
                  aria-describedby="registration-password-hint"
                  required
                  minLength={8}
                  maxLength={16}
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
              <p
                id="registration-password-hint"
                className="text-xs leading-5 text-muted-foreground"
              >
                Must be 8-16 characters with 1 uppercase and 1 number.
              </p>
            </div>

            <Button
              type="submit"
              className="h-11 w-full shadow-sm shadow-primary/20"
              size="lg"
              disabled={submitting}
            >
              {submitting ? "Creating account…" : "Create account"}
              {!submitting && <ArrowRight aria-hidden="true" />}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-primary hover:underline"
              >
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </TenantAuthShell>
    </div>
  );
}

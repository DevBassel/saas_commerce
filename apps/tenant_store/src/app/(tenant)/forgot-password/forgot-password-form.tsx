"use client";

import { useState, type SyntheticEvent } from "react";
import { TenantLink as Link, useTenantRouter } from "@/lib/tenant/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TenantAuthShell } from "@/components/auth/TenantAuthShell";
import { ArrowLeft, ArrowRight, KeyRound, Mail } from "lucide-react";
import { toast } from "sonner";
import { handleError } from "@/api/toastError";
import { requestOtp } from "@/api/otpApi";

const inputClassName =
  "h-11 border-border/80 bg-background pl-10 focus-visible:border-primary focus-visible:ring-primary/20";

export default function ForgotPasswordForm() {
  const router = useTenantRouter();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSubmitting(true);
    try {
      await requestOtp(email.trim(), "PASSWORD_RESET");
      toast.success("If that email exists, a reset code is on its way.");
      router.push(`/reset-password?email=${encodeURIComponent(email.trim())}`);
    } catch (err) {
      handleError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TenantAuthShell variant="forgot">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm shadow-primary/20">
            <KeyRound className="size-5" aria-hidden="true" />
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight">
            Reset your password
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Enter your account email and we will send a verification code if it
            matches an account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
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
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <Button
            type="submit"
            className="h-11 w-full shadow-sm shadow-primary/20"
            size="lg"
            disabled={submitting}
          >
            {submitting ? "Sending…" : "Send reset code"}
            {!submitting && <ArrowRight aria-hidden="true" />}
          </Button>
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to sign in
          </Link>
        </form>
      </div>
    </TenantAuthShell>
  );
}

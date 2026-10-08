"use client";

import { useState, type SyntheticEvent } from "react";
import { TenantLink as Link, useTenantRouter } from "@/lib/tenant/nav";
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
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { handleError } from "@/api/toastError";
import { requestOtp } from "@/api/otpApi";

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
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="items-center gap-2 text-center">
        <span className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <KeyRound className="size-6" />
        </span>
        <CardTitle className="text-xl">Reset your password</CardTitle>
        <CardDescription>
          We will email you a code to choose a new password.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 pb-4">
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
        </CardContent>

        <CardFooter className="flex-col gap-3 pt-4">
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={submitting}
          >
            {submitting ? "Sending…" : "Send reset code"}
          </Button>
          <Link
            href="/login"
            className="text-sm font-medium text-primary hover:underline"
          >
            Back to sign in
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}

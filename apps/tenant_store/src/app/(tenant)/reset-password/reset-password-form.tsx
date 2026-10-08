"use client";

import { useState, type SyntheticEvent } from "react";
import { useSearchParams } from "next/navigation";
import { TenantLink as Link, useTenantRouter } from "@/lib/tenant/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { handleError } from "@/api/toastError";
import { confirmPasswordReset } from "@/api/otpApi";

const OTP_LENGTH = 6;

export default function ResetPasswordForm() {
  const router = useTenantRouter();
  const searchParams = useSearchParams();
  const email = (searchParams.get("email") || "").trim();

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError("Missing email. Request a new reset code.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await confirmPasswordReset(email, code.trim(), password);
      toast.success("Password changed. Sign in with your new password.");
      router.push("/login");
    } catch (err) {
      setError("That code is invalid or has expired. Request a new one.");
      handleError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="items-center gap-2 text-center">
        <span className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <ShieldCheck className="size-6" />
        </span>
        <CardTitle className="text-xl">Choose a new password</CardTitle>
        <CardDescription>
          {email
            ? `Enter the code sent to ${email}.`
            : "Enter your reset code and a new password."}
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
            <Label htmlFor="code">Reset code</Label>
            <InputOTP
              id="code"
              maxLength={OTP_LENGTH}
              value={code}
              onChange={setCode}
              pattern="[0-9]*"
              inputMode="numeric"
              autoComplete="one-time-code"
              containerClassName="justify-center"
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={16}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={16}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Must be 8-16 characters.
            </p>
          </div>
        </CardContent>

        <CardFooter className="flex-col gap-3 pt-4">
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={submitting}
          >
            {submitting ? "Saving…" : "Set new password"}
          </Button>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-primary hover:underline"
          >
            Request a new code
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}

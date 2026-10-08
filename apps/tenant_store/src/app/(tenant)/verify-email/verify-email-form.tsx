"use client";

import { useState, type SyntheticEvent } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
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
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import { handleError } from "@/api/toastError";
import { requestOtp, verifyEmailOtp } from "@/api/otpApi";
import { useTenantRouter } from "@/lib/tenant/nav";

const OTP_LENGTH = 6;

export default function VerifyEmailForm() {
  const router = useTenantRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  // Prefer the signed-in account's address; the query param remains a fallback
  // for the register flow, which reaches this page before a session exists.
  const queryEmail = (searchParams.get("email") || "").trim();
  const email = (session?.user?.email || queryEmail).trim();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault();
    setError(null);

    if (!code.trim()) {
      setError("Enter the code from your email.");
      return;
    }

    setSubmitting(true);
    try {
      await verifyEmailOtp(email, code.trim());
      toast.success("Email verified. You can sign in now.");
      router.push("/login");
    } catch (err) {
      setError("That code is invalid or has expired. Request a new one.");
      handleError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError(null);
    setResending(true);
    try {
      await requestOtp(email, "EMAIL_VERIFICATION");
      toast.success("A new code is on its way.");
    } catch (err) {
      handleError(err);
    } finally {
      setResending(false);
    }
  };

  if (!email && status === "loading" && !queryEmail) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="items-center gap-2 text-center">
          <span className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <MailCheck className="size-6" />
          </span>
          <CardTitle className="text-xl">Verify your email</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!email) {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="items-center gap-2 text-center">
          <span className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <MailCheck className="size-6" />
          </span>
          <CardTitle className="text-xl">Verify your email</CardTitle>
          <CardDescription>
            We could not tell which email to verify.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center pt-4">
          <Button onClick={() => router.push("/register")} size="lg">
            Back to sign up
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader className="items-center gap-2 text-center">
        <span className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <MailCheck className="size-6" />
        </span>
        <CardTitle className="text-xl">Verify your email</CardTitle>
        <CardDescription>
          Enter the 6-digit code we sent to {email}.
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
            <Label htmlFor="code">Verification code</Label>
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
        </CardContent>

        <CardFooter className="flex-col gap-3 pt-4">
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={submitting}
          >
            {submitting ? "Verifying…" : "Verify email"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={handleResend}
            disabled={resending}
          >
            {resending ? "Sending…" : "Resend code"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

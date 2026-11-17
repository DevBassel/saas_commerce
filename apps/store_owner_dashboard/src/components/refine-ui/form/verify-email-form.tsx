"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { useNotification } from "@refinedev/core";
import { MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AuthShell } from "@/components/refine-ui/form/auth-shell";
import { OtpField } from "@/components/refine-ui/form/otp-field";
import { toApiError } from "@/api/client";
import { requestOtp, verifyEmailOtp } from "@/api/otp.api";
import {
  clearVerificationContext,
  readVerificationContext,
  writeVerificationContext,
} from "@/lib/verification-context";

const getRemainingSeconds = (resendAvailableAt: number): number =>
  Math.max(0, Math.ceil((resendAvailableAt - Date.now()) / 1000));

const formatCountdown = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
};

export const VerifyEmailForm = () => {
  const navigate = useNavigate();
  const { open } = useNotification();
  const [verificationContext, setVerificationContext] = useState(
    readVerificationContext,
  );
  const resendAvailableAt = verificationContext?.resendAvailableAt ?? 0;
  const email = verificationContext?.email ?? "";

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    getRemainingSeconds(resendAvailableAt),
  );

  useEffect(() => {
    if (getRemainingSeconds(resendAvailableAt) === 0) return;

    const timer = window.setInterval(() => {
      const remaining = getRemainingSeconds(resendAvailableAt);
      setRemainingSeconds(remaining);
      if (remaining === 0) window.clearInterval(timer);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendAvailableAt]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email) return;

    setSubmitting(true);
    try {
      await verifyEmailOtp(email, code.trim());
      clearVerificationContext();
      open?.({
        type: "success",
        message: "Email verified",
        description: "You can sign in now.",
      });
      navigate("/login");
    } catch (error) {
      open?.({
        type: "error",
        message: "Verification failed",
        description: toApiError(error).message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!email || resending || remainingSeconds > 0) return;

    setResending(true);
    try {
      const response = await requestOtp(email, "EMAIL_VERIFICATION");
      const context = writeVerificationContext(
        email,
        response.resendCooldownSeconds,
      );
      if (context) {
        setVerificationContext(context);
        setRemainingSeconds(getRemainingSeconds(context.resendAvailableAt));
      }
      open?.({
        type: "success",
        message: "Code sent",
        description: `We emailed a new code to ${email}.`,
      });
    } catch (error) {
      open?.({
        type: "error",
        message: "Could not send code",
        description: toApiError(error).message,
      });
    } finally {
      setResending(false);
    }
  };

  if (!email) {
    return (
      <AuthShell>
        <Card className="sm:w-114">
          <CardHeader className="items-center gap-2 text-center">
            <span className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <MailCheck className="size-6" />
            </span>
            <CardTitle className="text-xl">Verify your email</CardTitle>
            <CardDescription>
              We could not tell which email to verify.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button size="lg" onClick={() => navigate("/login")}>
              Back to sign in
            </Button>
          </CardFooter>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Card className="sm:w-114">
        <CardHeader className="items-center gap-2 text-center">
          <span className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <MailCheck className="size-6" />
          </span>
          <CardTitle className="text-xl">Verify your email</CardTitle>
          <CardDescription>Enter the code we sent to {email}.</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Verification code</Label>
              <OtpField value={code} onChange={setCode} disabled={submitting} />
            </div>
          </CardContent>

          <CardFooter className="flex-col gap-3 pt-4">
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={submitting || code.trim().length === 0}
            >
              {submitting ? "Verifying..." : "Verify email"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={handleResend}
              disabled={resending || remainingSeconds > 0}
            >
              {remainingSeconds > 0
                ? `Resend code in ${formatCountdown(remainingSeconds)}`
                : "Send code"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </AuthShell>
  );
};

VerifyEmailForm.displayName = "VerifyEmailForm";

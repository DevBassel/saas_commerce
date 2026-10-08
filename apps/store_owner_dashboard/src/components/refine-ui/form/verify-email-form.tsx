"use client";

import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router";
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
import { toApiError, tokenStorage } from "@/api/client";
import { requestOtp, verifyEmailOtp } from "@/api/otp.api";

export const VerifyEmailForm = () => {
  const navigate = useNavigate();
  const { open } = useNotification();
  const [searchParams] = useSearchParams();
  const email = (
    searchParams.get("email") ??
    tokenStorage.getEmail() ??
    ""
  ).trim();

  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email) return;

    setSubmitting(true);
    try {
      await verifyEmailOtp(email, code.trim());
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
    if (!email) return;

    setResending(true);
    try {
      await requestOtp(email, "EMAIL_VERIFICATION");
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
          <CardDescription>
            Enter the code we sent to {email}.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Verification code</Label>
              <OtpField
                value={code}
                onChange={setCode}
                disabled={submitting}
              />
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
              disabled={resending}
            >
              {resending ? "Sending..." : "Resend code"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </AuthShell>
  );
};

VerifyEmailForm.displayName = "VerifyEmailForm";

import type { Metadata } from "next";
import { Suspense } from "react";
import VerifyEmailForm from "./verify-email-form";

export const metadata: Metadata = {
  title: "Verify your email",
  description: "Enter the verification code we emailed you.",
};

export default function VerifyEmailPage() {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <h1 className="sr-only">Verify your email</h1>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
            Loading…
          </div>
        }
      >
        <VerifyEmailForm />
      </Suspense>
    </div>
  );
}

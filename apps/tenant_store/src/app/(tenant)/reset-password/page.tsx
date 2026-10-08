import type { Metadata } from "next";
import { Suspense } from "react";
import ResetPasswordForm from "./reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
  description: "Enter your reset code and choose a new password.",
};

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <h1 className="sr-only">Choose a new password</h1>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
            Loading…
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}

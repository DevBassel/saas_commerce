import type { Metadata } from "next";
import ForgotPasswordForm from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Request a password reset code by email.",
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <h1 className="sr-only">Reset your password</h1>
      <ForgotPasswordForm />
    </div>
  );
}

import type { Metadata } from "next";
import ForgotPasswordForm from "./forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your password",
  description: "Request a password reset code by email.",
};

export default function ForgotPasswordPage() {
  return (
    <div className="py-4 sm:py-8">
      <ForgotPasswordForm />
    </div>
  );
}

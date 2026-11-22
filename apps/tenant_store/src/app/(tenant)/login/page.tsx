import type { Metadata } from "next";
import { Suspense } from "react";
import { TenantAuthShell } from "@/components/auth/TenantAuthShell";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to shop and manage your orders.",
};

export default function LoginPage() {
  return (
    <div className="py-4 sm:py-8">
      <Suspense
        fallback={
          <TenantAuthShell variant="login">
            <div
              aria-label="Loading sign in form"
              aria-busy="true"
              className="w-full max-w-md animate-pulse space-y-6"
            >
              <div className="size-12 rounded-2xl bg-muted" />
              <div className="h-8 w-2/5 rounded bg-muted" />
              <div className="h-4 w-4/5 rounded bg-muted/70" />
              <div className="space-y-3 pt-3">
                <div className="h-11 rounded-2xl bg-muted" />
                <div className="h-11 rounded-2xl bg-muted" />
                <div className="h-11 rounded-2xl bg-primary/20" />
              </div>
            </div>
          </TenantAuthShell>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}

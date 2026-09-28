import type { Metadata } from "next";
import { Suspense } from "react";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "Sign In - Store Dashboard",
  description:
    "Securely sign in to access the product management, store catalog, and checkout controls.",
};

export default function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <h1 className="sr-only">Sign in to Store Dashboard</h1>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
            Loading…
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}

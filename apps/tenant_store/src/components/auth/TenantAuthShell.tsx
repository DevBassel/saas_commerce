import type { ReactNode } from "react";
import { PackageCheck, RotateCcw, ShieldCheck, Sparkles } from "lucide-react";

interface TenantAuthShellProps {
  variant: "forgot" | "login" | "register";
  children: ReactNode;
}

const highlights = [
  {
    icon: ShieldCheck,
    title: "Secure access",
    description: "Your account stays connected to this storefront.",
  },
  {
    icon: PackageCheck,
    title: "Order visibility",
    description: "Follow purchases from checkout through delivery.",
  },
  {
    icon: RotateCcw,
    title: "Simple order care",
    description: "Manage cancellations and eligible returns in one place.",
  },
] as const;

const copy = {
  forgot: {
    title: "Get back to your account.",
    description:
      "Request a secure reset code, choose a new password, and return to your storefront account.",
  },
  login: {
    title: "Pick up where you left off.",
    description:
      "Sign in to continue shopping, revisit your cart, and keep every order within reach.",
  },
  register: {
    title: "Your account, built for better shopping.",
    description:
      "Create one secure account for checkout, order updates, and everything that comes next.",
  },
} as const;

export function TenantAuthShell({ variant, children }: TenantAuthShellProps) {
  const content = copy[variant];

  return (
    <section className="relative isolate overflow-hidden rounded-3xl border border-border/80 bg-card shadow-sm dark:shadow-none">
      <div className="pointer-events-none absolute -left-32 top-20 size-72 rounded-full bg-primary/12 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 -top-32 size-72 rounded-full bg-primary/8 blur-3xl" />

      <div className="relative grid min-h-[42rem] lg:grid-cols-[minmax(0,1.05fr)_minmax(28rem,0.95fr)]">
        <aside className="relative flex flex-col justify-center overflow-hidden border-b border-border/70 p-6 sm:p-10 lg:border-b-0 lg:border-r lg:p-14">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,color-mix(in_oklch,var(--foreground)_8%,transparent)_1px,transparent_0)] bg-[size:24px_24px] opacity-40" />

          <div className="relative">
            <h1 className="mt-6 max-w-xl text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              {content.title}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
              {content.description}
            </p>
          </div>

          <div className="relative mt-10 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {highlights.map((item) => (
              <div
                key={item.title}
                className="flex gap-3 rounded-2xl border border-border/70 bg-background/45 p-4 backdrop-blur-sm"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <item.icon className="size-4.5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    {item.title}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <div className="relative flex items-center justify-center bg-background/70 p-5 sm:p-10 lg:p-12">
          {children}
        </div>
      </div>
    </section>
  );
}

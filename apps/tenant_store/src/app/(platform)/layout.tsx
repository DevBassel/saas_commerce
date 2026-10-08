import type { Metadata } from "next";
import Link from "next/link";
import { Toaster } from "sonner";
import { getAppRootDomain } from "@/lib/tenant/host";
import { fontVariables } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import "../globals.css";
import { Store } from "lucide-react";

const rootDomain = getAppRootDomain();
const platformOrigin = new URL(
  `${rootDomain === "localhost" ? "http" : "https"}://${rootDomain}`,
);

export const metadata: Metadata = {
  metadataBase: platformOrigin,
  title: {
    default: "SaaS Commerce — Launch your online store",
    template: "%s | SaaS Commerce",
  },
  description:
    "A multi-tenant commerce platform: launch an isolated online store on your own subdomain in minutes.",
};

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Plans", href: "/plans" },
  { label: "Start a store", href: "/register-store" },
];

/**
 * Platform shell for the root apex. It must stay free of `headers()` so
 * platform routes can be statically rendered; it never resolves a tenant.
 */
export default function PlatformLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontVariables, "font-sans", "dark")}
    >
      <body
        className="min-h-dvh bg-background text-foreground"
        suppressHydrationWarning
      >
        <div className="flex min-h-dvh flex-col">
          <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur supports-backdrop-filter:bg-background/60">
            <div className="container mx-auto flex h-16 items-center gap-4 px-4">
              <Link href="/" className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Store className="size-5" />
                </span>
                <span className="text-lg font-bold tracking-tight">
                  SaaS Commerce
                </span>
              </Link>
              <nav className="ml-auto flex items-center gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </header>
          <main className="container mx-auto w-full flex-1 px-4 py-10">
            {children}
          </main>
          <footer className="border-t border-border/60 py-6">
            <p className="container mx-auto px-4 text-center text-xs text-muted-foreground">
              © {new Date().getFullYear()} SaaS Commerce
            </p>
          </footer>
        </div>
        <Toaster theme="dark" richColors />
      </body>
    </html>
  );
}

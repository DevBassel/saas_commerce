import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Providers } from "@/components/providers";
import { CurrencyProvider } from "@/components/currency/currency-provider";
import { DEFAULT_CURRENCY } from "@/lib/money";
import { getTenantParam, loadStoreInfo } from "@/lib/tenant";
import { TenantSlugProvider } from "@/lib/tenant/nav";
import { fontVariables } from "@/lib/fonts";
import "../globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";
import { NavBar } from "@/components/NavBar";

/**
 * Tenant storefront metadata, derived from the resolved store. Shares the
 * request-scoped store-info fetch with the layout body.
 */
export async function generateMetadata(): Promise<Metadata> {
  const result = await loadStoreInfo();
  const store = result.status === "ok" ? result.store : null;

  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  const scheme =
    forwardedProto?.split(",")[0]?.trim() ||
    (process.env.NEXTAUTH_URL?.startsWith("https://") ? "https" : "http");
  const metadataBase = host ? new URL(`${scheme}://${host}`) : undefined;

  if (!store) {
    return { title: "Store", metadataBase };
  }

  return {
    title: store.name,
    description: `Shop the latest arrivals from ${store.name}.`,
    metadataBase,
    openGraph: {
      title: store.name,
      description: `Shop the latest arrivals from ${store.name}.`,
      type: "website",
    },
  };
}

export default async function TenantLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const storeResult = await loadStoreInfo();

  // A storefront host that does not resolve to a tenant is a hard 404 rather
  // than a silently mis-branded shell. Transient backend failures keep the
  // default currency so the store does not disappear during a blip.
  if (storeResult.status === "not-found") notFound();

  const store = storeResult.status === "ok" ? storeResult.store : null;

  // Trusted tenant slug for client-side navigation (see `TenantLink` /
  // `useTenantRouter`); `null` in subdomain mode so URLs stay byte-identical.
  const tenantSlug = await getTenantParam();

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
        <Providers>
          <TenantSlugProvider slug={tenantSlug}>
            <CurrencyProvider currency={store?.currency ?? DEFAULT_CURRENCY}>
              <div className="flex min-h-dvh flex-col">
                <NavBar />
                <main className="container mx-auto w-full flex-1 px-4 py-8">
                  {children}
                </main>
                <footer className="border-t border-border/60 py-6">
                  <p className="container mx-auto px-4 text-center text-xs text-muted-foreground">
                    Powered by SaaS Commerce
                  </p>
                </footer>
              </div>
            </CurrencyProvider>
          </TenantSlugProvider>
          <Toaster theme="dark" richColors />
        </Providers>
      </body>
    </html>
  );
}

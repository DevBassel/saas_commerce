import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Sans } from "next/font/google";
import { Providers } from "@/components/providers";
import { CurrencyProvider } from "@/components/currency/currency-provider";
import { DEFAULT_CURRENCY } from "@/lib/money";
import { getStoreInfo } from "@/lib/tenant";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";
import { NavBar } from "@/components/NavBar";

const notoSans = Noto_Sans({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Store Dashboard",
  description: "Sleek store management and catalog interface",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const store = await getStoreInfo();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${cn("antialiased", geistSans.variable, geistMono.variable, "font-sans", notoSans.variable)} dark`}
    >
      <body
        className="min-h-dvh bg-background text-foreground"
        suppressHydrationWarning
      >
        <Providers>
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
          <Toaster theme="dark" richColors />
        </Providers>
      </body>
    </html>
  );
}

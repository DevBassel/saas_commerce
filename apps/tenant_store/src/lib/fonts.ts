import { Geist, Geist_Mono, Noto_Sans } from "next/font/google";

/**
 * Shared font definitions for both root layouts (`(tenant)` and `(platform)`).
 * Declared once so the two `<html>` shells expose the same CSS variables.
 */
const notoSans = Noto_Sans({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Space-joined font CSS variable class names, for the `<html className>` of both
 * root layouts.
 */
export const fontVariables = [
  geistSans.variable,
  geistMono.variable,
  notoSans.variable,
].join(" ");

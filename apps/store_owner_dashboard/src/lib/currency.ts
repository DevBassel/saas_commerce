"use client";

import { useCustom } from "@refinedev/core";

import type { StoreInfo } from "@/types/currency";

export interface CurrencyOption {
  code: string;
  label: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: "usd", label: "USD — US Dollar" },
  { code: "eur", label: "EUR — Euro" },
  { code: "gbp", label: "GBP — British Pound" },
  { code: "egp", label: "EGP — Egyptian Pound" },
  { code: "sar", label: "SAR — Saudi Riyal" },
  { code: "aed", label: "AED — UAE Dirham" },
  { code: "cad", label: "CAD — Canadian Dollar" },
  { code: "aud", label: "AUD — Australian Dollar" },
];

export const currencyLabel = (code: string): string =>
  CURRENCIES.find((option) => option.code === code)?.label ??
  code.toUpperCase();

export const formatMoney = (
  amount: number | string | null | undefined,
  currency: string,
): string => {
  const numeric = Number(amount ?? 0);
  const value = Number.isFinite(numeric) ? numeric : 0;
  const code = (currency || "usd").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${code}`;
  }
};

export const useTenantCurrency = (): string => {
  const { query } = useCustom<StoreInfo>({
    url: "store/info",
    method: "get",
  });
  return query.data?.data?.currency ?? "usd";
};

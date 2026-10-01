"use client";

import { createContext, useContext, type ReactNode } from "react";

import { DEFAULT_CURRENCY } from "@/lib/money";

const CurrencyContext = createContext<string>(DEFAULT_CURRENCY);

export function CurrencyProvider({
  currency,
  children,
}: {
  currency: string;
  children: ReactNode;
}) {
  return (
    <CurrencyContext.Provider value={currency}>
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = (): string => useContext(CurrencyContext);

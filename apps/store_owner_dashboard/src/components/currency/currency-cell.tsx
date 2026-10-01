"use client";

import { formatMoney, useTenantCurrency } from "@/lib/currency";

export const CurrencyCell = ({
  value,
}: {
  value: number | string | null | undefined;
}) => {
  const currency = useTenantCurrency();
  return <>{formatMoney(value, currency)}</>;
};

CurrencyCell.displayName = "CurrencyCell";

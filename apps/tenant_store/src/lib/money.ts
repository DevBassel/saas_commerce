export const DEFAULT_CURRENCY = "usd";

export const formatMoney = (
  amount: number | string | null | undefined,
  currency?: string | null,
): string => {
  const numeric = Number(amount ?? 0);
  const value = Number.isFinite(numeric) ? numeric : 0;
  const code = (currency || DEFAULT_CURRENCY).toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${code}`;
  }
};

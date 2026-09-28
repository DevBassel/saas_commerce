"use client";

export const DateCell = ({ value }: { value?: string | null }) =>
  value ? new Date(value).toLocaleDateString() : "—";

DateCell.displayName = "DateCell";

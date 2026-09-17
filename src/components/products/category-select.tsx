"use client";

import { useList } from "@refinedev/core";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category } from "@/types/category";

const NONE_VALUE = "__none__";

export const CategorySelect = ({
  value,
  onChange,
  disabled,
}: {
  value?: number | null;
  onChange: (value: number | undefined) => void;
  disabled?: boolean;
}) => {
  const { query } = useList<Category>({
    resource: "categories",
    pagination: { mode: "off" },
    sorters: [{ field: "name", order: "asc" }],
  });

  const categories = query.data?.data ?? [];

  return (
    <Select
      value={value != null ? String(value) : NONE_VALUE}
      onValueChange={(next) =>
        onChange(next === NONE_VALUE ? undefined : Number(next))
      }
      disabled={disabled || query.isLoading}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Uncategorized" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>Uncategorized</SelectItem>
        {categories.map((category) => (
          <SelectItem key={category.id} value={String(category.id)}>
            {category.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

CategorySelect.displayName = "CategorySelect";

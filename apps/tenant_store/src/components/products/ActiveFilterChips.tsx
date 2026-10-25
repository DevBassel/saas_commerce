"use client";

import { X } from "lucide-react";

import type { IStoreCategoryOption } from "@/api/categoriesApi";
import { useCurrency } from "@/components/currency/currency-provider";
import { useFilterNavigation } from "@/components/products/filter-navigation";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import {
  DEFAULT_SORT,
  SORT_PRESETS,
  isDefaultSort,
  productFiltersHref,
  sortPresetValue,
  type ProductFilters,
} from "@/lib/product-filters";

interface ActiveFilterChipsProps {
  appliedFilters: ProductFilters | null;
  categories: IStoreCategoryOption[];
}

interface FilterChip {
  key: string;
  label: string;
  next: ProductFilters;
}

const buildChips = (
  filters: ProductFilters,
  categories: IStoreCategoryOption[],
  currency: string,
): FilterChip[] => {
  const chips: FilterChip[] = [];

  if (filters.search !== undefined) {
    const next = { ...filters };
    delete next.search;
    chips.push({ key: "search", label: `Search: "${filters.search}"`, next });
  }
  if (filters.categoryId !== undefined) {
    const next = { ...filters };
    delete next.categoryId;
    const option = categories.find(
      (category) => category.id === filters.categoryId,
    );
    chips.push({
      key: "categoryId",
      label: `Category: ${option?.name ?? `Category #${filters.categoryId}`}`,
      next,
    });
  }
  if (filters.minPrice !== undefined) {
    const next = { ...filters };
    delete next.minPrice;
    chips.push({
      key: "minPrice",
      label: `Min price: ${formatMoney(filters.minPrice, currency)}`,
      next,
    });
  }
  if (filters.maxPrice !== undefined) {
    const next = { ...filters };
    delete next.maxPrice;
    chips.push({
      key: "maxPrice",
      label: `Max price: ${formatMoney(filters.maxPrice, currency)}`,
      next,
    });
  }
  if (filters.inStock !== undefined) {
    const next = { ...filters };
    delete next.inStock;
    chips.push({
      key: "inStock",
      label: filters.inStock ? "In stock" : "Out of stock",
      next,
    });
  }
  if (!isDefaultSort(filters)) {
    const preset = SORT_PRESETS.find(
      (item) => item.value === sortPresetValue(filters),
    );
    chips.push({
      key: "sort",
      label: `Sort: ${preset?.label ?? "Custom"}`,
      next: { ...filters, ...DEFAULT_SORT },
    });
  }

  return chips;
};

export default function ActiveFilterChips({
  appliedFilters,
  categories,
}: ActiveFilterChipsProps) {
  const { isPending, navigate } = useFilterNavigation();
  const currency = useCurrency().toUpperCase();
  const chips =
    appliedFilters != null ? buildChips(appliedFilters, categories, currency) : [];

  if (chips.length === 0 && !isPending) return null;

  return (
    <div
      role="group"
      aria-label="Active filters"
      className="flex flex-wrap items-center gap-2"
    >
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex max-w-full items-center gap-1 rounded-2xl border border-border bg-card py-1 pl-3 pr-1 text-sm"
        >
          <span className="min-w-0 wrap-break-word">{chip.label}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            disabled={isPending}
            aria-label={`Remove filter: ${chip.label}`}
            onClick={() => navigate(productFiltersHref(chip.next, 1))}
          >
            <X />
          </Button>
        </span>
      ))}
      {chips.length > 0 && (
        <Button
          type="button"
          variant="link"
          size="sm"
          disabled={isPending}
          onClick={() => navigate("/products")}
        >
          Clear all
        </Button>
      )}
      <span
        role="status"
        aria-live="polite"
        className="text-sm text-muted-foreground"
      >
        {isPending ? "Updating results..." : ""}
      </span>
    </div>
  );
}

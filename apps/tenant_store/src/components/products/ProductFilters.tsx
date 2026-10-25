"use client";

import { useId, useState, type FormEvent } from "react";
import { SlidersHorizontal, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { IStoreCategoryOption } from "@/api/categoriesApi";
import { useCurrency } from "@/components/currency/currency-provider";
import { useFilterNavigation } from "@/components/products/filter-navigation";
import {
  productFiltersHref,
  validateDraft,
  type CatalogPriceRange,
  type FilterFieldErrors,
  type ProductFilterDraft,
} from "@/lib/product-filters";
import { FilterActions } from "./filters/FilterActions";
import { FilterFields } from "./filters/FilterFields";
import type { FilterDraftChange } from "./filters/types";
import {
  clearFilterFieldErrors,
  getFilterErrorMessages,
  mergeSubmitErrors,
} from "./filters/utils";

interface ProductFiltersProps {
  categories: IStoreCategoryOption[];
  categoryError: string | null;
  priceRange: CatalogPriceRange;
  initialDraft: ProductFilterDraft;
  initialErrors: FilterFieldErrors;
  hasActiveFilters: boolean;
}

export default function ProductFilters({
  categories,
  categoryError,
  priceRange,
  initialDraft,
  initialErrors,
  hasActiveFilters,
}: ProductFiltersProps) {
  const { isPending, navigate, refresh } = useFilterNavigation();
  const currency = useCurrency().toUpperCase();
  const idPrefix = useId();
  const [draft, setDraft] = useState(initialDraft);
  const [errors, setErrors] = useState<FilterFieldErrors>(initialErrors);
  const [sheetOpen, setSheetOpen] = useState(false);

  const updateDraft: FilterDraftChange = (patch, clearedKeys) => {
    setDraft((previous) => ({ ...previous, ...patch }));
    setErrors((previous) => clearFilterFieldErrors(previous, clearedKeys));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) return;

    const result = validateDraft(draft);
    const validationErrors = mergeSubmitErrors(result.errors, errors);
    setErrors(validationErrors);
    if (
      !result.filters ||
      getFilterErrorMessages(validationErrors).length > 0
    ) {
      return;
    }

    setSheetOpen(false);
    const href = productFiltersHref(result.filters, 1);
    navigate(href);
  };

  const clearAll = () => {
    if (isPending) return;
    navigate("/products");
  };

  const retryPrices = () => {
    if (isPending) return;
    refresh();
  };

  const fieldsProps = {
    draft,
    initialDraft,
    errors,
    categories,
    categoryError,
    priceRange,
    currency,
    disabled: isPending,
    onRetryPrices: retryPrices,
    onChange: updateDraft,
  };

  return (
    <>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className="fixed bottom-6 left-6 z-40 rounded-full bg-background shadow-lg sm:bottom-8 sm:left-8"
              disabled={isPending}
            />
          }
        >
          <SlidersHorizontal />
          Filters
        </SheetTrigger>
        <SheetContent
          side="left"
          className="data-[side=left]:w-full data-[side=left]:sm:max-w-md"
        >
          <SheetHeader>
            <SheetTitle>Filter products</SheetTitle>
            <SheetDescription>
              Apply search, category, price, availability, and sorting.
            </SheetDescription>
          </SheetHeader>
          <form
            className="flex min-h-0 flex-1 flex-col"
            aria-label="Filter products"
            onSubmit={submit}
            aria-busy={isPending}
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
              <FilterFields {...fieldsProps} idPrefix={`${idPrefix}-sheet`} />
            </div>
            <SheetFooter className="flex-row flex-wrap border-t">
              <FilterActions
                isPending={isPending}
                hasActiveFilters={hasActiveFilters}
                fromSheet={true}
                onClearAll={clearAll}
              />
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {categoryError && (
        <Alert>
          <TriangleAlert />
          <AlertTitle>Categories unavailable</AlertTitle>
          <AlertDescription className="flex min-w-0 flex-wrap items-center gap-3 wrap-break-word">
            <span>{categoryError}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={refresh}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}

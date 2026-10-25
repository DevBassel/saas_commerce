import { TriangleAlert } from "lucide-react";

import type { IStoreCategoryOption } from "@/api/categoriesApi";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type {
  CatalogPriceRange,
  FilterFieldErrors,
  ProductFilterDraft,
} from "@/lib/product-filters";
import { AvailabilityFilter } from "./AvailabilityFilter";
import { CategoryFilter } from "./CategoryFilter";
import { PriceRangeFilter } from "./PriceRangeFilter";
import { SearchFilter } from "./SearchFilter";
import { SortFilter } from "./SortFilter";
import type { FilterControlProps } from "./types";
import { getFilterErrorMessages } from "./utils";

interface FilterFieldsProps extends FilterControlProps {
  draft: ProductFilterDraft;
  initialDraft: ProductFilterDraft;
  errors: FilterFieldErrors;
  categories: IStoreCategoryOption[];
  categoryError: string | null;
  priceRange: CatalogPriceRange;
  currency: string;
  onRetryPrices: () => void;
}

export function FilterFields({
  idPrefix,
  draft,
  initialDraft,
  errors,
  categories,
  categoryError,
  priceRange,
  currency,
  disabled,
  onRetryPrices,
  onChange,
}: FilterFieldsProps) {
  const messages = getFilterErrorMessages(errors);
  const controlProps = { idPrefix, disabled, onChange };

  return (
    <div className="flex flex-col gap-4">
      {messages.length > 0 && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Check your filter values</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc">
              {messages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex min-w-0 flex-col gap-6">
        <SearchFilter
          {...controlProps}
          value={draft.search}
          error={errors.search}
        />
        <CategoryFilter
          {...controlProps}
          value={draft.categoryId}
          error={errors.categoryId}
          categories={categories}
          categoryError={categoryError}
        />
        <PriceRangeFilter
          {...controlProps}
          draft={draft}
          initialDraft={initialDraft}
          errors={errors}
          priceRange={priceRange}
          currency={currency}
          onRetryPrices={onRetryPrices}
        />
        <AvailabilityFilter
          {...controlProps}
          value={draft.inStock}
          error={errors.inStock}
        />
        <SortFilter
          {...controlProps}
          value={draft.sort}
          error={errors.sort}
        />
      </div>
    </div>
  );
}

import type { IStoreCategoryOption } from "@/api/categoriesApi";
import { formatMoney } from "@/lib/money";
import {
  getPriceSliderState,
  type CatalogPriceRange,
  type FilterFieldErrors,
  type ProductFilterDraft,
} from "@/lib/product-filters";

export const getFilterErrorMessages = (errors: FilterFieldErrors): string[] =>
  Object.values(errors).filter((message): message is string => Boolean(message));

export const clearFilterFieldErrors = (
  errors: FilterFieldErrors,
  clearedKeys: (keyof FilterFieldErrors)[],
): FilterFieldErrors => {
  if (!clearedKeys.some((key) => errors[key])) return errors;
  const next = { ...errors };
  for (const key of clearedKeys) delete next[key];
  return next;
};

// Repeated URL values have no scalar draft. Keep their errors until the
// corresponding control/reset is used instead of broadening the query.
export const mergeSubmitErrors = (
  validationErrors: FilterFieldErrors,
  currentErrors: FilterFieldErrors,
): FilterFieldErrors => ({
  ...validationErrors,
  ...(currentErrors.minPrice ? { minPrice: currentErrors.minPrice } : {}),
  ...(currentErrors.maxPrice ? { maxPrice: currentErrors.maxPrice } : {}),
  ...(currentErrors.inStock ? { inStock: currentErrors.inStock } : {}),
});

export const getCategoryItems = (
  categories: IStoreCategoryOption[],
  categoryId: string,
) => {
  const categoryItems = [
    { value: "all", label: "All categories" },
    ...categories.map((category) => ({
      value: String(category.id),
      label: category.name,
    })),
  ];
  if (
    categoryId &&
    !categories.some((category) => String(category.id) === categoryId)
  ) {
    categoryItems.push({
      value: categoryId,
      label: `Category #${categoryId}`,
    });
  }
  return categoryItems;
};

interface PriceFilterPresentationProps {
  draft: Pick<ProductFilterDraft, "minPrice" | "maxPrice">;
  initialDraft: Pick<ProductFilterDraft, "minPrice" | "maxPrice">;
  errors: Pick<FilterFieldErrors, "minPrice" | "maxPrice">;
  priceRange: CatalogPriceRange;
  currency: string;
  disabled: boolean;
}

export const getPriceFilterPresentation = ({
  draft,
  initialDraft,
  errors,
  priceRange,
  currency,
  disabled,
}: PriceFilterPresentationProps) => {
  const priceSlider = getPriceSliderState(draft, initialDraft, priceRange);
  const priceInvalid = Boolean(errors.minPrice || errors.maxPrice);
  const priceDisabled = disabled || priceSlider.disabled || priceInvalid;
  const hasMinimum = draft.minPrice.trim() !== "";
  const hasMaximum = draft.maxPrice.trim() !== "";
  const priceHint = priceInvalid
    ? "Reset price to correct the highlighted values."
    : (priceSlider.hint ??
      (!hasMinimum && !hasMaximum
        ? "All prices. Move either handle to set a limit."
        : !hasMaximum
          ? "No maximum price limit selected."
          : !hasMinimum
            ? "No minimum price limit selected."
            : "Both price limits are inclusive."));
  const minimumLabel = errors.minPrice
    ? draft.minPrice || "Invalid value"
    : formatMoney(hasMinimum ? draft.minPrice : 0, currency);
  const maximumLabel = errors.maxPrice
    ? draft.maxPrice || "Invalid value"
    : hasMaximum
      ? formatMoney(draft.maxPrice, currency)
      : priceRange.status === "ready"
        ? formatMoney(
            priceSlider.disabled ? priceRange.maxPrice : priceSlider.values[1],
            currency,
          )
        : "Any";

  return {
    priceSlider,
    priceInvalid,
    priceDisabled,
    hasMinimum,
    hasMaximum,
    priceHint,
    minimumLabel,
    maximumLabel,
  };
};

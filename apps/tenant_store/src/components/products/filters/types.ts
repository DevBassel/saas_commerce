import type {
  FilterFieldErrors,
  ProductFilterDraft,
} from "@/lib/product-filters";

export type FilterDraftChange = (
  patch: Partial<ProductFilterDraft>,
  clearedKeys: (keyof FilterFieldErrors)[],
) => void;

export interface FilterControlProps {
  idPrefix: string;
  disabled: boolean;
  onChange: FilterDraftChange;
}

export const PRODUCTS_PAGE_SIZE = 12;
export const MAX_SEARCH_LENGTH = 255;
export const MAX_CATEGORY_ID = 2147483647;
export const MAX_PAGE = 2147483647;

export type ProductSortBy = "createdAt" | "price" | "name";
export type ProductSortOrder = "asc" | "desc";

export interface ProductSort {
  sortBy: ProductSortBy;
  sortOrder: ProductSortOrder;
}

export interface ProductFilters {
  search?: string;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy: ProductSortBy;
  sortOrder: ProductSortOrder;
}

export interface FilterFieldErrors {
  search?: string;
  categoryId?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: string;
  sort?: string;
  page?: string;
}

export interface ParsedProductSearch {
  filters: ProductFilters | null;
  errors: FilterFieldErrors;
  page: number;
  hasActiveFilters: boolean;
}

export interface ProductFilterDraft {
  search: string;
  categoryId: string;
  minPrice: string;
  maxPrice: string;
  inStock: "all" | "true" | "false";
  sort: string;
}

export type CatalogPriceRange =
  | { status: "ready"; maxPrice: number }
  | { status: "empty" }
  | { status: "error"; message: string };

type PriceDraft = Pick<ProductFilterDraft, "minPrice" | "maxPrice">;

export const PRICE_SLIDER_STEP = 0.01;

interface PriceSliderState {
  values: [number, number];
  max: number;
  disabled: boolean;
  hint: string | null;
}

export interface SortPreset extends ProductSort {
  value: string;
  label: string;
}

export const DEFAULT_SORT: ProductSort = {
  sortBy: "createdAt",
  sortOrder: "desc",
};

export const SORT_PRESETS: readonly SortPreset[] = [
  {
    value: "createdAt:desc",
    label: "Newest",
    sortBy: "createdAt",
    sortOrder: "desc",
  },
  {
    value: "createdAt:asc",
    label: "Oldest",
    sortBy: "createdAt",
    sortOrder: "asc",
  },
  {
    value: "price:asc",
    label: "Price: low to high",
    sortBy: "price",
    sortOrder: "asc",
  },
  {
    value: "price:desc",
    label: "Price: high to low",
    sortBy: "price",
    sortOrder: "desc",
  },
  { value: "name:asc", label: "Name: A-Z", sortBy: "name", sortOrder: "asc" },
  { value: "name:desc", label: "Name: Z-A", sortBy: "name", sortOrder: "desc" },
];

const SORT_BY_VALUES: readonly ProductSortBy[] = ["createdAt", "price", "name"];

export const isDefaultSort = (sort: ProductSort): boolean =>
  sort.sortBy === DEFAULT_SORT.sortBy &&
  sort.sortOrder === DEFAULT_SORT.sortOrder;

export const sortPresetValue = (sort: ProductSort): string =>
  `${sort.sortBy}:${sort.sortOrder}`;

interface ScalarResult {
  value?: string;
  repeated?: boolean;
}

const readScalar = (
  raw: Record<string, string | string[] | undefined>,
  key: string,
): ScalarResult => {
  const value = raw[key];
  if (value === undefined) return {};
  if (Array.isArray(value)) return { repeated: true };
  return { value };
};

const parseSearch = (value: string): { value?: string; error?: string } => {
  const trimmed = value.trim();
  if (!trimmed) return {};
  if (trimmed.length > MAX_SEARCH_LENGTH) {
    return {
      error: `Search must be ${MAX_SEARCH_LENGTH} characters or fewer.`,
    };
  }
  return { value: trimmed };
};

const parseCategoryId = (
  value: string,
): { value?: number; error?: string } => {
  const trimmed = value.trim();
  if (!trimmed) return {};
  if (!/^\d+$/.test(trimmed)) {
    return { error: "Choose a category from the list." };
  }
  const numeric = Number(trimmed);
  if (
    !Number.isSafeInteger(numeric) ||
    numeric < 1 ||
    numeric > MAX_CATEGORY_ID
  ) {
    return { error: "Choose a category from the list." };
  }
  return { value: numeric };
};

const parsePrice = (
  value: string,
  label: string,
): { value?: number; error?: string } => {
  const trimmed = value.trim();
  if (!trimmed) return {};
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) {
    return { error: `${label} must be a non-negative number.` };
  }
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return { error: `${label} must be a non-negative number.` };
  }
  if (numeric > Number.MAX_SAFE_INTEGER) {
    return { error: `${label} is too large.` };
  }
  return { value: numeric };
};

/** Display bounds never become draft filters until a handle is edited. */
export const getPriceSliderState = (
  draft: PriceDraft,
  initialDraft: PriceDraft,
  catalog: CatalogPriceRange,
): PriceSliderState => {
  const minimum = parsePrice(draft.minPrice, "Minimum price");
  const maximum = parsePrice(draft.maxPrice, "Maximum price");
  // Include the committed bounds so dragging an out-of-catalog handle does not
  // continuously shrink its own track. A metadata refresh also retains drafts.
  const ceiling = Math.max(
    catalog.status === "ready" ? catalog.maxPrice : 0,
    parsePrice(initialDraft.minPrice, "Minimum price").value ?? 0,
    parsePrice(initialDraft.maxPrice, "Maximum price").value ?? 0,
    minimum.value ?? 0,
    maximum.value ?? 0,
  );
  const precise = Number.isSafeInteger(Math.ceil(ceiling / PRICE_SLIDER_STEP));
  const invalid = Boolean(
    minimum.error ||
    maximum.error ||
    (minimum.value !== undefined &&
      maximum.value !== undefined &&
      minimum.value > maximum.value),
  );
  // Base UI requires a positive span, including for a disabled zero-price track.
  const max = precise
    ? Math.max(ceiling, PRICE_SLIDER_STEP)
    : PRICE_SLIDER_STEP;
  const values: [number, number] =
    precise && !invalid
      ? [minimum.value ?? 0, maximum.value ?? ceiling]
      : [0, 0];

  let hint: string | null = null;
  if (invalid) hint = "Reset price to correct the invalid range.";
  else if (catalog.status === "error") {
    hint = "Price range is unavailable. Retry or reset price below.";
  } else if (catalog.status === "empty") {
    hint = "No catalog prices are available yet.";
  } else if (!precise) {
    hint = "This range is too large to adjust precisely. Reset price to choose a new range.";
  } else if (catalog.maxPrice === 0) hint = "All catalog prices are zero.";

  return { values, max, disabled: hint !== null, hint };
};

export const priceSliderDraftPatch = (
  values: readonly number[],
  activeThumbIndex: number,
): Partial<PriceDraft> => {
  if (
    values.length !== 2 ||
    (activeThumbIndex !== 0 && activeThumbIndex !== 1) ||
    values.some((value) => !Number.isFinite(value) || value < 0) ||
    values[0] > values[1]
  ) {
    return {};
  }

  const key = activeThumbIndex === 0 ? "minPrice" : "maxPrice";
  return { [key]: String(values[activeThumbIndex]) };
};

const parseStock = (
  value: string,
): { value?: boolean; error?: string } => {
  const trimmed = value.trim();
  if (!trimmed) return {};
  if (trimmed === "true") return { value: true };
  if (trimmed === "false") return { value: false };
  return { error: "Choose an availability option." };
};

const parseSort = (
  sortByValue: string | undefined,
  sortOrderValue: string | undefined,
): { value?: ProductSort; error?: string } => {
  const sortBy = sortByValue?.trim() ?? "";
  const sortOrder = sortOrderValue?.trim().toLowerCase() ?? "";

  if (!sortBy && !sortOrder) return { value: { ...DEFAULT_SORT } };
  if (!sortBy || !sortOrder) {
    return { error: "Choose a valid sort option." };
  }
  if (!SORT_BY_VALUES.includes(sortBy as ProductSortBy)) {
    return { error: "Choose a valid sort option." };
  }
  if (sortOrder !== "asc" && sortOrder !== "desc") {
    return { error: "Choose a valid sort option." };
  }
  return {
    value: {
      sortBy: sortBy as ProductSortBy,
      sortOrder: sortOrder as ProductSortOrder,
    },
  };
};

const parsePage = (raw: Record<string, string | string[] | undefined>) => {
  const scalar = readScalar(raw, "page");
  if (scalar.repeated) {
    return { page: 1, error: "Page must be a single number." };
  }
  const value = scalar.value?.trim();
  if (!value) return { page: 1 };
  if (!/^\d+$/.test(value)) return { page: 1 };
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < 1) return { page: 1 };
  if (numeric > MAX_PAGE) {
    return { page: 1, error: "Page number is too large." };
  }
  return { page: numeric };
};

const hasFilters = (filters: ProductFilters): boolean =>
  filters.search !== undefined ||
  filters.categoryId !== undefined ||
  filters.minPrice !== undefined ||
  filters.maxPrice !== undefined ||
  filters.inStock !== undefined ||
  !isDefaultSort(filters);

export const parseProductSearchParams = (
  raw: Record<string, string | string[] | undefined>,
): ParsedProductSearch => {
  const errors: FilterFieldErrors = {};
  const pageResult = parsePage(raw);
  if (pageResult.error) errors.page = pageResult.error;

  const searchScalar = readScalar(raw, "search");
  const search = searchScalar.repeated
    ? { error: "Search must be a single value." }
    : parseSearch(searchScalar.value ?? "");
  if (search.error) errors.search = search.error;

  const categoryScalar = readScalar(raw, "categoryId");
  const category = categoryScalar.repeated
    ? { error: "Choose a category from the list." }
    : parseCategoryId(categoryScalar.value ?? "");
  if (category.error) errors.categoryId = category.error;

  const minScalar = readScalar(raw, "minPrice");
  const maxScalar = readScalar(raw, "maxPrice");
  const minPrice = minScalar.repeated
    ? { error: "Minimum price must be a single number." }
    : parsePrice(minScalar.value ?? "", "Minimum price");
  const maxPrice = maxScalar.repeated
    ? { error: "Maximum price must be a single number." }
    : parsePrice(maxScalar.value ?? "", "Maximum price");
  if (minPrice.error) errors.minPrice = minPrice.error;
  if (maxPrice.error) errors.maxPrice = maxPrice.error;
  if (
    minPrice.value !== undefined &&
    maxPrice.value !== undefined &&
    minPrice.value > maxPrice.value
  ) {
    errors.maxPrice = "Maximum price must be greater than the minimum.";
  }

  const stockScalar = readScalar(raw, "inStock");
  const stock = stockScalar.repeated
    ? { error: "Choose an availability option." }
    : parseStock(stockScalar.value ?? "");
  if (stock.error) errors.inStock = stock.error;

  const sortByScalar = readScalar(raw, "sortBy");
  const sortOrderScalar = readScalar(raw, "sortOrder");
  const sort =
    sortByScalar.repeated || sortOrderScalar.repeated
      ? { error: "Choose a valid sort option." }
      : parseSort(sortByScalar.value, sortOrderScalar.value);
  if (sort.error) errors.sort = sort.error;

  const hasErrors = Object.values(errors).some(Boolean);
  if (hasErrors || !sort.value) {
    return {
      filters: null,
      errors,
      page: pageResult.page,
      hasActiveFilters: false,
    };
  }

  const filters: ProductFilters = {
    ...sort.value,
    ...(search.value !== undefined ? { search: search.value } : {}),
    ...(category.value !== undefined ? { categoryId: category.value } : {}),
    ...(minPrice.value !== undefined ? { minPrice: minPrice.value } : {}),
    ...(maxPrice.value !== undefined ? { maxPrice: maxPrice.value } : {}),
    ...(stock.value !== undefined ? { inStock: stock.value } : {}),
  };

  return {
    filters,
    errors,
    page: pageResult.page,
    hasActiveFilters: hasFilters(filters),
  };
};

const draftString = (value: string | string[] | undefined): string =>
  typeof value === "string" ? value : "";

export const draftFromSearchParams = (
  raw: Record<string, string | string[] | undefined>,
): ProductFilterDraft => {
  const sort = parseSort(draftString(raw.sortBy), draftString(raw.sortOrder));
  const sortValue = sortPresetValue(sort.value ?? DEFAULT_SORT);

  return {
    search: draftString(raw.search),
    categoryId: draftString(raw.categoryId),
    minPrice: draftString(raw.minPrice),
    maxPrice: draftString(raw.maxPrice),
    inStock:
      raw.inStock === "true"
        ? "true"
        : raw.inStock === "false"
          ? "false"
          : "all",
    sort: sortValue,
  };
};

export const draftFromFilters = (filters: ProductFilters): ProductFilterDraft => ({
  search: filters.search ?? "",
  categoryId: filters.categoryId !== undefined ? String(filters.categoryId) : "",
  minPrice: filters.minPrice !== undefined ? String(filters.minPrice) : "",
  maxPrice: filters.maxPrice !== undefined ? String(filters.maxPrice) : "",
  inStock:
    filters.inStock === true
      ? "true"
      : filters.inStock === false
        ? "false"
        : "all",
  sort: sortPresetValue(filters),
});

export const validateDraft = (
  draft: ProductFilterDraft,
): { filters: ProductFilters | null; errors: FilterFieldErrors } => {
  const errors: FilterFieldErrors = {};

  const search = parseSearch(draft.search);
  if (search.error) errors.search = search.error;

  const category = parseCategoryId(draft.categoryId);
  if (category.error) errors.categoryId = category.error;

  const minPrice = parsePrice(draft.minPrice, "Minimum price");
  const maxPrice = parsePrice(draft.maxPrice, "Maximum price");
  if (minPrice.error) errors.minPrice = minPrice.error;
  if (maxPrice.error) errors.maxPrice = maxPrice.error;
  if (
    minPrice.value !== undefined &&
    maxPrice.value !== undefined &&
    minPrice.value > maxPrice.value
  ) {
    errors.maxPrice = "Maximum price must be greater than the minimum.";
  }

  const stock = parseStock(draft.inStock === "all" ? "" : draft.inStock);
  if (stock.error) errors.inStock = stock.error;

  const preset = SORT_PRESETS.find((item) => item.value === draft.sort);
  if (!preset) errors.sort = "Choose a valid sort option.";

  if (Object.values(errors).some(Boolean) || !preset) {
    return { filters: null, errors };
  }

  return {
    filters: {
      sortBy: preset.sortBy,
      sortOrder: preset.sortOrder,
      ...(search.value !== undefined ? { search: search.value } : {}),
      ...(category.value !== undefined ? { categoryId: category.value } : {}),
      ...(minPrice.value !== undefined ? { minPrice: minPrice.value } : {}),
      ...(maxPrice.value !== undefined ? { maxPrice: maxPrice.value } : {}),
      ...(stock.value !== undefined ? { inStock: stock.value } : {}),
    },
    errors,
  };
};

export const serializeProductFilters = (
  filters: ProductFilters,
): Record<string, string> => {
  const params: Record<string, string> = {};
  if (filters.search !== undefined) params.search = filters.search;
  if (filters.categoryId !== undefined) {
    params.categoryId = String(filters.categoryId);
  }
  if (filters.minPrice !== undefined) params.minPrice = String(filters.minPrice);
  if (filters.maxPrice !== undefined) params.maxPrice = String(filters.maxPrice);
  if (filters.inStock !== undefined) {
    params.inStock = filters.inStock ? "true" : "false";
  }
  if (!isDefaultSort(filters)) {
    params.sortBy = filters.sortBy;
    params.sortOrder = filters.sortOrder;
  }
  return params;
};

export const productFiltersHref = (
  filters: ProductFilters,
  page = 1,
): string => {
  const params = new URLSearchParams(serializeProductFilters(filters));
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/products?${query}` : "/products";
};

import { Button } from "@/components/ui/button";
import {
  Slider,
  SliderControl,
  SliderIndicator,
  SliderThumb,
  SliderTrack,
} from "@/components/ui/slider";
import { formatMoney } from "@/lib/money";
import {
  PRICE_SLIDER_STEP,
  priceSliderDraftPatch,
  type CatalogPriceRange,
  type FilterFieldErrors,
  type ProductFilterDraft,
} from "@/lib/product-filters";
import type { FilterControlProps } from "./types";
import { getPriceFilterPresentation } from "./utils";

interface PriceRangeFilterProps extends FilterControlProps {
  draft: Pick<ProductFilterDraft, "minPrice" | "maxPrice">;
  initialDraft: Pick<ProductFilterDraft, "minPrice" | "maxPrice">;
  errors: Pick<FilterFieldErrors, "minPrice" | "maxPrice">;
  priceRange: CatalogPriceRange;
  currency: string;
  onRetryPrices: () => void;
}

export function PriceRangeFilter({
  idPrefix,
  draft,
  initialDraft,
  errors,
  priceRange,
  currency,
  disabled,
  onRetryPrices,
  onChange,
}: PriceRangeFilterProps) {
  const priceLabelId = `${idPrefix}-price-label`;
  const priceHintId = `${idPrefix}-price-hint`;
  const minErrorId = `${idPrefix}-min-price-error`;
  const maxErrorId = `${idPrefix}-max-price-error`;
  const {
    priceSlider,
    priceInvalid,
    priceDisabled,
    hasMinimum,
    hasMaximum,
    priceHint,
    minimumLabel,
    maximumLabel,
  } = getPriceFilterPresentation({
    draft,
    initialDraft,
    errors,
    priceRange,
    currency,
    disabled,
  });
  const priceDescription = [
    priceHintId,
    errors.minPrice ? minErrorId : null,
    errors.maxPrice ? maxErrorId : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p id={priceLabelId} className="text-sm font-medium">
        Price range ({currency})
      </p>
      <Slider
        aria-labelledby={priceLabelId}
        aria-describedby={priceDescription}
        min={0}
        max={priceSlider.max}
        step={PRICE_SLIDER_STEP}
        value={priceSlider.values}
        disabled={priceDisabled}
        minStepsBetweenValues={0}
        thumbCollisionBehavior="none"
        onValueChange={(values, { activeThumbIndex }) => {
          if (priceDisabled) return;
          onChange(priceSliderDraftPatch(values, activeThumbIndex), [
            activeThumbIndex === 0 ? "minPrice" : "maxPrice",
          ]);
        }}
      >
        <SliderControl>
          <SliderTrack>
            <SliderIndicator />
          </SliderTrack>
          <SliderThumb
            index={0}
            aria-label={`Minimum price (${currency})`}
            aria-describedby={priceDescription}
            aria-invalid={priceInvalid || undefined}
            getAriaValueText={(_formatted, value) => formatMoney(value, currency)}
          />
          <SliderThumb
            index={1}
            aria-label={`Maximum price (${currency})`}
            aria-describedby={priceDescription}
            aria-invalid={priceInvalid || undefined}
            getAriaValueText={(_formatted, value) => formatMoney(value, currency)}
          />
        </SliderControl>
      </Slider>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="min-w-0 rounded-xl bg-muted/50 px-3 py-2">
          <span className="text-xs text-muted-foreground">Minimum</span>
          <p className="wrap-break-word font-medium tabular-nums">
            {minimumLabel}
          </p>
        </div>
        <div className="min-w-0 rounded-xl bg-muted/50 px-3 py-2 text-right">
          <span className="text-xs text-muted-foreground">Maximum</span>
          <p className="wrap-break-word font-medium tabular-nums">
            {maximumLabel}
          </p>
        </div>
      </div>
      <p id={priceHintId} className="text-xs text-muted-foreground">
        {priceHint}
      </p>
      {errors.minPrice && (
        <p id={minErrorId} className="text-xs text-destructive">
          {errors.minPrice}
        </p>
      )}
      {errors.maxPrice && (
        <p id={maxErrorId} className="text-xs text-destructive">
          {errors.maxPrice}
        </p>
      )}
      {priceRange.status === "error" && (
        <p className="wrap-break-word text-xs text-muted-foreground">
          {priceRange.message}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || (!hasMinimum && !hasMaximum && !priceInvalid)}
          onClick={() =>
            onChange({ minPrice: "", maxPrice: "" }, ["minPrice", "maxPrice"])
          }
        >
          Reset price
        </Button>
        {priceRange.status === "error" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={onRetryPrices}
          >
            Retry price range
          </Button>
        )}
      </div>
    </div>
  );
}

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ProductFilterDraft } from "@/lib/product-filters";
import type { FilterControlProps } from "./types";

interface AvailabilityFilterProps extends FilterControlProps {
  value: ProductFilterDraft["inStock"];
  error?: string;
}

export function AvailabilityFilter({
  idPrefix,
  value,
  error,
  disabled,
  onChange,
}: AvailabilityFilterProps) {
  const stockId = `${idPrefix}-stock`;
  const stockErrorId = `${stockId}-error`;
  const stockHintId = `${stockId}-hint`;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border p-3">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <Label htmlFor={stockId} className="leading-snug">
          In stock only
        </Label>
        <Switch
          id={stockId}
          checked={value === "true"}
          disabled={disabled}
          aria-describedby={`${stockHintId}${error ? ` ${stockErrorId}` : ""}`}
          aria-invalid={error ? true : undefined}
          onCheckedChange={(checked) =>
            onChange({ inStock: checked ? "true" : "all" }, ["inStock"])
          }
        />
      </div>
      <p id={stockHintId} className="text-xs text-muted-foreground">
        {value === "false"
          ? "Out-of-stock only (from link)."
          : "Switch off to include all products."}
      </p>
      {error && (
        <p id={stockErrorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
      {(value === "false" || error) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          disabled={disabled}
          onClick={() => onChange({ inStock: "all" }, ["inStock"])}
        >
          Show all availability
        </Button>
      )}
    </div>
  );
}

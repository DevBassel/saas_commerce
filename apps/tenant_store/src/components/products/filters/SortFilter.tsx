import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_SORT,
  SORT_PRESETS,
  sortPresetValue,
} from "@/lib/product-filters";
import type { FilterControlProps } from "./types";

interface SortFilterProps extends FilterControlProps {
  value: string;
  error?: string;
}

export function SortFilter({
  idPrefix,
  value,
  error,
  disabled,
  onChange,
}: SortFilterProps) {
  const sortId = `${idPrefix}-sort`;
  const sortErrorId = `${sortId}-error`;
  const sortItems = SORT_PRESETS.map((preset) => ({
    value: preset.value,
    label: preset.label,
  }));

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={sortId}>Sort by</Label>
      <Select
        id={sortId}
        items={sortItems}
        value={value}
        disabled={disabled}
        onValueChange={(nextValue) =>
          onChange(
            {
              sort:
                nextValue != null && String(nextValue).length > 0
                  ? String(nextValue)
                  : sortPresetValue(DEFAULT_SORT),
            },
            ["sort"],
          )
        }
      >
        <SelectTrigger
          className="w-full"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? sortErrorId : undefined}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {sortItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p id={sortErrorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

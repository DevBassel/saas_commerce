import type { IStoreCategoryOption } from "@/api/categoriesApi";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FilterControlProps } from "./types";
import { getCategoryItems } from "./utils";

interface CategoryFilterProps extends FilterControlProps {
  value: string;
  error?: string;
  categories: IStoreCategoryOption[];
  categoryError: string | null;
}

export function CategoryFilter({
  idPrefix,
  value,
  error,
  categories,
  categoryError,
  disabled,
  onChange,
}: CategoryFilterProps) {
  const categoryId = `${idPrefix}-category`;
  const categoryErrorId = `${categoryId}-error`;
  const categoryItems = getCategoryItems(categories, value);

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={categoryId}>Category</Label>
      <Select
        id={categoryId}
        items={categoryItems}
        value={value || "all"}
        disabled={disabled}
        onValueChange={(nextValue) =>
          onChange(
            {
              categoryId:
                nextValue == null || String(nextValue) === "all"
                  ? ""
                  : String(nextValue),
            },
            ["categoryId"],
          )
        }
      >
        <SelectTrigger
          className="w-full min-w-0"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? categoryErrorId : undefined}
        >
          <SelectValue placeholder="All categories" />
        </SelectTrigger>
        <SelectContent>
          {categoryItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && (
        <p id={categoryErrorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
      {categoryError && (
        <p className="text-xs text-muted-foreground">
          Category suggestions are unavailable right now.
        </p>
      )}
    </div>
  );
}

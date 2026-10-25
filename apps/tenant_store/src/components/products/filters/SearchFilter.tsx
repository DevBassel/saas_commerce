import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FilterControlProps } from "./types";

interface SearchFilterProps extends FilterControlProps {
  value: string;
  error?: string;
}

export function SearchFilter({
  idPrefix,
  value,
  error,
  disabled,
  onChange,
}: SearchFilterProps) {
  const searchId = `${idPrefix}-search`;
  const searchErrorId = `${searchId}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={searchId}>Search</Label>
      <Input
        id={searchId}
        type="search"
        value={value}
        disabled={disabled}
        placeholder="Search products"
        autoComplete="off"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? searchErrorId : undefined}
        onChange={(event) =>
          onChange({ search: event.target.value }, ["search"])
        }
      />
      {error && (
        <p id={searchErrorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

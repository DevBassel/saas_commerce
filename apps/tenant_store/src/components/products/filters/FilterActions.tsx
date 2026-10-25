import { Button } from "@/components/ui/button";
import { SheetClose } from "@/components/ui/sheet";

interface FilterActionsProps {
  isPending: boolean;
  hasActiveFilters: boolean;
  fromSheet: boolean;
  onClearAll: () => void;
}

export function FilterActions({
  isPending,
  hasActiveFilters,
  fromSheet,
  onClearAll,
}: FilterActionsProps) {
  return (
    <>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Updating..." : "Apply filters"}
      </Button>
      {hasActiveFilters && (
        <Button
          type="button"
          variant="ghost"
          disabled={isPending}
          onClick={onClearAll}
        >
          Clear all
        </Button>
      )}
      {fromSheet && (
        <SheetClose
          render={<Button type="button" variant="outline" disabled={isPending} />}
        >
          Cancel
        </SheetClose>
      )}
    </>
  );
}

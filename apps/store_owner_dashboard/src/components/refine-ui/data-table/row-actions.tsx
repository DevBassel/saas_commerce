"use client";

import { Eye, Pencil, Trash } from "lucide-react";

import { ShowButton } from "@/components/refine-ui/buttons/show";
import { EditButton } from "@/components/refine-ui/buttons/edit";
import { DeleteButton } from "@/components/refine-ui/buttons/delete";
import { cn } from "@/lib/utils";

type RowActionsLabels = {
  show?: string;
  edit?: string;
  delete?: string;
};

export const RowActions = ({
  resource,
  recordItemId,
  labels,
  hideDelete,
}: {
  resource: string;
  recordItemId: number;
  labels?: RowActionsLabels;
  hideDelete?: boolean;
}) => (
  <div className={cn("flex", "items-center", "gap-1")}>
    <ShowButton
      resource={resource}
      recordItemId={recordItemId}
      variant="ghost"
      size="icon"
      aria-label={labels?.show ?? "Show"}
    >
      <Eye className="h-4 w-4" />
    </ShowButton>
    <EditButton
      resource={resource}
      recordItemId={recordItemId}
      variant="ghost"
      size="icon"
      aria-label={labels?.edit ?? "Edit"}
    >
      <Pencil className="h-4 w-4" />
    </EditButton>
    {hideDelete ? null : (
      <DeleteButton
        resource={resource}
        recordItemId={recordItemId}
        variant="ghost"
        size="icon"
        aria-label={labels?.delete ?? "Delete"}
      >
        <Trash className={cn("h-4", "w-4", "text-destructive")} />
      </DeleteButton>
    )}
  </div>
);

RowActions.displayName = "RowActions";

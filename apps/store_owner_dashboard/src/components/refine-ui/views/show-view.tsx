"use client";

import type { PropsWithChildren } from "react";

import { ArrowLeftIcon } from "lucide-react";
import {
  useBack,
  useResourceParams,
  useUserFriendlyName,
} from "@refinedev/core";
import { Breadcrumb } from "@/components/refine-ui/layout/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { RefreshButton } from "@/components/refine-ui/buttons/refresh";
import { cn } from "@/lib/utils";
import { EditButton } from "../buttons/edit";

type ShowViewProps = PropsWithChildren<{
  className?: string;
}>;

export function ShowView({ children, className }: ShowViewProps) {
  return (
    <div className={cn("flex flex-col", "gap-4", className)}>{children}</div>
  );
}

type ShowViewHeaderProps = PropsWithChildren<{
  resource?: string;
  title?: string;
  wrapperClassName?: string;
  headerClassName?: string;
  hideEdit?: boolean;
}>;

export const ShowViewHeader = ({
  resource: resourceFromProps,
  title: titleFromProps,
  wrapperClassName,
  headerClassName,
  hideEdit,
}: ShowViewHeaderProps) => {
  const back = useBack();

  const getUserFriendlyName = useUserFriendlyName();

  const { resource, identifier } = useResourceParams({
    resource: resourceFromProps,
  });
  const { id: recordItemId } = useResourceParams();

  const resourceName = resource?.name ?? identifier;

  const title =
    titleFromProps ??
    getUserFriendlyName(
      resource?.meta?.label ?? identifier ?? resource?.name,
      "singular",
    );

  return (
    <div className={cn("flex flex-col", "gap-4", wrapperClassName)}>
      <div className="flex items-center relative gap-2">
        <div className="bg-background z-2 pr-4">
          <Breadcrumb />
        </div>
        <Separator className={cn("absolute", "left-0", "right-0", "z-1")} />
      </div>
      <div
        className={cn(
          "flex",
          "flex-col",
          "items-stretch",
          "gap-3",
          "sm:-ml-2.5",
          "sm:flex-row",
          "sm:items-center",
          "sm:justify-between",
          headerClassName,
        )}
      >
        <div className="flex min-w-0 items-start gap-1 sm:items-center">
          <Button className="shrink-0" variant="ghost" size="icon" onClick={back}>
            <ArrowLeftIcon className="h-4 w-4" />
          </Button>
          <h2 className="min-w-0 break-words text-xl font-bold sm:text-2xl">
            {title}
          </h2>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 self-end sm:self-auto">
          <RefreshButton
            variant="outline"
            recordItemId={recordItemId}
            resource={resourceName}
          />
          {hideEdit ? null : (
            <EditButton
              variant="outline"
              recordItemId={recordItemId}
              resource={resourceName}
            />
          )}
        </div>
      </div>
    </div>
  );
};

ShowView.displayName = "ShowView";

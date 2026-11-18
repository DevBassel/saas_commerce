import React from "react";
import { useTranslate } from "@refinedev/core";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type UndoableNotificationProps = {
  message: string;
  description?: string;
  undoableTimeout?: number;
  cancelMutation?: () => void;
  onClose?: () => void;
};

export function UndoableNotification({
  message,
  description,
  undoableTimeout = 5,
  cancelMutation,
  onClose,
}: UndoableNotificationProps) {
  const t = useTranslate();

  React.useEffect(() => {
    const timer = setTimeout(() => {
      onClose?.();
    }, undoableTimeout * 1000);

    return () => clearTimeout(timer);
  }, [onClose, undoableTimeout]);

  const handleUndo = () => {
    cancelMutation?.();
    onClose?.();
  };

  return (
    <div
      className={cn(
        "bg-card",
        "text-card-foreground",
        "rounded-lg",
        "p-4",
        "shadow-xl",
        "border",
        "border-border",
        "w-[calc(100vw-2rem)]",
        "min-w-0",
        "max-w-md",
        "sm:w-auto",
        "sm:min-w-[320px]",
      )}
    >
      <div
        className={cn(
          "flex",
          "flex-col",
          "items-stretch",
          "gap-3",
          "sm:flex-row",
          "sm:items-center",
          "sm:justify-between",
        )}
      >
        <div className={cn("min-w-0", "flex-1", "sm:mr-4")}>
          <div className={cn("font-medium", "text-foreground", "text-sm")}>
            {message}
          </div>
          {description && (
            <div
              className={cn(
                "text-muted-foreground",
                "text-sm",
                "mt-1",
                "[overflow-wrap:anywhere]",
              )}
            >
              {description}
            </div>
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleUndo}
          className={cn(
            "bg-secondary",
            "hover:bg-secondary/80",
            "text-secondary-foreground",
            "border-0",
            "px-4",
            "py-2",
            "text-sm",
            "font-medium",
            "rounded-md",
            "self-end",
          )}
        >
          {t("buttons.undo", "Undo")}
        </Button>
      </div>
    </div>
  );
}

UndoableNotification.displayName = "UndoableNotification";

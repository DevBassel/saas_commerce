"use client";

import * as React from "react";
import { useTranslate, useWarnAboutChange } from "@refinedev/core";
import {
  UNSAFE_NavigationContext as NavigationContext,
  useLocation,
} from "react-router";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type UnsavedChangesDialogProps = {
  translationKey?: string;
  message?: string;
};

export const UnsavedChangesDialog = ({
  translationKey = "warnWhenUnsavedChanges",
  message = "Are you sure you want to leave? You have unsaved changes.",
}: UnsavedChangesDialogProps) => {
  const translate = useTranslate();
  const { pathname } = useLocation();
  const { warnWhen, setWarnWhen } = useWarnAboutChange();
  const { navigator } = React.useContext(NavigationContext);

  const [open, setOpen] = React.useState(false);
  const pendingNavigation = React.useRef<(() => void) | null>(null);

  const warnMessage = React.useMemo(
    () => translate(translationKey, message),
    [translationKey, message, translate],
  );

  React.useEffect(() => {
    return () => setWarnWhen?.(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!warnWhen) {
      return;
    }

    const push = navigator.push;
    const go = navigator.go;

    navigator.push = (...args: Parameters<typeof push>) => {
      pendingNavigation.current = () => push(...args);
      setOpen(true);
    };

    navigator.go = (...args: Parameters<typeof go>) => {
      pendingNavigation.current = () => go(...args);
      setOpen(true);
    };

    return () => {
      navigator.push = push;
      navigator.go = go;
    };
  }, [navigator, warnWhen]);

  const handleStay = () => {
    pendingNavigation.current = null;
    setOpen(false);
  };

  const handleLeave = () => {
    const navigate = pendingNavigation.current;
    pendingNavigation.current = null;
    setOpen(false);
    setWarnWhen?.(false);
    navigate?.();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          handleStay();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unsaved changes</DialogTitle>
          <DialogDescription>{warnMessage}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleStay}>
            Stay
          </Button>
          <Button variant="destructive" onClick={handleLeave}>
            Leave
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

UnsavedChangesDialog.displayName = "UnsavedChangesDialog";

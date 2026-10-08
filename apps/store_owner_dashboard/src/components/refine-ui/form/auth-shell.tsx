"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const AuthShell = ({ children }: { children: ReactNode }) => {
  return (
    <div
      className={cn(
        "flex",
        "flex-col",
        "items-center",
        "justify-center",
        "px-6",
        "py-8",
        "min-h-svh",
      )}
    >
      {children}
    </div>
  );
};

AuthShell.displayName = "AuthShell";

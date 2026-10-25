"use client";

import {
  createContext,
  useContext,
  useMemo,
  useTransition,
  type ReactNode,
} from "react";

import { useTenantRouter } from "@/lib/tenant/nav";

interface FilterNavigation {
  isPending: boolean;
  navigate: (href: string) => void;
  refresh: () => void;
}

const FilterNavigationContext = createContext<FilterNavigation | null>(null);

export function FilterNavigationProvider({ children }: { children: ReactNode }) {
  const router = useTenantRouter();
  const [isPending, startTransition] = useTransition();
  const value = useMemo<FilterNavigation>(
    () => ({
      isPending,
      navigate: (href) => {
        if (isPending) return;
        startTransition(() => router.push(href));
      },
      refresh: () => {
        if (isPending) return;
        startTransition(() => router.refresh());
      },
    }),
    [isPending, router, startTransition],
  );

  return (
    <FilterNavigationContext.Provider value={value}>
      {children}
    </FilterNavigationContext.Provider>
  );
}

export function useFilterNavigation(): FilterNavigation {
  const value = useContext(FilterNavigationContext);
  if (!value) {
    throw new Error(
      "useFilterNavigation must be used within FilterNavigationProvider",
    );
  }
  return value;
}

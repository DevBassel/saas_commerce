import { useEffect, useRef } from "react";
import { useLocation } from "react-router";

import { ensureTenantParamInUrl, getCurrentTenantSlug } from "@/api/tenant";
import { resetClientState } from "@/lib/client-reset";
import { resolveTenantSync, type TenantSyncState } from "@/lib/tenant-sync";

export const TenantParamSync = () => {
  const location = useLocation();
  const syncRef = useRef<TenantSyncState>({ slug: null, initialized: false });

  useEffect(() => {
    ensureTenantParamInUrl();

    const { state, shouldReset } = resolveTenantSync(
      syncRef.current,
      getCurrentTenantSlug(),
    );
    syncRef.current = state;

    // Switching tenants invalidates every cached query.
    if (shouldReset) resetClientState();
  }, [location.pathname, location.search, location.hash]);

  return null;
};

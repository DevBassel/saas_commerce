import { useEffect } from "react";
import { useLocation } from "react-router";

import { ensureTenantParamInUrl } from "@/api/tenant";

export const TenantParamSync = () => {
  const location = useLocation();

  useEffect(() => {
    ensureTenantParamInUrl();
  }, [location.pathname, location.search, location.hash]);

  return null;
};

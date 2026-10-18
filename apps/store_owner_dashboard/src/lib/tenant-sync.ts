export type TenantSyncState = {
  slug: string | null;
  initialized: boolean;
};

/**
 * Tracks the resolved tenant slug across renders. The first resolution after
 * mount only seeds the state; any later change means every cached query belongs
 * to the previous tenant and the caller must reset client state.
 */
export const resolveTenantSync = (
  state: TenantSyncState,
  slug: string | null,
): { state: TenantSyncState; shouldReset: boolean } => ({
  state: { slug, initialized: true },
  shouldReset: state.initialized && state.slug !== slug,
});

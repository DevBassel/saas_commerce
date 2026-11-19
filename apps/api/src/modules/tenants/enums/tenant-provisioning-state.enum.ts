export enum TenantProvisioningState {
  PENDING = 'PENDING',
  TENANT_CREATED = 'TENANT_CREATED',
  SCHEMA_CREATED = 'SCHEMA_CREATED',
  MIGRATED = 'MIGRATED',
  SEEDED = 'SEEDED',
  SUBSCRIPTION_ASSIGNED = 'SUBSCRIPTION_ASSIGNED',
  OWNER_CREATED = 'OWNER_CREATED',
  ACTIVE = 'ACTIVE',
}

export const TENANT_PROVISIONING_STATES = [
  TenantProvisioningState.PENDING,
  TenantProvisioningState.TENANT_CREATED,
  TenantProvisioningState.SCHEMA_CREATED,
  TenantProvisioningState.MIGRATED,
  TenantProvisioningState.SEEDED,
  TenantProvisioningState.SUBSCRIPTION_ASSIGNED,
  TenantProvisioningState.OWNER_CREATED,
  TenantProvisioningState.ACTIVE,
] as const;

export const provisioningStateIndex = (
  state: TenantProvisioningState,
): number => TENANT_PROVISIONING_STATES.indexOf(state);

export const hasReachedProvisioningState = (
  current: TenantProvisioningState,
  target: TenantProvisioningState,
): boolean => provisioningStateIndex(current) >= provisioningStateIndex(target);

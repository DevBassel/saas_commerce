export type TenantOwnerRole = {
  key: string;
  name: string;
};

export type TenantPermission = {
  key: string;
  name: string;
};

export type TenantOwner = {
  id: number;
  name: string;
  email: string;
  role: TenantOwnerRole | null;
  permissions: TenantPermission[];
};

export type Tenant = {
  id: number;
  name: string;
  slug: string;
  schemaName: string;
  subdomain: string | null;
  status: string;
  ownerUserId: number | null;
  owner?: TenantOwner | null;
  storageUsedBytes: string;
  storageCapacityBytes: string;
  createdAt: string;
  updatedAt: string;
};

export type TenantOwnerRole = {
  key: string;
  name: string;
};

export type TenantOwner = {
  id: number;
  name: string;
  email: string;
  role: TenantOwnerRole | null;
  permissions: string[];
};

export type TenantStorage = {
  usedKb: number;
  capacityKb: number;
};

export type Tenant = {
  id: number;
  name: string;
  slug: string;
  schemaName: string;
  subdomain: string | null;
  status: string;
  ownerUserId: number | null;
  owner: TenantOwner | null;
  storage: TenantStorage | null;
  createdAt: string;
  updatedAt: string;
};

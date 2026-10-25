export interface StorefrontCategoryOption {
  id: number;
  name: string;
}

export interface SerializedCategory {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

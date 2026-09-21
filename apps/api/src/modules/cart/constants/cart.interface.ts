export interface SerializedCartItem {
  productId: number;
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  isActive: boolean;
  isAvailable: boolean;
  availableStock: number;
  imageUrl: string | null;
}

export interface SerializedCart {
  id: number | null;
  userId: number;
  items: SerializedCartItem[];
  subtotal: number;
  totalItems: number;
  totalQuantity: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface SerializedAddress {
  id: number;
  userId: number;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  country: string;
  label: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

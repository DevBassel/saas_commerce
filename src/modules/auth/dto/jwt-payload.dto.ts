export interface JwtPayload {
  type: 'access' | 'refresh';
  id: number;
  role: string;
  tenantId: number | null;
  tenantSchema: string | null;
}

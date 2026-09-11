export interface JwtPayload {
  type: 'access' | 'refresh';
  id: number;
  role: string;
  jti?: string;
  tenantId: number | null;
  tenantSchema: string | null;
}

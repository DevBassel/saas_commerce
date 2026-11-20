export interface JwtPayload {
  type: 'access' | 'refresh';
  id: number;
  role: string;
  jti?: string;
  tokenVersion?: number;
  tenantId: number | null;
  tenantSchema: string | null;
}

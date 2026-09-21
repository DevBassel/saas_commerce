import { JwtPayload } from './dto/jwt-payload.dto';

export interface TenantIdentity {
  id: number;
  schemaName: string;
}

export const tenantRefFromPayload = (
  payload: JwtPayload,
): TenantIdentity | undefined => {
  if (!payload.tenantId || !payload.tenantSchema) return undefined;
  return { id: payload.tenantId, schemaName: payload.tenantSchema };
};

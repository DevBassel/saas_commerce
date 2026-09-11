import { JwtPayload } from './dto/jwt-payload.dto';

export interface TenantRef {
  id: number;
  schemaName: string;
}

export const tenantRefFromPayload = (
  payload: JwtPayload,
): TenantRef | undefined => {
  if (!payload.tenantId || !payload.tenantSchema) return undefined;
  return { id: payload.tenantId, schemaName: payload.tenantSchema };
};

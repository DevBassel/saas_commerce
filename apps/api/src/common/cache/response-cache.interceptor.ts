import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PinoLogger } from 'nestjs-pino';
import {
  Observable,
  catchError,
  from,
  lastValueFrom,
  map,
  tap,
  throwError,
} from 'rxjs';
import { IS_PUBLIC } from '../../modules/auth/decorators/isPublic.decorator';
import { getTenantContext } from '../../modules/auth/tenant-context';
import { CACHEABLE_ROUTES, CACHE_POLICIES } from './cache-policy';
import {
  CACHE_RESPONSE,
  CacheResponseMetadata,
} from './cache-response.decorator';
import { CacheResolveResult } from './cache.types';
import { TenantCacheService } from './tenant-cache.service';
import { getRouteTemplate } from '../http/route-template';

const NO_STORE = 'private, no-store';
const PUBLIC_NO_STORE = 'public, no-store';

@Injectable()
export class ResponseCacheInterceptor implements NestInterceptor {
  private readonly warnedRoutes = new Set<string>();

  constructor(
    private readonly reflector: Reflector,
    private readonly cache: TenantCacheService,
    private readonly logger: PinoLogger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<
      Record<string, unknown> & {
        tenant?: { schemaName?: string };
        params?: Record<string, unknown>;
        query?: Record<string, unknown>;
        method?: string;
      }
    >();
    const res = http.getResponse<Record<string, unknown>>();
    const route = getRouteTemplate(context);
    const metadata = this.reflector.getAllAndOverride<CacheResponseMetadata>(
      CACHE_RESPONSE,
      [context.getHandler(), context.getClass()],
    );

    if (!metadata) {
      return this.bypass(next, res);
    }

    const policyDefinition = CACHE_POLICIES[metadata.policy];
    const approved =
      CACHEABLE_ROUTES.has(route.key) &&
      policyDefinition !== undefined &&
      policyDefinition.scope === metadata.scope;

    if (!approved) {
      this.warnOnce(
        route.key,
        { route: route.key, cachePolicy: metadata.policy },
        'cache.metadata_not_allowed',
      );
      return this.bypass(next, res, true);
    }

    const schemaName =
      metadata.scope === 'tenant'
        ? (req.tenant?.schemaName ?? getTenantContext()?.tenantSchema)
        : undefined;

    if (metadata.scope === 'tenant' && !schemaName) {
      this.warnOnce(
        route.key,
        { route: route.key },
        'cache.missing_tenant_context',
      );
      return this.bypass(next, res, true);
    }

    const fingerprint = this.cache.fingerprint({
      method: typeof req.method === 'string' ? req.method : 'GET',
      route: route.key,
      params: req.params,
      query: req.query,
    });

    if (!fingerprint) {
      return this.bypass(next, res, true);
    }

    const startedAt = Date.now();
    return from(
      this.cache.resolve(
        metadata.scope,
        schemaName,
        metadata.policy,
        fingerprint,
        () => lastValueFrom(next.handle()) as Promise<unknown>,
      ),
    ).pipe(
      tap((result) => {
        this.applyHeaders(context, res, result, metadata.scope);
        this.logger.debug(
          {
            route: route.key,
            namespace: result.namespace,
            cacheStatus: result.status,
            durationMs: Date.now() - startedAt,
            ttlMs: result.ttlMs,
            sizeBytes: result.sizeBytes,
            tenant: this.cache.hashTenant(schemaName),
          },
          'cache.decision',
        );
      }),
      map((result) => result.value),
      catchError((error: unknown) => {
        this.forceNoStore(res);
        return throwError(() => error);
      }),
    );
  }

  private bypass(
    next: CallHandler,
    res: Record<string, unknown>,
    count = false,
  ): Observable<unknown> {
    if (count) this.cache.recordBypass();
    return next.handle().pipe(
      tap({
        next: () => this.forceNoStore(res),
        error: () => this.forceNoStore(res),
      }),
    );
  }

  private applyHeaders(
    context: ExecutionContext,
    res: Record<string, unknown>,
    result: CacheResolveResult<unknown>,
    scope: 'tenant' | 'platform',
  ): void {
    if (result.status === 'bypass') {
      this.forceNoStore(res);
      return;
    }

    const isPublic =
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ]) === true;

    this.setHeader(res, 'Cache-Control', isPublic ? PUBLIC_NO_STORE : NO_STORE);
    this.setHeader(res, 'X-Cache', result.status.toUpperCase());
    if (scope === 'tenant') {
      this.setHeader(res, 'Vary', 'Host, x-tenant-id, x-tenant-slug');
    }
  }

  private forceNoStore(res: Record<string, unknown>): void {
    this.setHeader(res, 'Cache-Control', NO_STORE);
    this.setHeader(res, 'X-Cache', 'BYPASS');
  }

  private setHeader(
    res: Record<string, unknown>,
    name: string,
    value: string,
  ): void {
    const setHeader = res.setHeader;
    const header = res.header;
    if (typeof setHeader === 'function') {
      (setHeader as (name: string, value: string) => void).call(
        res,
        name,
        value,
      );
    } else if (typeof header === 'function') {
      (header as (name: string, value: string) => void).call(res, name, value);
    }
  }

  private warnOnce(
    key: string,
    fields: Record<string, unknown>,
    message: string,
  ): void {
    if (this.warnedRoutes.has(key)) return;
    this.warnedRoutes.add(key);
    this.logger.warn(fields, message);
  }
}

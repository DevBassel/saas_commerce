import { FindOptionsOrder } from 'typeorm';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  SortOrderValue,
} from './pagination.dto';

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginationInput {
  page?: number;
  limit?: number;
}

export interface ResolvedPagination {
  page: number;
  limit: number;
  skip: number;
  take: number;
}

export interface SortFallback<T> {
  field: keyof T;
  order: SortOrderValue;
}

/**
 * True when the caller asked for an explicit page/limit. Used by list
 * endpoints that must keep serving a legacy plain array to existing consumers
 * (for example the public storefront) while returning a paginated envelope to
 * clients that opt in.
 */
export const isPaginatedQuery = (query: PaginationInput = {}): boolean =>
  query.page != null || query.limit != null;

export const resolvePage = (page?: number): number =>
  page == null || !Number.isFinite(page)
    ? DEFAULT_PAGE
    : Math.max(Math.floor(page), 1);

export const clampLimit = (
  limit?: number,
  max = MAX_LIMIT,
  fallback = DEFAULT_LIMIT,
): number => {
  if (limit == null || !Number.isFinite(limit)) return fallback;
  return Math.min(Math.max(Math.floor(limit), 1), max);
};

export const resolvePagination = ({
  page,
  limit,
}: PaginationInput = {}): ResolvedPagination => {
  const safePage = resolvePage(page);
  const safeLimit = clampLimit(limit);
  return {
    page: safePage,
    limit: safeLimit,
    skip: (safePage - 1) * safeLimit,
    take: safeLimit,
  };
};

/**
 * Resolves a client sort request against an allowlist so arbitrary column
 * names never reach TypeORM. Unknown fields fall back to `fallback.field`; an
 * invalid/missing direction falls back to `fallback.order`.
 */
export const resolveSort = <T>(
  sortBy: string | undefined,
  sortOrder: SortOrderValue | undefined,
  allowed: readonly (keyof T)[],
  fallback: SortFallback<T>,
): FindOptionsOrder<T> => {
  const field =
    sortBy && (allowed as readonly string[]).includes(sortBy)
      ? (sortBy as keyof T)
      : fallback.field;
  const order: SortOrderValue =
    sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : fallback.order;
  return { [field]: order === 'asc' ? 'ASC' : 'DESC' } as FindOptionsOrder<T>;
};

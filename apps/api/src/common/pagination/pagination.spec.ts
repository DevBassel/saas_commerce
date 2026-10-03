import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  PaginationQueryDto,
} from './pagination.dto';
import {
  clampLimit,
  isPaginatedQuery,
  resolvePage,
  resolvePagination,
  resolveSort,
} from './pagination';

type Row = { id: number; createdAt: Date; code: string };
const ALLOWED: readonly (keyof Row)[] = ['id', 'createdAt', 'code'];
const FALLBACK = { field: 'createdAt' as const, order: 'desc' as const };

describe('pagination utils', () => {
  it('defaults page and limit', () => {
    expect(resolvePagination({})).toEqual({
      page: 1,
      limit: DEFAULT_LIMIT,
      skip: 0,
      take: DEFAULT_LIMIT,
    });
  });

  it('clamps the limit to the configured maximum', () => {
    expect(clampLimit(MAX_LIMIT + 1)).toBe(MAX_LIMIT);
    expect(resolvePagination({ page: 2, limit: 500 })).toEqual({
      page: 2,
      limit: MAX_LIMIT,
      skip: MAX_LIMIT,
      take: MAX_LIMIT,
    });
  });

  it('floors and lowers non-positive page and limit values', () => {
    expect(resolvePage(0)).toBe(1);
    expect(resolvePage(-3)).toBe(1);
    expect(clampLimit(0)).toBe(1);
  });

  it('falls back on non-finite input', () => {
    expect(clampLimit(Number.NaN)).toBe(DEFAULT_LIMIT);
    expect(resolvePage(undefined)).toBe(DEFAULT_PAGE);
  });

  it('resolves a whitelisted sort field and direction', () => {
    expect(resolveSort<Row>('code', 'asc', ALLOWED, FALLBACK)).toEqual({
      code: 'ASC',
    });
  });

  it('ignores a non-whitelisted sort field', () => {
    expect(resolveSort<Row>('password', 'desc', ALLOWED, FALLBACK)).toEqual({
      createdAt: 'DESC',
    });
  });

  it('detects an explicit pagination request', () => {
    expect(isPaginatedQuery({})).toBe(false);
    expect(isPaginatedQuery({ page: undefined, limit: undefined })).toBe(false);
    expect(isPaginatedQuery({ page: 1 })).toBe(true);
    expect(isPaginatedQuery({ limit: 10 })).toBe(true);
  });
});

describe('PaginationQueryDto', () => {
  const toDto = (value: Record<string, unknown>) =>
    plainToInstance(PaginationQueryDto, value);

  it('coerces numeric query strings', async () => {
    const dto = toDto({ page: '2', limit: '20' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(20);
  });

  it('rejects a non-numeric limit', async () => {
    const errors = await validate(toDto({ limit: 'abc' }));
    expect(errors.length).toBeGreaterThan(0);
  });

  it('normalizes the sort order case', async () => {
    const dto = toDto({ sortOrder: 'DESC' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.sortOrder).toBe('desc');
  });

  it('rejects an invalid sort order', async () => {
    const errors = await validate(toDto({ sortOrder: 'sideways' }));
    expect(errors.length).toBeGreaterThan(0);
  });
});

const PG_UNIQUE_VIOLATION = '23505';

/**
 * Detects a Postgres unique-constraint violation. TypeORM may surface the
 * driver code either at the top level or nested under `driverError`, so both
 * shapes are accepted.
 */
export const isUniqueViolation = (error: unknown): boolean => {
  const code =
    (error as { code?: string } | null)?.code ??
    (error as { driverError?: { code?: string } } | null)?.driverError?.code;
  return code === PG_UNIQUE_VIOLATION;
};

/**
 * Runs `operation` once; if it fails on a unique-constraint violation, runs it
 * one more time. Used to recover from races on composite/unique keys where the
 * alternative (SELECT-then-INSERT) is not atomic.
 */
export const withUniqueRetry = async <T>(
  operation: () => Promise<T>,
): Promise<T> => {
  try {
    return await operation();
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return operation();
  }
};

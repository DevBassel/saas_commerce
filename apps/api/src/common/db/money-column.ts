import { ColumnOptions } from 'typeorm';

/**
 * Column options for a `numeric(10,2)` money column, with a transformer that
 * maps the Postgres string representation to a JS number in both directions.
 *
 * Spread into `@Column`: `@Column(moneyColumn)`.
 */
export const moneyColumn: ColumnOptions = {
  type: 'numeric',
  precision: 10,
  scale: 2,
  transformer: {
    from: (value: string | null): number | null =>
      value === null ? null : Number(value),
    to: (value: number | null): number | null => value,
  },
};

/** Same as {@link moneyColumn} but with a database default (e.g. counts/refunds). */
export const moneyColumnWithDefault = (
  defaultValue: number,
): ColumnOptions => ({
  ...moneyColumn,
  default: defaultValue,
});

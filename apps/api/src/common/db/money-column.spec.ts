import { moneyColumn, moneyColumnWithDefault } from './money-column';

describe('moneyColumn', () => {
  it('is a numeric(10,2) column', () => {
    expect(moneyColumn.type).toBe('numeric');
    expect(moneyColumn.precision).toBe(10);
    expect(moneyColumn.scale).toBe(2);
  });

  it('parses the Postgres string into a number', () => {
    const transformer = moneyColumn.transformer as {
      from: (value: string | null) => number | null;
      to: (value: number | null) => number | null;
    };

    expect(transformer.from('19.99')).toBe(19.99);
    expect(transformer.from('0.00')).toBe(0);
    expect(transformer.from(null)).toBeNull();
  });

  it('passes numbers through in both directions', () => {
    const transformer = moneyColumn.transformer as {
      from: (value: string | null) => number | null;
      to: (value: number | null) => number | null;
    };

    expect(transformer.to(12.34)).toBe(12.34);
    expect(transformer.to(null)).toBeNull();
  });
});

describe('moneyColumnWithDefault', () => {
  it('keeps the money column shape and adds a default', () => {
    const column = moneyColumnWithDefault(0);

    expect(column.type).toBe('numeric');
    expect(column.precision).toBe(10);
    expect(column.scale).toBe(2);
    expect(column.default).toBe(0);
    expect(column.transformer).toBe(moneyColumn.transformer);
  });

  it('supports a non-zero default', () => {
    expect(moneyColumnWithDefault(5).default).toBe(5);
  });
});

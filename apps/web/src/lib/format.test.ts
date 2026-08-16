import { describe, expect, it } from 'vitest';
import { formatPrice, parsePriceToCents } from './format';

describe('formatPrice', () => {
  it('renders cents as dollars', () => {
    expect(formatPrice(25000)).toBe('$250.00');
    expect(formatPrice(1)).toBe('$0.01');
  });
});

describe('parsePriceToCents', () => {
  it('accepts whole dollars and up to two decimals', () => {
    expect(parsePriceToCents('45')).toBe(4500);
    expect(parsePriceToCents('45.00')).toBe(4500);
    expect(parsePriceToCents('45.5')).toBe(4550);
    expect(parsePriceToCents('0.01')).toBe(1);
    expect(parsePriceToCents(' 45 ')).toBe(4500);
  });

  it('rejects anything that is not a positive amount', () => {
    expect(parsePriceToCents('')).toBeNull();
    expect(parsePriceToCents('abc')).toBeNull();
    expect(parsePriceToCents('-5')).toBeNull();
    expect(parsePriceToCents('0')).toBeNull();
    expect(parsePriceToCents('0.00')).toBeNull();
    expect(parsePriceToCents('45.005')).toBeNull();
    expect(parsePriceToCents('$45')).toBeNull();
    expect(parsePriceToCents('1e3')).toBeNull();
  });

  it('does not accumulate float error', () => {
    expect(parsePriceToCents('19.99')).toBe(1999);
    expect(parsePriceToCents('1.10')).toBe(110);
  });
});

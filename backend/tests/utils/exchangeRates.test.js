import { describe, it, expect, vi, beforeEach } from 'vitest';
import fxModule from '../../src/utils/exchangeRates.js';

const { convertMinor, getRates, STATIC_RATES } = fxModule;

describe('convertMinor', () => {
  const rates = { USD: 1, EUR: 0.92, GBP: 0.79, INR: 83 };

  it('returns the amount unchanged when currencies match', () => {
    expect(convertMinor(12345, 'USD', 'USD', rates)).toBe(12345);
  });

  it('converts from USD to another currency', () => {
    // 100.00 USD at 83 INR/USD = 8300.00 INR
    expect(convertMinor(10000, 'USD', 'INR', rates)).toBe(830000);
  });

  it('converts back to USD', () => {
    expect(convertMinor(830000, 'INR', 'USD', rates)).toBe(10000);
  });

  it('converts between two non-USD currencies via USD', () => {
    // 92.00 EUR -> 100.00 USD -> 8300.00 INR
    expect(convertMinor(9200, 'EUR', 'INR', rates)).toBe(830000);
  });

  it('round-trips within a cent', () => {
    const original = 123456;
    const converted = convertMinor(original, 'USD', 'EUR', rates);
    const back = convertMinor(converted, 'EUR', 'USD', rates);

    expect(Math.abs(back - original)).toBeLessThanOrEqual(1);
  });

  it('always returns whole cents', () => {
    const result = convertMinor(33333, 'USD', 'EUR', rates);

    expect(Number.isInteger(result)).toBe(true);
  });

  it('returns null for an unknown source currency so callers can fall back', () => {
    expect(convertMinor(1000, 'XYZ', 'USD', rates)).toBeNull();
  });

  it('returns null for an unknown target currency', () => {
    expect(convertMinor(1000, 'USD', 'XYZ', rates)).toBeNull();
  });

  it('returns null when the rate table is missing', () => {
    expect(convertMinor(1000, 'USD', 'INR', undefined)).toBeNull();
  });

  it('treats a non-numeric amount as zero rather than NaN', () => {
    expect(convertMinor('abc', 'USD', 'INR', rates)).toBe(0);
  });

  it('handles zero', () => {
    expect(convertMinor(0, 'USD', 'INR', rates)).toBe(0);
  });
});

describe('STATIC_RATES', () => {
  it('is USD-based', () => {
    expect(STATIC_RATES.USD).toBe(1);
  });

  it('covers every currency the invoice editor offers', () => {
    ['USD', 'EUR', 'GBP', 'INR'].forEach((code) => {
      expect(STATIC_RATES[code]).toBeGreaterThan(0);
    });
  });
});

describe('getRates', () => {
  /**
   * The module caches rates in memory for hours, which is correct in production
   * but would leak state between tests. Re-importing gives each case a cold
   * cache so it exercises a real fetch.
   */
  async function freshGetRates() {
    vi.resetModules();
    const mod = await import('../../src/utils/exchangeRates.js');
    return (mod.default ?? mod).getRates;
  }

  beforeEach(() => {
    vi.useRealTimers();
  });

  it('uses live rates when the service responds correctly', async () => {
    globalThis.fetch = vi.fn(async () => ({
      json: async () => ({ result: 'success', rates: { USD: 1, INR: 90.5, EUR: 0.9 } }),
    }));
    const getRatesFresh = await freshGetRates();

    const result = await getRatesFresh();

    expect(result.live).toBe(true);
    expect(result.rates.INR).toBe(90.5);
  });

  it('caches rates instead of refetching on every call', async () => {
    const fetchSpy = vi.fn(async () => ({
      json: async () => ({ result: 'success', rates: { USD: 1, INR: 90.5 } }),
    }));
    globalThis.fetch = fetchSpy;
    const getRatesFresh = await freshGetRates();

    await getRatesFresh();
    await getRatesFresh();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('falls back to static rates when the rate service is unreachable', async () => {
    // The dashboard must still render if the FX provider is down.
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network down');
    });
    const getRatesFresh = await freshGetRates();

    const result = await getRatesFresh();

    expect(result.live).toBe(false);
    expect(result.rates.USD).toBe(1);
    expect(result.rates.INR).toBeGreaterThan(0);
  });

  it('falls back when the service returns an unexpected shape', async () => {
    globalThis.fetch = vi.fn(async () => ({ json: async () => ({ result: 'error' }) }));
    const getRatesFresh = await freshGetRates();

    const result = await getRatesFresh();

    expect(result.live).toBe(false);
    expect(result.rates).toEqual(STATIC_RATES);
  });

  it('never returns rates without a USD anchor', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('offline');
    });
    const getRatesFresh = await freshGetRates();

    const { rates } = await getRatesFresh();

    expect(rates.USD).toBe(1);
  });
});

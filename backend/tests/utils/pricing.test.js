import { describe, it, expect } from 'vitest';
import pricingModule from '../../src/utils/pricing.js';

const { computeTotals, computeItemTotal } = pricingModule;

/** 1 unit at the given price, as minor units (cents). */
const item = (unit_price, quantity = 1) => ({ quantity, unit_price });

describe('computeTotals', () => {
  describe('subtotal', () => {
    it('multiplies quantity by unit price across items', () => {
      const totals = computeTotals({ items: [item(250000, 2), item(100000, 3)] });

      expect(totals.subtotal).toBe(800000); // 5000.00 + 3000.00
      expect(totals.totalAmount).toBe(800000);
    });

    it('returns zero for no items', () => {
      const totals = computeTotals({ items: [] });

      expect(totals.subtotal).toBe(0);
      expect(totals.totalAmount).toBe(0);
    });

    it('coerces numeric strings, as they arrive from JSON payloads', () => {
      const totals = computeTotals({ items: [{ quantity: '2', unit_price: '150' }] });

      expect(totals.subtotal).toBe(300);
    });

    it('treats missing or non-numeric fields as zero rather than NaN', () => {
      const totals = computeTotals({ items: [{}, { quantity: 'abc', unit_price: 'xyz' }] });

      expect(totals.subtotal).toBe(0);
      expect(Number.isNaN(totals.subtotal)).toBe(false);
    });
  });

  describe('discount', () => {
    it('applies a percentage discount', () => {
      const totals = computeTotals({
        items: [item(100000)],
        discountType: 'PERCENTAGE',
        discountValue: 10,
      });

      expect(totals.discountAmount).toBe(10000);
      expect(totals.totalAmount).toBe(90000);
    });

    it('applies a fixed discount in minor units', () => {
      const totals = computeTotals({
        items: [item(100000)],
        discountType: 'FIXED',
        discountValue: 25000,
      });

      expect(totals.discountAmount).toBe(25000);
      expect(totals.totalAmount).toBe(75000);
    });

    it('ignores the discount value when the type is NONE', () => {
      const totals = computeTotals({
        items: [item(100000)],
        discountType: 'NONE',
        discountValue: 50000,
      });

      expect(totals.discountAmount).toBe(0);
      expect(totals.totalAmount).toBe(100000);
    });

    it('caps the discount at the subtotal so a total can never go negative', () => {
      const totals = computeTotals({
        items: [item(50000)],
        discountType: 'FIXED',
        discountValue: 999999,
      });

      expect(totals.discountAmount).toBe(50000);
      expect(totals.totalAmount).toBe(0);
    });

    it('clamps a negative discount to zero', () => {
      const totals = computeTotals({
        items: [item(100000)],
        discountType: 'FIXED',
        discountValue: -5000,
      });

      expect(totals.discountAmount).toBe(0);
      expect(totals.totalAmount).toBe(100000);
    });

    it('rounds a fractional percentage discount to whole cents', () => {
      // 1% of 1000.05 => 10.0005 -> 1000 cents
      const totals = computeTotals({
        items: [item(100005)],
        discountType: 'PERCENTAGE',
        discountValue: 1,
      });

      expect(Number.isInteger(totals.discountAmount)).toBe(true);
      expect(totals.discountAmount).toBe(1000);
    });
  });

  describe('tax', () => {
    it('applies tax to the discounted subtotal, not the gross subtotal', () => {
      // 1000.00 - 10% = 900.00, then 18% GST = 162.00 => total 1062.00
      const totals = computeTotals({
        items: [item(100000)],
        discountType: 'PERCENTAGE',
        discountValue: 10,
        taxType: 'GST',
        taxRate: 18,
      });

      expect(totals.taxAmount).toBe(16200);
      expect(totals.totalAmount).toBe(106200);
    });

    it('charges no tax when the type is NONE, even with a rate present', () => {
      const totals = computeTotals({
        items: [item(100000)],
        taxType: 'NONE',
        taxRate: 18,
      });

      expect(totals.taxAmount).toBe(0);
    });

    it.each(['GST', 'VAT', 'SALES', 'CUSTOM'])('applies %s tax', (taxType) => {
      const totals = computeTotals({ items: [item(100000)], taxType, taxRate: 10 });

      expect(totals.taxAmount).toBe(10000);
    });

    it('rounds tax to whole cents', () => {
      // 7.5% of 333.33 = 24.99975 -> 2500 cents
      const totals = computeTotals({
        items: [item(33333)],
        taxType: 'GST',
        taxRate: 7.5,
      });

      expect(Number.isInteger(totals.taxAmount)).toBe(true);
      expect(totals.taxAmount).toBe(2500);
    });

    it('clamps a negative tax rate to zero tax', () => {
      const totals = computeTotals({ items: [item(100000)], taxType: 'GST', taxRate: -5 });

      expect(totals.taxAmount).toBe(0);
    });
  });

  describe('shipping, handling and rounding', () => {
    it('adds shipping and handling after tax', () => {
      const totals = computeTotals({
        items: [item(100000)],
        shippingAmount: 5000,
        handlingAmount: 2500,
      });

      expect(totals.shippingAmount).toBe(5000);
      expect(totals.handlingAmount).toBe(2500);
      expect(totals.totalAmount).toBe(107500);
    });

    it('clamps negative shipping and handling to zero', () => {
      const totals = computeTotals({
        items: [item(100000)],
        shippingAmount: -100,
        handlingAmount: -200,
      });

      expect(totals.shippingAmount).toBe(0);
      expect(totals.handlingAmount).toBe(0);
      expect(totals.totalAmount).toBe(100000);
    });

    it('allows a negative round-off adjustment', () => {
      const totals = computeTotals({ items: [item(100050)], roundOff: -50 });

      expect(totals.roundOff).toBe(-50);
      expect(totals.totalAmount).toBe(100000);
    });

    it('never returns a negative total, even with a large negative round-off', () => {
      const totals = computeTotals({ items: [item(1000)], roundOff: -999999 });

      expect(totals.totalAmount).toBe(0);
    });
  });

  describe('full invoice', () => {
    it('composes every component in the correct order', () => {
      // subtotal 3000.00, -10% = 2700.00, +18% tax = 3186.00, +150 ship, +50 handling
      const totals = computeTotals({
        items: [item(100000, 2), item(100000, 1)],
        discountType: 'PERCENTAGE',
        discountValue: 10,
        taxType: 'GST',
        taxRate: 18,
        shippingAmount: 15000,
        handlingAmount: 5000,
      });

      expect(totals).toEqual({
        subtotal: 300000,
        discountAmount: 30000,
        taxAmount: 48600,
        shippingAmount: 15000,
        handlingAmount: 5000,
        roundOff: 0,
        totalAmount: 338600,
      });
    });

    it('returns integer cents for every monetary field', () => {
      const totals = computeTotals({
        items: [item(33333, 3)],
        discountType: 'PERCENTAGE',
        discountValue: 7.5,
        taxType: 'VAT',
        taxRate: 12.5,
      });

      Object.values(totals).forEach((value) => {
        expect(Number.isInteger(value)).toBe(true);
      });
    });

    it('handles a very large invoice without precision loss', () => {
      // 1000 line items at 9,999.99 each
      const items = Array.from({ length: 1000 }, () => item(999999));

      const totals = computeTotals({ items, taxType: 'GST', taxRate: 18 });

      expect(totals.subtotal).toBe(999999000);
      expect(totals.taxAmount).toBe(179999820);
      expect(totals.totalAmount).toBe(1179998820);
      expect(Number.isSafeInteger(totals.totalAmount)).toBe(true);
    });

    it('is a pure function — repeated calls give identical results', () => {
      const input = {
        items: [item(12345, 2)],
        discountType: 'PERCENTAGE',
        discountValue: 5,
        taxType: 'GST',
        taxRate: 18,
      };

      expect(computeTotals(input)).toEqual(computeTotals(input));
    });

    it('does not mutate the input', () => {
      const input = { items: [item(100000)], taxType: 'GST', taxRate: 18 };
      const snapshot = JSON.parse(JSON.stringify(input));

      computeTotals(input);

      expect(input).toEqual(snapshot);
    });
  });
});

describe('computeItemTotal', () => {
  it('multiplies quantity by unit price', () => {
    expect(computeItemTotal({ quantity: 3, unit_price: 1000 })).toBe(3000);
  });

  it('subtracts a line-level discount and adds line-level tax', () => {
    expect(computeItemTotal({ quantity: 2, unit_price: 1000, discount: 500, tax: 100 })).toBe(1600);
  });

  it('never returns a negative line total', () => {
    expect(computeItemTotal({ quantity: 1, unit_price: 1000, discount: 99999 })).toBe(0);
  });

  it('treats a zero quantity as a zero line total', () => {
    expect(computeItemTotal({ quantity: 0, unit_price: 50000 })).toBe(0);
  });
});

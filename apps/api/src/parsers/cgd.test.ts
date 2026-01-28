import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEuropeanDecimal, parseCGDPDF } from './cgd.js';

describe('parseEuropeanDecimal', () => {
  it('should parse standard European decimal format', () => {
    expect(parseEuropeanDecimal('1.234,56')).toBe(1234.56);
  });

  it('should parse decimal without thousand separators', () => {
    expect(parseEuropeanDecimal('234,56')).toBe(234.56);
  });

  it('should parse negative values', () => {
    expect(parseEuropeanDecimal('-250,75')).toBe(-250.75);
  });

  it('should parse negative values with thousands', () => {
    expect(parseEuropeanDecimal('-2.000,00')).toBe(-2000);
  });

  it('should parse small negative values', () => {
    expect(parseEuropeanDecimal('-0,18')).toBe(-0.18);
  });

  it('should handle empty string', () => {
    expect(parseEuropeanDecimal('')).toBe(0);
  });

  it('should handle whitespace-only string', () => {
    expect(parseEuropeanDecimal('   ')).toBe(0);
  });

  it('should handle null-like values', () => {
    // @ts-expect-error testing runtime behavior
    expect(parseEuropeanDecimal(null)).toBe(0);
    // @ts-expect-error testing runtime behavior
    expect(parseEuropeanDecimal(undefined)).toBe(0);
  });
});

const pdfPath = resolve(__dirname, '../../../../data/202601.pdf');
const pdfExists = existsSync(pdfPath);

describe.skipIf(!pdfExists)('parseCGDPDF', () => {
  const pdfBuffer = pdfExists ? readFileSync(pdfPath) : Buffer.alloc(0);

  it('should return a ParseResult with a fileHash', async () => {
    const result = await parseCGDPDF(pdfBuffer);
    expect(result).toHaveProperty('transactions');
    expect(result).toHaveProperty('periodStart');
    expect(result).toHaveProperty('periodEnd');
    expect(result).toHaveProperty('fileHash');
    expect(result.fileHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should extract the statement period', async () => {
    const result = await parseCGDPDF(pdfBuffer);
    expect(result.periodStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.periodEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should parse transactions', async () => {
    const result = await parseCGDPDF(pdfBuffer);
    expect(result.transactions.length).toBeGreaterThan(0);
  });

  it('should correctly identify income transactions', async () => {
    const result = await parseCGDPDF(pdfBuffer);
    const incomes = result.transactions.filter((t) => t.isIncome);
    expect(incomes.length).toBeGreaterThan(0);

    // All amounts must be positive (Math.abs)
    for (const tx of result.transactions) {
      expect(tx.amount).toBeGreaterThan(0);
    }
  });

  it('should parse the first transaction correctly', async () => {
    const result = await parseCGDPDF(pdfBuffer);
    const first = result.transactions[0];
    expect(first.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(first.description).toBeTruthy();
    expect(first.amount).toBeGreaterThan(0);
    expect(typeof first.isIncome).toBe('boolean');
  });

  it('should parse the last transaction correctly', async () => {
    const result = await parseCGDPDF(pdfBuffer);
    const last = result.transactions[result.transactions.length - 1];
    expect(last.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(last.description).toBeTruthy();
    expect(last.amount).toBeGreaterThan(0);
  });

  it('should have balance values for all transactions', async () => {
    const result = await parseCGDPDF(pdfBuffer);
    for (const tx of result.transactions) {
      expect(tx.balance).toEqual(expect.any(Number));
    }
  });

  it('should set suggestedCategory fields to null', async () => {
    const result = await parseCGDPDF(pdfBuffer);
    for (const tx of result.transactions) {
      expect(tx.suggestedCategoryId).toBeNull();
      expect(tx.suggestedCategoryName).toBeNull();
    }
  });
});

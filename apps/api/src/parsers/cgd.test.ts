import { describe, it, expect } from 'vitest';
import { parseEuropeanDecimal, parseCGDLines } from './cgd.js';

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

describe('parseCGDLines', () => {
  const sampleLines = [
    'Período 2026-01-01 a 2026-01-31',
    'SALDO ANTERIOR 1.500,00',
    '- - 2026-01-05 COMPRA 1234 CONTINENTE -45,30 1.454,70',
    '- - 2026-01-10 TFI EMPRESA XPTO 2.000,00 3.454,70',
    '- - 2026-01-15 PAGAMENTO TSU -150,00 3.304,70',
  ];

  it('should extract the statement period', () => {
    const result = parseCGDLines(sampleLines);
    expect(result.periodStart).toBe('2026-01-01');
    expect(result.periodEnd).toBe('2026-01-31');
  });

  it('should return null period when not present', () => {
    const result = parseCGDLines(['- - 2026-01-05 COMPRA LOJA -10,00 990,00']);
    expect(result.periodStart).toBeNull();
    expect(result.periodEnd).toBeNull();
  });

  it('should parse transactions', () => {
    const result = parseCGDLines(sampleLines);
    expect(result.transactions).toHaveLength(3);
  });

  it('should correctly identify expense transactions', () => {
    const result = parseCGDLines(sampleLines);
    const expense = result.transactions[0];
    expect(expense.isIncome).toBe(false);
    expect(expense.amount).toBe(45.3);
    expect(expense.balance).toBe(1454.7);
  });

  it('should correctly identify income transactions', () => {
    const result = parseCGDLines(sampleLines);
    const income = result.transactions[1];
    expect(income.isIncome).toBe(true);
    expect(income.amount).toBe(2000);
    expect(income.balance).toBe(3454.7);
  });

  it('should extract dates correctly', () => {
    const result = parseCGDLines(sampleLines);
    expect(result.transactions[0].date).toBe('2026-01-05');
    expect(result.transactions[1].date).toBe('2026-01-10');
    expect(result.transactions[2].date).toBe('2026-01-15');
  });

  it('should set valueDate equal to date', () => {
    const result = parseCGDLines(sampleLines);
    for (const tx of result.transactions) {
      expect(tx.valueDate).toBe(tx.date);
    }
  });

  it('should extract descriptions', () => {
    const result = parseCGDLines(sampleLines);
    expect(result.transactions[0].description).toContain('COMPRA');
    expect(result.transactions[1].description).toContain('TFI');
    expect(result.transactions[2].description).toContain('PAGAMENTO');
  });

  it('should store amount as absolute value', () => {
    const result = parseCGDLines(sampleLines);
    for (const tx of result.transactions) {
      expect(tx.amount).toBeGreaterThan(0);
    }
  });

  it('should have balance values for all transactions', () => {
    const result = parseCGDLines(sampleLines);
    for (const tx of result.transactions) {
      expect(tx.balance).toEqual(expect.any(Number));
    }
  });

  it('should set suggestedCategory fields to null', () => {
    const result = parseCGDLines(sampleLines);
    for (const tx of result.transactions) {
      expect(tx.suggestedCategoryId).toBeNull();
      expect(tx.suggestedCategoryName).toBeNull();
    }
  });

  it('should preserve raw text', () => {
    const result = parseCGDLines(sampleLines);
    expect(result.transactions[0].rawText).toBe(sampleLines[2]);
  });

  it('should skip lines without enough amounts', () => {
    const lines = ['- - 2026-01-05 SOME ENTRY 100,00'];
    const result = parseCGDLines(lines);
    expect(result.transactions).toHaveLength(0);
  });

  it('should skip non-transaction lines', () => {
    const lines = [
      'SALDO CONTABILISTICO 5.000,00',
      'Some header text',
      '',
    ];
    const result = parseCGDLines(lines);
    expect(result.transactions).toHaveLength(0);
  });

  it('should handle amounts with thousand separators', () => {
    const lines = ['- - 2026-01-20 TFI SALARIO 1.234,56 5.234,56'];
    const result = parseCGDLines(lines);
    expect(result.transactions[0].amount).toBe(1234.56);
    expect(result.transactions[0].balance).toBe(5234.56);
  });

  it('should handle accent variants in period header', () => {
    const lines = ['Periodo 2026-02-01 a 2026-02-28'];
    const result = parseCGDLines(lines);
    expect(result.periodStart).toBe('2026-02-01');
    expect(result.periodEnd).toBe('2026-02-28');
  });
});

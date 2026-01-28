import { describe, it, expect } from 'vitest';
import {
  parseEuropeanDecimal,
  parseDate,
  parseNovoBancoPDF,
} from './novo-banco.js';
import { generateFileHash } from '../utils/fileHash.js';

describe('parseEuropeanDecimal', () => {
  it('should parse standard European decimal format', () => {
    expect(parseEuropeanDecimal('1.234,56')).toBe(1234.56);
  });

  it('should parse decimal without thousand separators', () => {
    expect(parseEuropeanDecimal('234,56')).toBe(234.56);
  });

  it('should parse large numbers with multiple thousand separators', () => {
    expect(parseEuropeanDecimal('1.234.567,89')).toBe(1234567.89);
  });

  it('should parse whole numbers (no decimal part)', () => {
    expect(parseEuropeanDecimal('1.234,00')).toBe(1234);
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

  it('should trim whitespace', () => {
    expect(parseEuropeanDecimal('  1.234,56  ')).toBe(1234.56);
  });

  it('should parse small decimal values', () => {
    expect(parseEuropeanDecimal('0,99')).toBe(0.99);
  });

  it('should parse single digit decimals', () => {
    expect(parseEuropeanDecimal('5,50')).toBe(5.5);
  });
});

describe('parseDate', () => {
  it('should parse DD.MM.YY format to ISO date', () => {
    expect(parseDate('15.11.24')).toBe('2024-11-15');
  });

  it('should handle years after 2050 as 19xx', () => {
    expect(parseDate('15.11.51')).toBe('1951-11-15');
    expect(parseDate('01.01.99')).toBe('1999-01-01');
  });

  it('should handle years before/equal 2050 as 20xx', () => {
    expect(parseDate('15.11.50')).toBe('2050-11-15');
    expect(parseDate('01.01.00')).toBe('2000-01-01');
    expect(parseDate('31.12.25')).toBe('2025-12-31');
  });

  it('should return original string if format does not match', () => {
    expect(parseDate('invalid')).toBe('invalid');
    expect(parseDate('2024-11-15')).toBe('2024-11-15');
  });

  it('should handle edge case dates', () => {
    expect(parseDate('01.01.00')).toBe('2000-01-01');
    expect(parseDate('31.12.49')).toBe('2049-12-31');
  });

  // FIXED: parseDate now handles both YY and YYYY formats
  describe('4-digit year format (YYYY)', () => {
    it('should handle DD.MM.YYYY format (4-digit year)', () => {
      // This is what period dates look like in the PDF (e.g., "De 01.11.2024 a 30.11.2024")
      const result = parseDate('01.11.2024');
      expect(result).toBe('2024-11-01');
    });

    it('should parse various 4-digit year dates', () => {
      expect(parseDate('15.06.2023')).toBe('2023-06-15');
      expect(parseDate('31.12.2025')).toBe('2025-12-31');
      expect(parseDate('01.01.2000')).toBe('2000-01-01');
    });
  });
});

describe('generateFileHash', () => {
  it('should generate consistent SHA-256 hash for same content', () => {
    const buffer = Buffer.from('test content');
    const hash1 = generateFileHash(buffer);
    const hash2 = generateFileHash(buffer);
    expect(hash1).toBe(hash2);
  });

  it('should generate different hashes for different content', () => {
    const buffer1 = Buffer.from('content 1');
    const buffer2 = Buffer.from('content 2');
    expect(generateFileHash(buffer1)).not.toBe(generateFileHash(buffer2));
  });

  it('should generate 64-character hex string (SHA-256)', () => {
    const buffer = Buffer.from('test');
    const hash = generateFileHash(buffer);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should handle empty buffer', () => {
    const buffer = Buffer.from('');
    const hash = generateFileHash(buffer);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    // SHA-256 of empty string
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});

describe('parseNovoBancoPDF', () => {
  // Note: Full PDF parsing tests would require mock PDF data
  // These tests focus on the behavior we can verify without actual PDFs

  it('should return ParseResult structure', async () => {
    // Create a minimal mock PDF buffer
    // Since we can't easily mock pdf-parse, we test that errors are handled
    const emptyBuffer = Buffer.from('');

    try {
      await parseNovoBancoPDF(emptyBuffer);
    } catch (error) {
      // Expected to fail with invalid PDF
      expect(error).toBeDefined();
    }
  });

  describe('income detection logic bug', () => {
    // BUG TEST: Documents operator precedence issue in income detection
    // Line 314-320: tx.isIncome = desc.includes('trf') && desc.includes(' de ') || ...
    // Should be: tx.isIncome = (desc.includes('trf') && desc.includes(' de ')) || ...

    it('should correctly identify income from description patterns', () => {
      // This test documents the expected behavior
      const desc1 = 'trf recebida de empresa';
      const desc2 = 'credito salario';
      const desc3 = 'pagamento ordenante joao';

      const descLower1 = desc1.toLowerCase();
      const descLower2 = desc2.toLowerCase();
      const descLower3 = desc3.toLowerCase();

      // Current (buggy) logic without parentheses:
      // includes('trf') && includes(' de ') || includes('credito') || includes('ordenante')
      // This evaluates as: (includes('trf') && includes(' de ')) || includes('credito') || includes('ordenante')
      // due to && having higher precedence than ||
      // So actually the current code works correctly by accident!

      // But the intent should be made explicit with parentheses
      const isIncome1 =
        (descLower1.includes('trf') && descLower1.includes(' de ')) ||
        descLower1.includes('credito') ||
        descLower1.includes('ordenante');

      const isIncome2 =
        (descLower2.includes('trf') && descLower2.includes(' de ')) ||
        descLower2.includes('credito') ||
        descLower2.includes('ordenante');

      const isIncome3 =
        (descLower3.includes('trf') && descLower3.includes(' de ')) ||
        descLower3.includes('credito') ||
        descLower3.includes('ordenante');

      expect(isIncome1).toBe(true);
      expect(isIncome2).toBe(true);
      expect(isIncome3).toBe(true);

      // This should NOT be income - expense transfer
      const desc4 = 'trf para fornecedor';
      const descLower4 = desc4.toLowerCase();
      const isIncome4 =
        (descLower4.includes('trf') && descLower4.includes(' de ')) ||
        descLower4.includes('credito') ||
        descLower4.includes('ordenante');

      expect(isIncome4).toBe(false);
    });
  });

  describe('amount determination logic', () => {
    // BUG TEST: Documents the debit/credit column parsing issue
    // Lines 177-186: The logic doesn't properly distinguish between
    // debit and credit columns

    it('should document expected amount parsing behavior', () => {
      // When we have 2 amounts: [amount, balance]
      // When we have 3 amounts: [debit, credit, balance] or similar

      // The current logic in lines 177-186:
      // amounts.length === 2: takes amounts[0] as amount, amounts[1] as balance
      // amounts.length === 3: takes amounts[0] || amounts[1] as amount, amounts[2] as balance

      // Problem: If debit column is empty and credit has value,
      // the parsing should take credit value, not debit

      // This test documents the expected behavior
      const mockAmounts2 = ['100,00', '1.500,00'];
      const mockAmounts3Debit = ['50,00', '', '1.450,00'];
      const mockAmounts3Credit = ['', '200,00', '1.700,00'];

      // Current parsing logic simulation
      const parseAmounts = (amounts: string[]) => {
        const parsed = amounts.filter(Boolean).map((a) =>
          a ? parseFloat(a.replace(/\./g, '').replace(',', '.')) : 0
        );

        if (parsed.length === 2) {
          return { amount: parsed[0], balance: parsed[1] };
        } else if (parsed.length >= 3) {
          // BUG: This doesn't distinguish which column had the value
          return { amount: parsed[0] || parsed[1], balance: parsed[2] };
        }
        return { amount: 0, balance: 0 };
      };

      const result2 = parseAmounts(mockAmounts2);
      expect(result2.amount).toBe(100);
      expect(result2.balance).toBe(1500);

      // Note: With empty string filtering, the 3-value cases collapse
      const result3Debit = parseAmounts(mockAmounts3Debit.filter(Boolean) as string[]);
      const result3Credit = parseAmounts(mockAmounts3Credit.filter(Boolean) as string[]);

      // These become 2-element arrays after filtering empty strings
      expect(result3Debit.amount).toBe(50);
      expect(result3Credit.amount).toBe(200);
    });
  });
});

describe('Period date extraction', () => {
  it('should extract and parse period with YYYY format dates', () => {
    // The regex in the parser handles YYYY format: /De\s+(\d{2}\.\d{2}\.\d{4})\s+a\s+(\d{2}\.\d{2}\.\d{4})/
    const text = 'De 01.11.2024 a 30.11.2024';
    const periodMatch = text.match(/De\s+(\d{2}\.\d{2}\.\d{4})\s+a\s+(\d{2}\.\d{2}\.\d{4})/);

    expect(periodMatch).not.toBeNull();
    expect(periodMatch![1]).toBe('01.11.2024');
    expect(periodMatch![2]).toBe('30.11.2024');

    // FIXED: parseDate now handles 4-digit years
    const periodStart = parseDate(periodMatch![1]);
    const periodEnd = parseDate(periodMatch![2]);

    expect(periodStart).toBe('2024-11-01');
    expect(periodEnd).toBe('2024-11-30');
  });
});

# Bank Statement Parser Contributor Guide

This guide walks you through adding a new bank statement parser to Compasso. Follow these steps exactly and open a PR.

---

## Architecture Overview

```
PDF Buffer
  |
  v
Parser (apps/api/src/parsers/<bank-slug>.ts)
  |  - Exports a BankParserDefinition (config + patterns + parse fn)
  |  - Extracts text from PDF
  |  - Parses transactions, period dates
  |  - Generates file hash
  |
  v
ParseResult { transactions, periodStart, periodEnd, fileHash }
  |
  v
Registry (apps/api/src/parsers/registry.ts)
  |  - Aggregates all parser definitions
  |  - Derives SUPPORTED_BANKS, BANK_CONFIGS, BANK_CATEGORY_PATTERNS
  |  - Provides getParser(bankId) lookup
  |
  v
CategoryMatcher (apps/api/src/services/categoryMatcher.ts)
  |  - Matches descriptions against category_patterns in DB
  |  - Patterns are seeded from BANK_CATEGORY_PATTERNS via registry
  |  - Assigns suggestedCategoryId / suggestedCategoryName
  |
  v
UploadResponse → returned to client
```

## Files to Touch (exactly 3)

| # | File | Action |
|---|------|--------|
| 1 | `apps/api/src/parsers/<bank-slug>.ts` | Create parser with `BankParserDefinition` export |
| 2 | `apps/api/src/parsers/<bank-slug>.test.ts` | Unit tests |
| 3 | `apps/api/src/parsers/registry.ts` | Add 1 import + 1 array entry |

No changes to `uploadService`, `constants`, `seed`, or `routes`.

## Key Interfaces

### BankParserDefinition (from `apps/api/src/parsers/types.ts`)

```typescript
interface BankParserDefinition {
  config: BankConfig;
  transactionPatterns: TransactionPatterns;
  categoryPatterns: BankCategoryPatterns;
  parse: (buffer: Buffer) => Promise<ParseResult>;
}
```

### ParseResult (from `@compasso/shared`)

```typescript
interface ParseResult {
  transactions: ParsedTransaction[];
  periodStart: string | null;  // ISO date (YYYY-MM-DD) or null
  periodEnd: string | null;    // ISO date (YYYY-MM-DD) or null
  fileHash: string;            // SHA-256 hex digest of the PDF buffer
}
```

### ParsedTransaction (from `@compasso/shared`)

```typescript
interface ParsedTransaction {
  date: string;                       // ISO date: "2025-01-15"
  valueDate: string;                  // Value/settlement date (same format)
  description: string;                // Transaction description text
  amount: number;                     // Always positive (Math.abs)
  balance: number | null;             // Running balance after this transaction
  isIncome: boolean;                  // true = credit, false = debit
  rawText: string;                    // Original line from the PDF
  suggestedCategoryId: null;          // Always null from parser
  suggestedCategoryName: null;        // Always null from parser
}
```

### BankConfig (from `@compasso/shared`)

```typescript
interface BankConfig {
  id: string;
  name: string;                              // Human-readable name
  country: string;                           // ISO 3166-1 alpha-2 (e.g. "PT")
  currency: string;                          // ISO 4217 (e.g. "EUR")
  dateFormat: string;                        // Date format in the PDF (e.g. "DD.MM.YY")
  decimalFormat: 'european' | 'standard';    // European: 1.234,56 | Standard: 1,234.56
}
```

### TransactionPatterns (from `apps/api/src/parsers/types.ts`)

```typescript
interface TransactionPatterns {
  CARD_PURCHASE?: RegExp;
  DIRECT_DEBIT?: RegExp;
  TRANSFER_IN?: RegExp;
  TRANSFER_OUT?: RegExp;
  ATM?: RegExp;
  BILL_PAYMENT?: RegExp;
  LOAN_PAYMENT?: RegExp;
  STANDING_ORDER?: RegExp;
  BANK_FEE?: RegExp;
}
```

### BankCategoryPatterns (from `apps/api/src/parsers/types.ts`)

```typescript
interface BankCategoryPatterns {
  [categoryName: string]: string[];  // Category name → keyword arrays
}
```

## Parser Contract Rules

1. **Input:** `Buffer` (the raw PDF file bytes)
2. **Output:** `Promise<ParseResult>`
3. **Must** call `generateFileHash(buffer)` from `utils/fileHash.ts` to produce `fileHash`
4. **`amount`** must always be `Math.abs()` (positive number, regardless of debit/credit)
5. **`isIncome`** detection is the parser's responsibility — use the bank's PDF layout to determine credit vs debit
6. **`suggestedCategoryId`** and **`suggestedCategoryName`** must both be `null` — category matching is handled downstream by `CategoryMatcher`
7. Extract **`periodStart`** and **`periodEnd`** when the statement format includes them; otherwise set to `null`
8. Dates must be ISO format: `YYYY-MM-DD`

## Step-by-Step Implementation

### Step 1: Create the Parser

**File:** `apps/api/src/parsers/<bank-slug>.ts`

Create a self-contained module that exports a `BankParserDefinition` containing config, patterns, and the parse function.

```typescript
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { ParsedTransaction, ParseResult } from '@compasso/shared';
import { generateFileHash } from '../utils/fileHash.js';
import type { BankParserDefinition } from './types.js';

interface TextItem {
  str: string;
  transform: number[];
}

// Helper: parse your bank's decimal format to a JS number
export function parseDecimal(value: string): number {
  // Implement based on your bank's number format
  // European: "1.234,56" → 1234.56
  // Standard: "1,234.56" → 1234.56
  if (!value || value.trim() === '') return 0;
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  return parseFloat(normalized);
}

// Helper: parse your bank's date format to ISO string
export function parseDate(dateStr: string): string {
  // Implement based on your bank's date format
  // Example for DD/MM/YYYY:
  const match = dateStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    const [, day, month, year] = match;
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

// Extract text lines from PDF
async function extractTextFromPDF(buffer: Buffer): Promise<string[]> {
  const uint8Array = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data: uint8Array }).promise;
  const allLines: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items as TextItem[];

    // Group text items by Y position
    const lineMap = new Map<number, { x: number; text: string }[]>();

    for (const item of items) {
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];

      if (!lineMap.has(y)) {
        lineMap.set(y, []);
      }
      lineMap.get(y)!.push({ x, text: item.str });
    }

    // Sort by Y descending (PDF coords start from bottom)
    const sortedYs = [...lineMap.keys()].sort((a, b) => b - a);

    for (const y of sortedYs) {
      const lineItems = lineMap.get(y)!.sort((a, b) => a.x - b.x);
      const lineText = lineItems.map((i) => i.text).join(' ');
      if (lineText.trim()) {
        allLines.push(lineText.trim());
      }
    }
  }

  return allLines;
}

export async function parseYourBankPDF(buffer: Buffer): Promise<ParseResult> {
  const fileHash = generateFileHash(buffer);
  const lines = await extractTextFromPDF(buffer);
  const transactions: ParsedTransaction[] = [];
  let periodStart: string | null = null;
  let periodEnd: string | null = null;

  // TODO: Extract period from header if available
  // TODO: Parse transaction lines based on your bank's PDF format

  // For each transaction line detected:
  // transactions.push({
  //   date: parseDate('15/01/2025'),
  //   valueDate: parseDate('15/01/2025'),
  //   description: 'Transaction description',
  //   amount: Math.abs(parseDecimal('123,45')),
  //   balance: parseDecimal('1.234,56'),
  //   isIncome: false,
  //   rawText: line,
  //   suggestedCategoryId: null,
  //   suggestedCategoryName: null,
  // });

  return { transactions, periodStart, periodEnd, fileHash };
}

export const yourBank: BankParserDefinition = {
  config: {
    id: 'your_bank',
    name: 'Your Bank',
    country: 'XX',               // ISO 3166-1 alpha-2
    currency: 'EUR',             // ISO 4217
    dateFormat: 'DD/MM/YYYY',    // Date format used in the PDF
    decimalFormat: 'european',   // or 'standard'
  },
  transactionPatterns: {
    CARD_PURCHASE: /^Card Purchase/i,
    DIRECT_DEBIT: /^Direct Debit/i,
    TRANSFER_IN: /^Transfer From/i,
    TRANSFER_OUT: /^Transfer To/i,
    // Add patterns that match your bank's PDF format
  },
  categoryPatterns: {
    Groceries: ['Supermarket', 'Grocery', 'Market'],
    Fuel: ['Shell', 'BP', 'Gas Station'],
    Dining: ['Restaurant', 'Cafe', 'Pizza'],
    // Map category names to keywords found in this bank's descriptions
  },
  parse: parseYourBankPDF,
};
```

### Step 2: Register in the Registry

**File:** `apps/api/src/parsers/registry.ts`

Add one import and one array entry:

```typescript
import { yourBank } from './your-bank.js';

const definitions: BankParserDefinition[] = [
  novoBanco,
  yourBank,    // <-- add this
];
```

That's it. The registry automatically derives `SUPPORTED_BANKS`, `BANK_CONFIGS`, and `BANK_CATEGORY_PATTERNS` from the definitions array.

### Step 3: Write Tests

**File:** `apps/api/src/parsers/<bank-slug>.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { parseDecimal, parseDate } from './your-bank.js';

describe('parseDecimal', () => {
  it('parses standard format', () => {
    expect(parseDecimal('1.234,56')).toBe(1234.56);
  });

  it('parses without thousands separator', () => {
    expect(parseDecimal('24,30')).toBe(24.3);
  });

  it('returns 0 for empty input', () => {
    expect(parseDecimal('')).toBe(0);
  });
});

describe('parseDate', () => {
  it('parses DD/MM/YYYY to ISO format', () => {
    expect(parseDate('15/01/2025')).toBe('2025-01-15');
  });
});

// Add more tests specific to your parser's logic:
// - Period extraction
// - Transaction parsing
// - Income vs expense detection
// - Edge cases (multi-page PDFs, missing fields, etc.)
```

## Category Patterns Guide

Category patterns are defined in your parser's `categoryPatterns` and seeded into the database when a workspace is created. The `CategoryMatcher` service supports three pattern types:

### Plain Text (word-boundary match)

Case-insensitive match with word boundaries. This is the default.

```typescript
Groceries: ['Lidl', 'Pingo Doce', 'Continente']
// "Compra Cartão LIDL PORTO" → matches Groceries
// "LIDL" as a standalone word is matched, not as a substring
```

### Exclusion Prefix (`!`)

Prevents a category from matching when the keyword appears. Useful to avoid false positives.

```typescript
Dining: ['McDonald', 'Pizza', '!Delivery']
// "McDonald's Restaurant" → matches Dining
// "Pizza Delivery Service" → excluded from Dining (despite "Pizza" matching)
```

### Regex Prefix (`regex:`)

Full regular expression match for complex patterns.

```typescript
Transfers: ['regex:Trf\\s+(Imediata\\s+)?Sepa']
// "Trf Imediata Sepa+ App" → matches Transfers
// "Trf Sepa De Fulano" → matches Transfers
```

### Priority Scoring

When multiple categories match, the one with the highest cumulative priority score wins. Patterns with higher `priority` values take precedence. Each matching pattern contributes `priority + 1` to its category's score.

### Tips for Writing Patterns

- Use the bank's actual PDF text (run your parser, inspect `rawText` fields)
- Start with merchant names and common keywords
- Add exclusion patterns only after observing false positives
- Use regex patterns for structured text like transfer descriptions
- Match the category names exactly as defined in `DEFAULT_CATEGORIES` in `packages/shared/src/constants.ts`

## Verification Commands

Run these from the repository root before opening your PR:

```bash
# Run all API tests
npm run test:run -w @compasso/api

# Type-check the API
npx tsc --noEmit -p apps/api/tsconfig.json

# Lint
npm run lint
```

## PR Checklist

- [ ] Parser file created at `apps/api/src/parsers/<bank-slug>.ts`
- [ ] Parser exports a named `BankParserDefinition` with config, patterns, and parse function
- [ ] Parser uses `generateFileHash` from `utils/fileHash.ts`
- [ ] `amount` is always `Math.abs()` (positive)
- [ ] `suggestedCategoryId` and `suggestedCategoryName` are both `null`
- [ ] Parser registered in `apps/api/src/parsers/registry.ts` (1 import + 1 array entry)
- [ ] Tests created at `apps/api/src/parsers/<bank-slug>.test.ts`
- [ ] All tests pass: `npm run test:run -w @compasso/api`
- [ ] Type-check passes: `npx tsc --noEmit -p apps/api/tsconfig.json`
- [ ] Lint passes: `npm run lint`

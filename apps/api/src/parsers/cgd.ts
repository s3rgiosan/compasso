import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { ParsedTransaction, ParseResult } from '@compasso/shared';
import { generateFileHash } from '../utils/fileHash.js';
import type { BankParserDefinition } from './types.js';

/**
 * Parser for CGD (Caixa Geral de Depósitos, Portugal) PDF statements.
 *
 * Algorithm: extract text with pdfjs → group by Y-coordinate into lines →
 * match lines starting with ISO date (YYYY-MM-DD) → extract signed amounts
 * in European decimal format. Positive amounts = income, negative = expense.
 */

interface TextItem {
  str: string;
  transform: number[];
}

// Parse European decimal format (1.234,56 or -1.234,56) to standard decimal
export function parseEuropeanDecimal(value: string): number {
  if (!value || value.trim() === '') return 0;
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  return parseFloat(normalized);
}

// Extract text lines from PDF using pdfjs-dist
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

export async function parseCGDPDF(buffer: Buffer): Promise<ParseResult> {
  const fileHash = generateFileHash(buffer);
  const lines = await extractTextFromPDF(buffer);
  const text = lines.join('\n');

  const transactions: ParsedTransaction[] = [];
  let periodStart: string | null = null;
  let periodEnd: string | null = null;

  // Extract period: "Período YYYY-MM-DD a YYYY-MM-DD"
  const periodMatch = text.match(
    /Per[ií]odo\s+(\d{4}-\d{2}-\d{2})\s+a\s+(\d{4}-\d{2}-\d{2})/i,
  );
  if (periodMatch) {
    periodStart = periodMatch[1];
    periodEnd = periodMatch[2];
  }

  // European decimal with exactly 2 decimal places (optionally signed)
  const amountPattern = /-?[\d.]+,\d{2}/g;

  for (const line of lines) {
    // Transaction lines start with "- - YYYY-MM-DD" (dashes for mov/value date columns)
    const dateMatch = line.match(/^-\s+-\s+(\d{4}-\d{2}-\d{2})\s+/);
    if (!dateMatch) continue;

    const date = dateMatch[1];
    const valueDate = dateMatch[1];

    // Find all European decimal amounts in the line
    const amounts = [...line.matchAll(amountPattern)];
    if (amounts.length < 2) continue;

    // Last = balance, second-to-last = amount
    const amountMatch = amounts[amounts.length - 2];
    const balanceMatch = amounts[amounts.length - 1];

    const parsedAmount = parseEuropeanDecimal(amountMatch[0]);
    const balance = parseEuropeanDecimal(balanceMatch[0]);

    // Description is between value date end and amount start
    const descStart = dateMatch[0].length;
    const descEnd = amountMatch.index!;
    const description = line.slice(descStart, descEnd).replace(/\s+/g, ' ').trim();

    if (!description) continue;

    const isIncome = parsedAmount > 0;
    const amount = Math.abs(parsedAmount);

    transactions.push({
      date,
      valueDate,
      description,
      amount,
      balance,
      isIncome,
      rawText: line,
      suggestedCategoryId: null,
      suggestedCategoryName: null,
    });
  }

  return { transactions, periodStart, periodEnd, fileHash };
}

export const cgd: BankParserDefinition = {
  config: {
    id: 'cgd',
    name: 'CGD',
    country: 'PT',
    currency: 'EUR',
    dateFormat: 'YYYY-MM-DD',
    decimalFormat: 'european',
  },
  transactionPatterns: {
    CARD_PURCHASE: /^COMPRA\s+/i,
    DIRECT_DEBIT: /^MAPFRE|^MEO\s+SERV|^KUBOO/i,
    TRANSFER_IN: /^TFI\s+|^TRF\s+|^CREDIT\s+VOUCHER/i,
    TRANSFER_OUT: /^Trf\s+Mbway/i,
    BILL_PAYMENT: /^PAGAMENTO\s+TSU|^IRC$|^Multi\s+Imposto/i,
    STANDING_ORDER: /^ORD\s+/i,
    BANK_FEE: /^MANUT\s+CONTA|^IMPOSTO\s+SELO|^\d+[,.]\d+\s+COM\s+S[BI]/i,
  },
  categoryPatterns: {
    Groceries: ['Continente', 'Pingo Doce', 'Lidl', 'Aldi', 'Mercadona', 'Intermarche', 'Mini Preco'],
    Fuel: ['BP', 'Galp', 'Repsol', 'Cepsa', 'Disa', 'Petrogal'],
    Health: ['Hospital', 'Farmacia', 'Clinica', 'Dentista', 'Psicologi', 'Medis'],
    Fitness: ['Solinca', 'Decathlon', 'Ginasio', 'Fitness', 'Holmes Place'],
    Entertainment: ['Netflix', 'Spotify', 'Disney', 'HBO', 'Cinemas', 'Fnac'],
    Dining: ['McDonald', 'KFC', 'Burger', 'Pizza', 'Uber Eats', 'Restaurante', 'Cafe', 'Telepizza', 'H3', 'Poke House', 'Pans Company', 'Nashi Sushi'],
    Shopping: ['Amazon EU', 'Amazon Payments', 'Zara', 'Primark', 'Worten', 'IKEA'],
    Utilities: ['MEO SERV', 'NOS', 'Vodafone', 'EDP', 'Galp Energia', 'Agua', 'Digi Portugal'],
    Housing: ['Condominio', 'Renda', 'Hipoteca'],
    Insurance: ['Mapfre', 'Fidelidade', 'Allianz', 'Tranquilidade', 'Ageas', 'Seguro'],
    Transfers: ['Trf Mbway', 'regex:^TFI\\s+', 'regex:^TRF\\s+'],
    Fees: ['Manut Conta', 'Imposto Selo', 'regex:\\d+[,.]\\d+\\s+COM\\s+S[BI]'],
    Cash: ['Levantamento'],
  },
  parse: parseCGDPDF,
};

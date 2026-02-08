import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { ParsedTransaction, ParseResult } from '@compasso/shared';
import { generateFileHash } from '../utils/fileHash.js';
import type { BankParserDefinition } from './types.js';

/**
 * Parser for Novo Banco (Portugal) "Extrato Integrado" PDF statements.
 *
 * Algorithm: extract text with pdfjs → group by Y-coordinate into lines →
 * find "MOVIMENTOS DE CONTA" sections → parse transaction rows by detecting
 * date + amounts patterns. Uses European number format (1.234,56).
 */

interface TextItem {
  str: string;
  transform: number[];
}

// Parse European decimal format (1.234,56) to standard decimal
export function parseEuropeanDecimal(value: string): number {
  if (!value || value.trim() === '') return 0;
  // Remove thousand separators (dots) and replace decimal comma with dot
  const normalized = value.trim().replace(/^-\s+/, '-').replace(/\./g, '').replace(',', '.');
  return parseFloat(normalized);
}

// Parse date from DD.MM.YY or DD.MM.YYYY format to ISO date string
export function parseDate(dateStr: string): string {
  // Try DD.MM.YYYY format first (4-digit year)
  const matchFull = dateStr.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (matchFull) {
    const [, day, month, year] = matchFull;
    return `${year}-${month}-${day}`;
  }

  // Try DD.MM.YY format (2-digit year)
  const matchShort = dateStr.match(/(\d{2})\.(\d{2})\.(\d{2})/);
  if (matchShort) {
    const [, day, month, year] = matchShort;
    const fullYear = parseInt(year) > 50 ? `19${year}` : `20${year}`;
    return `${fullYear}-${month}-${day}`;
  }

  return dateStr;
}

// Extract text from PDF using pdfjs-dist
async function extractTextFromPDF(buffer: Buffer): Promise<string[]> {
  const uint8Array = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data: uint8Array }).promise;
  const allLines: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items as TextItem[];

    // Group text items by Y position (with small tolerance)
    const lineMap = new Map<number, { x: number; text: string }[]>();

    for (const item of items) {
      const y = Math.round(item.transform[5]); // Y position
      const x = item.transform[4]; // X position

      if (!lineMap.has(y)) {
        lineMap.set(y, []);
      }
      lineMap.get(y)!.push({ x, text: item.str });
    }

    // Sort by Y (descending - PDF coordinates start from bottom)
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

export async function parseNovoBancoPDF(buffer: Buffer): Promise<ParseResult> {
  const fileHash = generateFileHash(buffer);
  const lines = await extractTextFromPDF(buffer);
  const text = lines.join('\n');

  const transactions: ParsedTransaction[] = [];
  let periodStart: string | null = null;
  let periodEnd: string | null = null;

  // Extract period from header (e.g., "de 01.12.2025 a 01.01.2026")
  const periodMatch = text.match(/de\s+(\d{2}\.\d{2}\.\d{4})\s+a\s+(\d{2}\.\d{2}\.\d{4})/i);
  if (periodMatch) {
    periodStart = parseDate(periodMatch[1]);
    periodEnd = parseDate(periodMatch[2]);
  }

  // Find transaction sections (MOVIMENTOS DE CONTA)
  let inTransactionSection = false;
  let previousBalance: number | null = null;

  // Amount pattern (European format: 1.234,56 or 24,30)
  const amountPattern = /-?\s?[\d.]+,\d{2}/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty lines
    if (!line) continue;

    // Normalize multiple spaces in line for matching
    const normalizedLine = line.replace(/\s+/g, ' ');

    // Detect start of transaction section
    if (normalizedLine.includes('MOVIMENTOS DE CONTA')) {
      inTransactionSection = true;
      continue;
    }

    // Detect end of transaction section
    if (
      normalizedLine.includes('SALDO CONTABILÍSTICO') ||
      (normalizedLine.includes('TOTAL') && !normalizedLine.includes('MOVIMENTOS')) ||
      (normalizedLine.includes('MOVIMENTOS DE') && !normalizedLine.includes('MOVIMENTOS DE CONTA'))
    ) {
      inTransactionSection = false;
      continue;
    }

    if (!inTransactionSection) continue;

    // Skip PDF column headers and single-word layout artifacts from the bank's PDF format.
    if (
      normalizedLine.includes('Data Descritivo') ||
      normalizedLine.includes('Débito Crédito') ||
      normalizedLine.includes('Saldo (Euros)') ||
      normalizedLine === 'Data' ||
      normalizedLine === 'Valor' ||
      normalizedLine === 'Online' ||
      normalizedLine === 'Banco' ||
      normalizedLine === 'Digital' ||
      normalizedLine === '-' ||
      normalizedLine === 'DN' ||
      normalizedLine === 'Computador' ||
      normalizedLine === 'por' ||
      normalizedLine === 'Processado'
    ) {
      continue;
    }

    // Extract previous balance from SALDO ANTERIOR line
    if (normalizedLine.includes('SALDO ANTERIOR')) {
      const amounts = line.match(amountPattern);
      if (amounts && amounts.length > 0) {
        previousBalance = parseEuropeanDecimal(amounts[amounts.length - 1]);
      }
      continue;
    }

    // Check if this line starts with a date (DD.MM.YY format)
    const dateMatch = line.match(/^(\d{2}\.\d{2}\.\d{2})\s+/);
    if (!dateMatch) continue;

    // Parse the transaction line
    const parts = line.split(/\s+/);
    if (parts.length < 4) continue;

    const date = parseDate(parts[0]);
    const valueDate = parts[1]?.match(/^\d{2}\.\d{2}\.\d{2}$/) ? parseDate(parts[1]) : date;

    // Find all amounts in the line
    const amounts = line.match(amountPattern) || [];
    if (amounts.length < 2) continue;

    // Description is between the value date and the first amount
    const descStartIdx = parts[1]?.match(/^\d{2}\.\d{2}\.\d{2}$/) ? 2 : 1;
    const descParts: string[] = [];

    for (let j = descStartIdx; j < parts.length; j++) {
      const part = parts[j];
      // Stop when we hit an amount pattern
      if (part.match(/^-?[\d.]+,\d{2}$/)) {
        break;
      }
      descParts.push(part);
    }

    const description = descParts.join(' ').trim();
    if (!description) continue;

    // Determine amount and balance based on number of amounts found
    let amount: number;
    let balance: number;
    let isIncome = false;

    // Novo Banco statements use two column layouts:
    // - 3 amounts: separate debit/credit/balance columns
    // - 2 amounts: merged amount + balance, infer direction from previous balance
    if (amounts.length === 3) {
      // Three amounts: debit, credit, balance
      const debit = parseEuropeanDecimal(amounts[0]);
      const credit = parseEuropeanDecimal(amounts[1]);
      balance = parseEuropeanDecimal(amounts[2]);

      if (credit > 0 && debit === 0) {
        amount = credit;
        isIncome = true;
      } else {
        amount = debit;
        isIncome = false;
      }
    } else {
      // Two amounts: amount (debit or credit), balance
      amount = parseEuropeanDecimal(amounts[amounts.length - 2]);
      balance = parseEuropeanDecimal(amounts[amounts.length - 1]);

      // Determine if income or expense by comparing with previous balance
      if (previousBalance !== null) {
        isIncome = balance > previousBalance;
      } else {
        // Fallback when no previous balance: detect income by Portuguese banking keywords
        // ("trf ... de" = transfer from, "reembolso" = refund).
        const descLower = description.toLowerCase();
        isIncome =
          (descLower.includes('trf') && descLower.includes(' de ')) ||
          descLower.includes('reembolso');
      }
    }

    transactions.push({
      date,
      valueDate,
      description,
      amount: Math.abs(amount),
      balance,
      isIncome,
      rawText: line,
      suggestedCategoryId: null,
      suggestedCategoryName: null,
    });

    previousBalance = balance;
  }

  return {
    transactions,
    periodStart,
    periodEnd,
    fileHash,
  };
}

export const novoBanco: BankParserDefinition = {
  config: {
    id: 'novo_banco',
    name: 'Novo Banco',
    country: 'PT',
    currency: 'EUR',
    dateFormat: 'DD.MM.YY',
    decimalFormat: 'european',
  },
  transactionPatterns: {
    CARD_PURCHASE: /^Compra\s+(Mb\s+)?Cartão|^Compra\s+Mbway/i,
    DIRECT_DEBIT: /^Cobrança\s+Sdd/i,
    TRANSFER_IN: /^Trf\s+(Imediata\s+)?Sepa\+?\s+De|^Trf\s+Cred\s+Sepa/i,
    TRANSFER_OUT: /^Trf\s+(Imediata\s+)?Sepa\+?\s+App|^Trf\s+Cred\s+Intrab/i,
    ATM: /^Levantamento\s+Mb\s+Cartão/i,
    BILL_PAYMENT: /^Pag\s+Serv/i,
    LOAN_PAYMENT: /^Pagamento\s+Prestação/i,
    STANDING_ORDER: /^Ordem\s+Permanente/i,
    BANK_FEE: /^Manutencao\s+Conta|^Imposto\s+Do\s+Selo/i,
  },
  categoryPatterns: {
    Groceries: ['Pingo Doce', 'Lidl', 'Continente', 'Aldi', 'Mercadona', 'Intermarche', 'Frutaria'],
    Fuel: ['BP', 'Disa', 'Petrogal', 'Galp', 'Repsol', 'Cepsa'],
    Health: ['Hospital', 'Psicologi', 'Medis', 'Farmacia', 'Clinica', 'Dentista'],
    Fitness: ['Solinca', 'Decathlon', 'Taekwon', 'Ginasio', 'Fitness', 'Holmes Place'],
    Entertainment: ['Cinemas', 'Fnac', 'Netflix', 'Spotify', 'Disney', 'HBO', 'Amazon Prime'],
    Dining: ['McDonald', 'Leitaria', 'Restaurante', 'Cafe', 'Pizza', 'Burger', 'KFC', 'Telepizza'],
    Shopping: ['Zara', 'Tiger', 'Primark', 'H&M', 'Worten', 'Media Markt', 'IKEA'],
    Utilities: ['Digi Portugal', 'Simas', 'EDP', 'Galp Energia', 'NOS', 'MEO', 'Vodafone', 'Agua'],
    Housing: ['Condominio', 'Renda', 'Prestação', 'Habitação', 'Hipoteca'],
    Insurance: ['Seguro', 'Mapfre', 'Fidelidade', 'Allianz', 'Tranquilidade', 'Ageas'],
    Transfers: ['Transferência Conta Serviço', 'Trf Cred Intrab'],
    Fees: ['Manutencao Conta', 'Imposto Do Selo', 'Comissão', 'Taxa'],
    Cash: ['Levantamento'],
  },
  parse: parseNovoBancoPDF,
};

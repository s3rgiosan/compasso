import type { BankParserDefinition } from './types.js';
import { novoBancoData } from './novo-banco-data.js';
import { cgdData } from './cgd-data.js';

type BankParserData = Omit<BankParserDefinition, 'parse'>;

const definitions: BankParserData[] = [
  novoBancoData,
  cgdData,
];

// Derived constants (no pdfjs-dist dependency)
export const SUPPORTED_BANKS = Object.fromEntries(
  definitions.map((d) => [d.config.id.toUpperCase().replace(/[^A-Z0-9]/g, '_'), d.config.id])
) as Record<string, string>;

export const BANK_CONFIGS: Record<string, BankParserData['config']> = Object.fromEntries(
  definitions.map((d) => [d.config.id, d.config])
);

export const BANK_CATEGORY_PATTERNS: Record<string, BankParserData['categoryPatterns']> =
  Object.fromEntries(definitions.map((d) => [d.config.id, d.categoryPatterns]));

// Lazy-load parsers only when needed to avoid loading pdfjs-dist at startup
const parserLoaders: Record<string, () => Promise<BankParserDefinition['parse']>> = {
  novo_banco: async () => (await import('./novo-banco.js')).novoBanco.parse,
  cgd: async () => (await import('./cgd.js')).cgd.parse,
};

export async function getParser(bankId: string) {
  const loader = parserLoaders[bankId];
  if (!loader) return undefined;
  return loader();
}

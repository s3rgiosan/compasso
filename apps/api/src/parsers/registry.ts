import type { BankParserDefinition } from './types.js';
import { novoBanco } from './novo-banco.js';
import { cgd } from './cgd.js';

const definitions: BankParserDefinition[] = [
  novoBanco,
  cgd,
];

// Derived constants
export const SUPPORTED_BANKS = Object.fromEntries(
  definitions.map((d) => [d.config.id.toUpperCase().replace(/[^A-Z0-9]/g, '_'), d.config.id])
) as Record<string, string>;

export const BANK_CONFIGS: Record<string, BankParserDefinition['config']> = Object.fromEntries(
  definitions.map((d) => [d.config.id, d.config])
);

export const BANK_CATEGORY_PATTERNS: Record<string, BankParserDefinition['categoryPatterns']> =
  Object.fromEntries(definitions.map((d) => [d.config.id, d.categoryPatterns]));

const parserMap = new Map(definitions.map((d) => [d.config.id, d.parse]));

export function getParser(bankId: string) {
  return parserMap.get(bankId);
}

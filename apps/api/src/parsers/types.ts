import type { ParseResult, BankConfig } from '@compasso/shared';

export type { ParseResult };

export interface TransactionPatterns {
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

export interface BankCategoryPatterns {
  [categoryName: string]: string[];
}

export interface BankParserDefinition {
  config: BankConfig;
  transactionPatterns: TransactionPatterns;
  categoryPatterns: BankCategoryPatterns;
  parse: (buffer: Buffer) => Promise<ParseResult>;
}

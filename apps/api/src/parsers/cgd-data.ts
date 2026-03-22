import type { BankParserDefinition } from './types.js';

type BankParserData = Omit<BankParserDefinition, 'parse'>;

export const cgdData: BankParserData = {
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
};

import type { BankParserDefinition } from './types.js';

type BankParserData = Omit<BankParserDefinition, 'parse'>;

export const novoBancoData: BankParserData = {
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
};

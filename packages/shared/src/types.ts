// Locale types
export type SupportedLocale = 'en' | 'pt';
export const SUPPORTED_LOCALES: SupportedLocale[] = ['en', 'pt'];
export const DEFAULT_LOCALE: SupportedLocale = 'en';

// User types
export interface User {
  id: number;
  username: string;
  email: string | null;
  displayName: string | null;
  locale: SupportedLocale;
  createdAt: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  email?: string;
  displayName?: string;
  locale?: SupportedLocale;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  sessionId: string;
}

// Workspace types
export type WorkspaceRole = 'owner' | 'editor' | 'viewer';

export interface Workspace {
  id: number;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  isDefault: boolean;
  createdAt: string;
  role?: WorkspaceRole;
}

export interface WorkspaceMember {
  id: number;
  workspaceId: number;
  userId: number;
  username: string;
  displayName: string | null;
  email: string | null;
  role: WorkspaceRole;
  createdAt: string;
}

export type InvitationStatus = 'pending' | 'accepted' | 'declined';

export interface WorkspaceInvitation {
  id: number;
  workspaceId: number;
  workspaceName: string;
  workspaceColor: string;
  invitedBy: {
    id: number;
    username: string;
    displayName: string | null;
  };
  role: WorkspaceRole;
  status: InvitationStatus;
  createdAt: string;
  respondedAt: string | null;
}

export interface InviteUserRequest {
  usernameOrEmail: string;
  role: 'editor' | 'viewer';
}

export interface CreateWorkspaceRequest {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

export interface UpdateWorkspaceRequest {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
}

// Category types
export interface Category {
  id: number;
  name: string;
  color: string | null;
  icon: string | null;
  isDefault: boolean;
  createdAt: string;
  workspaceId?: number;
}

export interface CategoryPattern {
  id: number;
  categoryId: number;
  bankId: string;
  pattern: string;
  priority: number;
  createdAt: string;
}

export interface CategoryWithPatterns extends Category {
  patterns: CategoryPattern[];
}

// Ledger types
export interface Ledger {
  id: number;
  filename: string;
  uploadDate: string;
  periodStart: string | null;
  periodEnd: string | null;
  bankId: string;
  fileHash: string;
  workspaceId?: number;
}

// Transaction types
export interface Transaction {
  id: number;
  ledgerId: number;
  date: string;
  description: string;
  amount: number;
  balance: number | null;
  categoryId: number | null;
  isIncome: boolean;
  rawText: string | null;
  createdAt: string;
}

export interface TransactionWithCategory extends Transaction {
  category: Category | null;
  recurringPatternId?: number | null;
  bankId?: string;
}

// Parsed transaction (before saving to DB)
export interface ParsedTransaction {
  date: string;
  valueDate: string;
  description: string;
  amount: number;
  balance: number | null;
  isIncome: boolean;
  rawText: string;
  suggestedCategoryId: number | null;
  suggestedCategoryName: string | null;
}

// Dashboard types
export interface DashboardSummary {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  transactionCount: number;
  periodStart: string;
  periodEnd: string;
}

export interface CategoryBreakdown {
  categoryId: number | null;
  categoryName: string;
  categoryColor: string | null;
  total: number;
  count: number;
  percentage: number;
}

export interface MonthlyTrend {
  month: string;
  income: number;
  expenses: number;
  balance: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  categoryBreakdown: CategoryBreakdown[];
  monthlyTrends: MonthlyTrend[];
  recentTransactions: TransactionWithCategory[];
  recurringSummary: RecurringSummary;
}

// API request/response types
export interface UploadResponse {
  ledgerId: number;
  filename: string;
  bankId: string;
  transactionCount: number;
  transactions: ParsedTransaction[];
  periodStart: string | null;
  periodEnd: string | null;
}

export interface ConfirmTransactionsRequest {
  ledgerId: number;
  transactions: {
    date: string;
    description: string;
    amount: number;
    balance: number | null;
    isIncome: boolean;
    categoryId: number | null;
    rawText: string | null;
  }[];
}

export interface TransactionFilters {
  workspaceId?: number;
  year?: number;
  month?: number;
  categoryId?: number;
  isIncome?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateCategoryRequest {
  name: string;
  color?: string;
  icon?: string;
  workspaceId?: number;
}

export interface UpdateCategoryRequest {
  name?: string;
  color?: string;
  icon?: string;
}

export interface AddPatternRequest {
  bankId: string;
  pattern: string;
  priority?: number;
}

// Parse result (returned by bank parsers)
export interface ParseResult {
  transactions: ParsedTransaction[];
  periodStart: string | null;
  periodEnd: string | null;
  fileHash: string;
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

// Recurring pattern types
export type RecurringFrequency = 'weekly' | 'monthly' | 'yearly';

export interface RecurringPattern {
  id: number;
  workspaceId: number;
  descriptionPattern: string;
  frequency: RecurringFrequency;
  avgAmount: number;
  occurrenceCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface RecurringPatternWithTransactions extends RecurringPattern {
  transactionIds: number[];
}

export interface RecurringSummary {
  totalActive: number;
  estimatedMonthlyCost: number;
}

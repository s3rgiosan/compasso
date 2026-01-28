# Compasso Architecture

This document provides a comprehensive overview of the Compasso project architecture, a privacy-first personal finance tracker for Portuguese bank statements.

## Table of Contents

- [Project Structure](#project-structure)
- [Authentication](#authentication)
- [Workspaces](#workspaces)
- [Shared Package](#shared-package-compassoshared)
- [Backend API](#backend-api-compassoapi)
- [Frontend Web](#frontend-web-compassoweb)
- [Data Flow](#data-flow)
- [Tech Stack](#tech-stack)
- [Extensibility Points](#extensibility-points)

---

## Project Structure

Compasso is a **TypeScript monorepo** using npm workspaces:

```
compasso/
├── apps/
│   ├── api/                    # Express.js backend (port 5181)
│   └── web/                    # React + Vite frontend (port 5180)
├── packages/
│   └── shared/                 # Shared types and constants
├── data/                       # SQLite database (gitignored)
├── uploads/                    # Temporary PDF uploads (gitignored)
├── node_modules/               # Shared dependencies
├── package.json                # Root workspace configuration
└── README.md
```

### Workspaces

Defined in root `package.json`:
- `packages/*` - Shared libraries
- `apps/*` - Applications (API and Web)

---

## Authentication

Compasso implements session-based authentication with secure cookie storage.

### Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │     │ Frontend │     │  Backend │     │ Database │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ 1. Login       │                │                │
     │───────────────►│                │                │
     │                │ 2. POST /auth/ │                │
     │                │    login       │                │
     │                │───────────────►│                │
     │                │                │ 3. Verify pwd  │
     │                │                │───────────────►│
     │                │                │◄───────────────│
     │                │                │ 4. Create      │
     │                │                │    session     │
     │                │                │───────────────►│
     │                │ 5. Set-Cookie  │                │
     │                │◄───────────────│                │
     │◄───────────────│                │                │
```

### Session Management

| Component | Description |
|-----------|-------------|
| Session ID | 32-byte random hex stored in `sessions` table |
| Cookie | `session_id` HTTP-only cookie with secure flag in production |
| Expiration | Sessions expire after 30 days |
| Storage | Cookie-based (primary) or Authorization header (Bearer token) |

### Middleware

| Middleware | File | Purpose |
|------------|------|---------|
| `authMiddleware` | `middleware/auth.ts` | Requires valid session, attaches `req.user` |
| `optionalAuthMiddleware` | `middleware/auth.ts` | Attaches user if authenticated, continues if not |

### Password Security

- Passwords hashed using PBKDF2 with SHA-512 (100,000 iterations, 16-byte random salt)
- No plain-text password storage
- Password validation on login
- Password change endpoint (requires current password verification)

### API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/register` | POST | Create new user account |
| `/api/auth/login` | POST | Authenticate and create session |
| `/api/auth/logout` | POST | Invalidate current session |
| `/api/auth/me` | GET | Get current user info |
| `/api/auth/profile` | PUT | Update user profile |
| `/api/auth/password` | PUT | Change password |

---

## Workspaces

Compasso supports multi-workspace architecture with role-based access control and collaboration via invitations.

### Workspace Model

Each workspace has members with different roles:
- **Owner**: Full control (create, update, delete workspace, manage members)
- **Editor**: Can update workspace, manage data, invite users
- **Viewer**: Read-only access to workspace data

### Workspace Hierarchy

```
User
 └── Workspace 1 (default, owner)
 │    ├── Members (owner, editors, viewers)
 │    ├── Invitations (pending, accepted, declined)
 │    ├── Categories (seeded from defaults)
 │    ├── Category Patterns
 │    ├── Ledgers
 │    │    └── Transactions
 │    └── Recurring Patterns
 │
 └── Workspace 2 (editor)
      ├── Members
      ├── Categories
      ├── Ledgers
      │    └── Transactions
      └── Recurring Patterns
```

### Data Scoping

All data operations are scoped to workspace via membership:
- Workspace access is controlled through `workspace_members` table
- Categories are created per-workspace with workspace_id
- Ledgers reference workspace_id for ownership
- Transactions are indirectly scoped via ledger relationship
- Recurring patterns are workspace-specific
- Write access requires editor or owner role; delete workspace requires owner

### Default Workspace

- First workspace created for new users is marked as default
- Default workspace is auto-selected on login
- Users can create additional workspaces
- Creator is automatically added as workspace owner

### Workspace Invitations

Users can be invited to workspaces by owners or editors:
1. Invite by username or email
2. Invited user sees pending invitations
3. Accept adds the user as a member with the specified role
4. Decline marks the invitation as declined

---

## Shared Package (@compasso/shared)

**Location:** `packages/shared/`

Central package for TypeScript definitions and constants shared across the monorepo.

### Types (`src/types.ts`)

| Type | Description |
|------|-------------|
| `Category` | Category with id, name, color, icon, isDefault flag |
| `Transaction` | Full transaction record from database |
| `ParsedTransaction` | Transaction parsed from PDF (pre-save) |
| `DashboardData` | Summary, trends, and breakdown data |
| `Ledger` | Uploaded bank statement metadata |
| `MonthlyTrend` | Monthly income/expense aggregation |
| `CategoryBreakdown` | Category spending with percentages |
| `BankConfig` | Bank-specific parsing configuration |
| `CategoryPattern` | Pattern for auto-categorization |
| `SupportedLocale` | Union type for supported locales (`'en' \| 'pt'`) |

### Constants (`src/constants.ts`)

| Constant | Description |
|----------|-------------|
| `SUPPORTED_BANKS` | Bank configurations (Novo Banco, CGD) |
| `DEFAULT_CATEGORIES` | 16 predefined categories |
| `SUPPORTED_LOCALES` | Supported locale codes (`['en', 'pt']`) |
| `DEFAULT_LOCALE` | Default locale (`'en'`) |
| `CATEGORY_NAME_TRANSLATIONS` | Category name translations per locale |
| `getLocalizedCategories()` | Returns `DEFAULT_CATEGORIES` with names translated to a given locale |
| `TRANSACTION_PATTERNS` | Bank-specific keyword patterns |
| `API_ENDPOINTS` | API route definitions |

### Default Categories

Groceries, Fuel, Health, Fitness, Entertainment, Dining, Shopping, Utilities, Housing, Insurance, Income, Transfers, Fees, Cash, Other, Uncategorized

---

## Backend API (@compasso/api)

**Location:** `apps/api/`
**Port:** 5181

Express.js REST API server with SQLite database.

### Entry Point (`src/index.ts`)

- Express app initialization
- CORS middleware
- JSON body parsing
- File upload middleware (Multer)
- Route registration
- Server startup on port 5181

### Database Layer

#### Schema (`src/db/database.ts`)

```
┌─────────────┐
│   users     │
├─────────────┤
│ id          │◄────────────────────────────────────────────────┐
│ username    │                                                 │
│ password_   │     ┌──────────────┐                            │
│   hash      │     │  sessions    │                            │
│ email       │     ├──────────────┤                            │
│ display_    │     │ id           │                            │
│   name      │     │ user_id ─────┼────────────────────────────┤
│ locale      │     │ expires_at   │  (TEXT DEFAULT 'en')       │
│ created_at  │     │ expires_at   │                            │
└─────────────┘     │ created_at   │                            │
                    └──────────────┘                            │
                                                                │
┌─────────────┐     ┌───────────────────┐                       │
│ workspaces  │     │ workspace_members │                       │
├─────────────┤     ├───────────────────┤                       │
│ id          │◄────│ workspace_id      │                       │
│ name        │     │ user_id ──────────┼───────────────────────┤
│ description │     │ role              │ (owner/editor/viewer) │
│ color       │     │ created_at        │                       │
│ icon        │     └───────────────────┘                       │
│ is_default  │                                                 │
│ created_at  │     ┌────────────────────────┐                  │
└──────┬──────┘     │ workspace_invitations  │                  │
       │            ├────────────────────────┤                  │
       │◄───────────│ workspace_id           │                  │
       │            │ invited_by ────────────┼──────────────────┤
       │            │ invited_user_id ───────┼──────────────────┘
       │            │ role                   │ (editor/viewer)
       │            │ status                 │ (pending/accepted/declined)
       │            │ created_at             │
       │            │ responded_at           │
       │            └────────────────────────┘
       │
       │
┌──────┴──────┐     ┌──────────────────┐
│ categories  │     │ category_patterns│
├─────────────┤     ├──────────────────┤
│ id          │◄────│ category_id      │
│ name        │     │ bank_id          │
│ color       │     │ pattern          │
│ icon        │     │ priority         │
│ is_default  │     │ created_at       │
│ workspace_id│     └──────────────────┘
│ created_at  │
└─────────────┘

┌─────────────┐     ┌──────────────────┐
│ ledgers     │     │ transactions     │
├─────────────┤     ├──────────────────┤
│ id          │◄────│ ledger_id        │
│ filename    │     │ id               │
│ upload_date │     │ date             │
│ period_start│     │ description      │
│ period_end  │     │ amount           │
│ bank_id     │     │ balance          │
│ file_hash   │     │ category_id ─────┼──► categories
│ workspace_id│     │ is_income        │
└─────────────┘     │ is_manual        │ (tracks manual categorization)
                    │ recurring_       │
                    │   pattern_id ────┼──► recurring_patterns
                    │ raw_text         │
                    │ created_at       │
                    └──────────────────┘

┌─────────────────────┐
│ recurring_patterns  │
├─────────────────────┤
│ id                  │
│ workspace_id ───────┼──► workspaces
│ description_pattern │
│ frequency           │ (weekly, monthly, yearly)
│ avg_amount          │
│ occurrence_count    │
│ is_active           │
│ created_at          │
└─────────────────────┘
```

#### Seed Data (`src/db/seed.ts`)

- Seeds default categories per workspace on creation
- Seeds bank-specific patterns for auto-categorization
- Locale-aware seeding via `getLocalizedCategories()` — category names are translated to the user's locale

### Routes

| Route File | Endpoints | Description |
|------------|-----------|-------------|
| `routes/auth.ts` | `POST /api/auth/register,login,logout`, `GET /api/auth/me`, `PUT /api/auth/profile,password` | User authentication, profile, password |
| `routes/workspaces.ts` | `GET/POST/PUT/DELETE /api/workspaces` | Workspace CRUD operations |
| `routes/invitations.ts` | `GET/POST /api/workspaces/:id/members,invitations`, `PUT/DELETE /api/workspaces/:id/members/:userId`, `GET /api/invitations`, `POST /api/invitations/:id/accept,decline` | Members, invitations |
| `routes/dashboard.ts` | `GET /api/dashboard`, `GET /api/dashboard/years` | Dashboard data and available years |
| `routes/transactions.ts` | `GET/POST/PUT/DELETE /api/transactions` | Transaction CRUD and confirmation |
| `routes/categories.ts` | `GET/POST/PUT/DELETE /api/categories`, `GET /api/categories/patterns/exists` | Category CRUD, pattern management |
| `routes/upload.ts` | `POST /api/upload`, `GET/DELETE /api/upload/*` | PDF upload, parsing, ledger management |
| `routes/recurring.ts` | `GET/POST/PUT /api/recurring` | Recurring pattern detection and management |
| `routes/reports.ts` | `GET /api/reports/*` | Financial reports and analytics |

### Middleware Flow

All protected routes follow this middleware chain:

```
Request → CORS → Cookie Parser → JSON Parser → Auth Middleware → Route Handler → Error Handler → Response
                                       │                                              │
                                       ▼                                              ▼
                               Validate Session                               AppError → status + code
                               Attach req.user                                Unknown → 500 + INTERNAL_ERROR
                               Attach req.sessionId
```

### Error Handling

| Component | File | Purpose |
|-----------|------|---------|
| `ErrorCode` | `packages/shared/src/errors.ts` | Shared error code constants |
| `AppError` | `src/errors.ts` | Error class with status code and error code |
| `errorHandler` | `src/middleware/errorHandler.ts` | Centralized Express error middleware |
| `ApiError` | `apps/web/src/services/api.ts` | Frontend error class with auth detection |
| `authEvents` | `apps/web/src/services/authEvents.ts` | Session expiry event bridge |
| `ErrorBoundary` | `apps/web/src/components/ErrorBoundary.tsx` | React error boundary |

All API error responses include a `code` field from `ErrorCode` for programmatic error handling.

### Services

| Service | File | Purpose |
|---------|------|---------|
| Category Matcher | `services/categoryMatcher.ts` | Pattern-based auto-categorization using regex and string matching |
| Dashboard Service | `services/dashboardService.ts` | Aggregations: summary stats, monthly trends, category breakdowns |
| Recategorizer | `services/recategorizer.ts` | Re-categorizes existing transactions when new patterns are added |
| Recurring Detector | `services/recurringDetector.ts` | Detects recurring transaction patterns (weekly, monthly, yearly) |
| Reports Service | `services/reportsService.ts` | Generates financial reports and analytics |

### Parsers

| Parser | File | Banks Supported |
|--------|------|-----------------|
| Novo Banco | `parsers/novobanco.ts` | Novo Banco (Portugal) - "Extrato Integrado" format |
| CGD | `parsers/cgd.ts` | CGD / Caixa Geral de Depósitos (Portugal) |

**Parser Features:**
- European decimal format handling (1.234,56)
- Date format parsing (DD.MM.YY)
- Period extraction (start/end dates)
- Transaction amount and balance extraction
- SHA-256 file hash for duplicate detection

---

## Frontend Web (@compasso/web)

**Location:** `apps/web/`
**Port:** 5180

React SPA with Vite build tool and Tailwind CSS styling.

### Pages

| Page | File | Features |
|------|------|----------|
| Login | `pages/Login.tsx` | User login form (`useTranslation()`) |
| Register | `pages/Register.tsx` | User registration form, locale selector (`useTranslation()`) |
| Dashboard | `pages/Dashboard.tsx` | Summary cards, bar/pie charts, recent transactions, year/month filters |
| Upload | `pages/Upload.tsx` | Uploaded statements list with filters, drag-drop PDF upload, transaction preview, category assignment |
| Transactions | `pages/Transactions.tsx` | Transaction list, filters, pagination, category editing with modal creation |
| Categories | `pages/Categories.tsx` | Category CRUD with pattern management, duplicate pattern validation |
| Reports | `pages/Reports.tsx` | Annual and monthly financial reports with charts |
| Profile | `pages/Profile.tsx` | User profile settings, display name, email, password change, locale selector (`useTranslation()`) |
| Workspace Settings | `pages/WorkspaceSettings.tsx` | Workspace CRUD, members management, invitations |
| Invitations | `pages/Invitations.tsx` | Pending workspace invitations, accept/decline |

### Components

```
src/components/
├── Layout.tsx              # Main layout with navigation header, invitation badge
├── CategorySelect.tsx      # Category dropdown with modal creation
├── ErrorBoundary.tsx       # React error boundary with fallback UI
├── LedgersManagement.tsx   # Uploaded statements management with filters
├── PatternModal.tsx        # Modal for creating category patterns
├── WorkspaceMembers.tsx    # Workspace members list, invite, role management
├── WorkspaceSelector.tsx   # Workspace selection dropdown
├── i18n/
│   ├── index.ts            # i18next configuration
│   └── locales/
│       ├── en.json         # English translations
│       └── pt.json         # Portuguese translations
└── ui/
    ├── Button.tsx          # Styled button component
    ├── Card.tsx            # Card container
    ├── ConfirmDialog.tsx   # Confirmation modal dialog
    ├── DropdownMenu.tsx    # Dropdown menu component
    ├── Input.tsx           # Form input
    ├── Modal.tsx           # Reusable modal component
    ├── Select.tsx          # Dropdown select
    ├── Badge.tsx           # Category badges
    ├── Table.tsx           # Data table
    └── Toast.tsx           # Toast notifications (ToastProvider, useToast)
```

### Context Providers

| Context | File | Purpose |
|---------|------|---------|
| AuthContext | `context/AuthContext.tsx` | User authentication state and methods; syncs `i18n.changeLanguage()` on login/register |
| WorkspaceContext | `context/WorkspaceContext.tsx` | Current workspace state and selection |

#### CategorySelect Component

A smart category dropdown that extends the basic Select component with modal category creation:

- Shows existing categories plus a "Create new..." option
- When creating, opens a modal with name input and color swatches
- Automatically selects newly created category after creation
- Used in Transactions page and Upload page for category assignment

#### LedgersManagement Component

A self-contained component for managing uploaded bank statements:

- Fetches and displays ledgers for the current workspace
- Filters by bank and year
- Shows filename, bank, upload date, period, and transaction count
- Supports ledger deletion with confirmation dialog

### Services (`src/services/api.ts`)

Type-safe API client with functions for all backend endpoints:
- `fetchDashboard()`, `fetchAvailableYears()`
- `fetchTransactions()`, `confirmTransactions()`, `updateTransaction()`, `deleteTransaction()`
- `fetchCategories()`, `createCategory()`, `updateCategory()`, `deleteCategory()`
- `uploadPDF()`, `fetchBanks()`, `fetchLedgers()`, `deleteLedger()`

### Utilities

#### `src/lib/utils.ts`

- `formatCurrency()` - Format amounts in EUR (locale-aware via `i18n.language`)
- `formatDate()` - Format dates for display (locale-aware via `i18n.language`)
- `formatMonth()` - Format year-month strings (locale-aware via `i18n.language`)

#### `src/lib/constants.ts`

- `COLORS` - Predefined color palette for categories (shared between CategorySelect and Categories page)

### Configuration

| File | Purpose |
|------|---------|
| `vite.config.ts` | Dev server (5180), API proxy to 5181, React plugin, `@` path alias |
| `tailwind.config.js` | Tailwind CSS configuration |
| `tsconfig.json` | TypeScript configuration |

---

## Data Flow

### PDF Upload Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │     │ Frontend │     │  Backend │     │ Database │
│          │     │   Web    │     │   API    │     │  SQLite  │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │ 1. Drop PDF    │                │                │
     │───────────────►│                │                │
     │                │ 2. POST /upload│                │
     │                │───────────────►│                │
     │                │                │ 3. Parse PDF   │
     │                │                │────────────────│
     │                │                │ 4. Check hash  │
     │                │                │───────────────►│
     │                │                │◄───────────────│
     │                │                │ 5. Match cats  │
     │                │                │────────────────│
     │                │ 6. Parsed txns │                │
     │                │◄───────────────│                │
     │ 7. Review      │                │                │
     │◄───────────────│                │                │
     │                │                │                │
     │ 8. Confirm     │                │                │
     │───────────────►│                │                │
     │                │ 9. POST confirm│                │
     │                │───────────────►│                │
     │                │                │ 10. Save txns  │
     │                │                │───────────────►│
     │                │                │◄───────────────│
     │                │◄───────────────│                │
     │◄───────────────│                │                │
     │                │                │                │
```

### Dashboard Data Flow

```
┌──────────┐     ┌──────────┐     ┌──────────────────┐     ┌──────────┐
│  User    │     │ Frontend │     │ Dashboard Service│     │ Database │
└────┬─────┘     └────┬─────┘     └────────┬─────────┘     └────┬─────┘
     │                │                     │                    │
     │ Select filters │                     │                    │
     │───────────────►│                     │                    │
     │                │ GET /dashboard      │                    │
     │                │────────────────────►│                    │
     │                │                     │ Query transactions │
     │                │                     │───────────────────►│
     │                │                     │◄───────────────────│
     │                │                     │ Aggregate data     │
     │                │                     │────────────────────│
     │                │ Dashboard data      │                    │
     │                │◄────────────────────│                    │
     │ Display charts │                     │                    │
     │◄───────────────│                     │                    │
```

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.2.0 | UI framework |
| TypeScript | 5.3.2 | Type safety |
| Vite | 5.0.10 | Build tool and dev server |
| React Router | 6.21.1 | Client-side routing |
| Tailwind CSS | 3.4.0 | Utility-first styling |
| Recharts | 2.10.3 | Charts and data visualization |
| Lucide React | 0.303.0 | Icon library |
| react-dropzone | 14.2.3 | File upload drag-and-drop |
| react-i18next | - | React bindings for i18next |
| i18next | - | Internationalization framework |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | Runtime |
| Express | 4.18.2 | Web framework |
| TypeScript | 5.3.2 | Type safety |
| better-sqlite3 | 9.2.2 | SQLite database |
| pdf-parse | 1.1.1 | PDF text extraction |
| Multer | 1.4.5 | File upload handling |
| tsx | 4.6.2 | TypeScript execution |

### Development

| Tool | Purpose |
|------|---------|
| ESLint | Code linting |
| Prettier | Code formatting |
| Concurrently | Run multiple dev servers |

---

## Extensibility Points

### Adding New Bank Support

The project uses a **registry pattern** — each parser is a self-contained module exporting a `BankParserDefinition` (config + patterns + parse function). Only 3 files need to be touched:

1. **Create parser** in `apps/api/src/parsers/<bank-slug>.ts` — export a `BankParserDefinition`
2. **Register** in `apps/api/src/parsers/registry.ts` — add 1 import + 1 array entry
3. **Write tests** in `apps/api/src/parsers/<bank-slug>.test.ts`

The registry automatically derives `SUPPORTED_BANKS`, `BANK_CONFIGS`, and `BANK_CATEGORY_PATTERNS`. No changes needed in upload routes, constants, or seed files.

See [`.github/BANK_PARSER_GUIDE.md`](.github/BANK_PARSER_GUIDE.md) for the full step-by-step contributor guide.

### Adding New Categories

1. Add to `DEFAULT_CATEGORIES` in `packages/shared/src/constants.ts`
2. Add matching patterns to `TRANSACTION_PATTERNS`
3. Add translations to `CATEGORY_NAME_TRANSLATIONS` for each supported locale
4. Database will auto-seed new categories on restart

### Adding New Dashboard Widgets

1. Create aggregation function in `apps/api/src/services/dashboardService.ts`
2. Add endpoint in `apps/api/src/routes/dashboard.ts`
3. Create component in `apps/web/src/pages/Dashboard.tsx`

### Adding Data Export

1. Create export service in `apps/api/src/services/exportService.ts`
2. Add route in `apps/api/src/routes/export.ts`
3. Implement export formats (CSV, Excel, JSON)

---

## Port Configuration

| Service | Port | URL |
|---------|------|-----|
| Frontend (Vite) | 5180 | http://localhost:5180 |
| Backend (Express) | 5181 | http://localhost:5181 |

The frontend proxies `/api/*` requests to the backend via Vite's proxy configuration.

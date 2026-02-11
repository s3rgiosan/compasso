# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-02-11

Initial release.

### PDF Parsing

- Parse bank PDF statements and extract transactions automatically
- Novo Banco format support
- CGD (Caixa Geral de Depósitos) format support
- European decimal format handling (1.234,56)
- SHA-256 file hash for duplicate statement detection
- Registry-based parser architecture for easy bank additions

### Smart Categorization

- Pattern-based auto-categorization with regex and string matching
- 16 default categories with pre-seeded Portuguese merchant patterns
- Bank-specific keyword matching
- Priority-based pattern resolution
- Duplicate pattern detection across categories
- Auto-recategorization when new patterns are added (preserves manual overrides)

### Transaction Management

- Review and adjust categories before confirming imported transactions
- Edit transaction categories after import with inline category creation
- Filter by year, month, category, and type (income/expense)
- Search by description
- Pagination with URL-persisted page numbers
- CSV export with current filters applied
- Delete individual transactions

### Dashboard and Reports

- Summary cards: total income, total expenses, net balance, transaction count
- Monthly trends bar chart (income vs expenses)
- Expense breakdown pie chart with percentages
- Year and month filters
- Recent transactions widget
- Annual reports with year-over-year comparison
- Monthly reports with trend visualization and top spending categories

### Recurring Transaction Detection

- Automatic detection of weekly, monthly, and yearly patterns
- Consistency validation using standard deviation
- Pattern grouping by normalized description
- Toggle patterns active/inactive
- Summary cards (total, active, estimated monthly cost)
- Filter by frequency and status

### Authentication and User Management

- Username/password authentication with PBKDF2 (SHA-512, 100k iterations)
- Session-based auth with HTTP-only cookies (30-day expiry) and Bearer token support
- User registration with required email
- User profile management (display name, email, locale preference)
- Password change (requires current password)
- Password reset via email with time-limited tokens (1-hour expiry)
- Password strength meter on registration
- Rate limiting on login, registration, and password reset endpoints

### Multi-Workspace Collaboration

- Multiple workspaces per user with data isolation
- Default workspace created on registration
- Role-based access control (owner, editor, viewer)
- Invite users by username or email
- Pending invitations with accept/decline
- Members management with role changes and removal
- Notification badge for pending invitations

### Workspace Backup and Restore

- Export workspace data as JSON (categories, patterns, ledgers, transactions)
- Import with version validation and structure checks
- Role-based access (any member can export, owner/editor can import)

### Internationalization

- English and Portuguese translations
- Locale selector on registration and profile pages
- Locale-aware date and currency formatting
- Localized category names

### Email

- SMTP support (any provider: Gmail, Mailgun, SES, self-hosted, etc.)
- Resend REST API support
- Used for password reset emails

### Security

- Workspace authorization on all data routes
- Helmet security headers
- Rate limiting on auth endpoints
- Body size limits (1MB)
- Timing-safe password comparison
- Expired session cleanup (startup + every 24h)

### Infrastructure

- TypeScript monorepo with npm workspaces (api, web, shared)
- SQLite database with better-sqlite3 (WAL mode)
- React + Vite frontend with Tailwind CSS
- Code splitting with React.lazy for all pages
- Vite manual chunk splitting (vendor, charts)
- Response compression (gzip)
- Docker support with docker-compose
- Demo mode
- 590 tests across 40 test files (unit + integration)

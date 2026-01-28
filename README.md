# Compasso

A finance tracking app that parses bank PDF ledgers, categorizes transactions with smart suggestions, and displays data in an interactive dashboard.

## Features

- **Privacy-first**: All data stays local in a SQLite database
- **Multi-user support**: User authentication with secure session management
- **Multi-workspace**: Organize finances into separate workspaces with role-based access (owner, editor, viewer)
- **Collaboration**: Invite users to workspaces via username or email
- **Multilingual**: English and Portuguese UI with user locale preference
- **Password reset**: Reset your password via email
- **Workspace backup/restore**: Export and import workspace data
- **Error handling**: Structured error codes, session expiry detection, React error boundaries
- **PDF parsing**: Extract transactions from Novo Banco and CGD monthly statements (extensible to other banks)
- **Smart categorization**: Pattern-based category suggestions with user-defined categories
- **Dashboard**: View data by year, month, and category with charts
- **Financial reports**: Annual and monthly reports with visualizations
- **Recurring detection**: Automatic detection and management of recurring transactions
- **Bank-agnostic architecture**: Support for multiple banks with bank-specific patterns

## Tech Stack

- **Frontend**: React + TypeScript + Vite + react-i18next
- **UI**: Tailwind CSS + Recharts
- **Backend**: Node.js + Express
- **Database**: SQLite (better-sqlite3)
- **PDF Parsing**: pdfjs-dist

## Project Structure

```text
compasso/
├── apps/
│   ├── web/          # React frontend
│   └── api/          # Node.js backend
├── packages/
│   └── shared/       # Shared types & constants
├── data/             # SQLite database (gitignored)
└── uploads/          # Temporary PDF uploads (gitignored)
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
# Install dependencies
npm install

# Build shared package
npm run build -w @compasso/shared
```

### Development

```bash
# Run both frontend and backend in development mode
npm run dev
```

- Frontend: http://localhost:5180
- Backend: http://localhost:5181

### Environment Variables

Create a `.env` file in the root or `apps/api` directory:

```bash
# Server configuration
PORT=5181
HOST=127.0.0.1
NODE_ENV=development

# CORS configuration (comma-separated origins for production)
ALLOWED_ORIGINS=http://localhost:5180,http://127.0.0.1:5180

# Database path (optional, defaults to ./data)
DATABASE_PATH=./data

# Email — optional, used for password reset emails (see below)
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=noreply@compasso.app
```

### Email Service (Optional)

Password reset emails are sent via [Resend](https://resend.com). Without configuration the app runs normally but password reset will not send emails.

1. Create an account at [resend.com](https://resend.com)
2. Generate an API key from the dashboard
3. Verify a sending domain (or use the sandbox domain for development)
4. Set the environment variables:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
```

`EMAIL_FROM` defaults to `noreply@compasso.app` if not set.

### Production Build

```bash
npm run build
```

### Docker

```bash
# Build and run with Docker Compose
docker compose up -d

# Rebuild after code changes
docker compose up -d --build
```

Environment variables are read from a `.env` file in the project root.

## Usage

1. **Create an account**: Register a new user account on the login page
2. **Create a workspace**: Set up a workspace for your finances (one is created by default)
3. **Upload a statement**: Go to the Upload page and select your bank, then drag & drop a PDF statement
4. **Review transactions**: Review the parsed transactions and adjust categories as needed
5. **View dashboard**: See your financial overview with charts and statistics
6. **Manage categories**: Add custom categories and patterns for auto-categorization
7. **View reports**: Access annual and monthly financial reports
8. **Track recurring**: View and manage detected recurring transaction patterns

## Supported Banks

- **Novo Banco** (Portugal) - "Extrato Integrado" PDF format
- **CGD (Caixa Geral de Depósitos)** (Portugal)

### Adding Support for New Banks

The project uses a registry pattern — only 3 files need to be touched:

1. Create a parser in `apps/api/src/parsers/<bank-slug>.ts` (exports a `BankParserDefinition`)
2. Register it in `apps/api/src/parsers/registry.ts` (1 import + 1 array entry)
3. Write tests in `apps/api/src/parsers/<bank-slug>.test.ts`

See [`.github/BANK_PARSER_GUIDE.md`](.github/BANK_PARSER_GUIDE.md) for the full contributor guide.

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Create new user account |
| POST | /api/auth/login | Authenticate user |
| POST | /api/auth/logout | End user session |
| GET | /api/auth/me | Get current user info |
| PUT | /api/auth/profile | Update user profile |
| PUT | /api/auth/password | Change password |
| POST | /api/auth/forgot-password | Request password reset email |
| POST | /api/auth/reset-password | Reset password with token |

### Workspaces
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/workspaces | List user's workspaces |
| POST | /api/workspaces | Create workspace |
| GET | /api/workspaces/:id | Get workspace details |
| PUT | /api/workspaces/:id | Update workspace |
| DELETE | /api/workspaces/:id | Delete workspace |

### Members & Invitations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/workspaces/:id/members | List workspace members |
| PUT | /api/workspaces/:id/members/:userId | Change member role |
| DELETE | /api/workspaces/:id/members/:userId | Remove member |
| POST | /api/workspaces/:id/invitations | Invite user to workspace |
| GET | /api/workspaces/:id/invitations | List pending invitations |
| GET | /api/invitations | My pending invitations |
| POST | /api/invitations/:id/accept | Accept invitation |
| POST | /api/invitations/:id/decline | Decline invitation |

### Dashboard & Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/dashboard | Dashboard summary data |
| GET | /api/dashboard/years | Available years with data |
| GET | /api/reports/yearly | Annual financial report |
| GET | /api/reports/category-trends | Category trends report |
| GET | /api/reports/years | List available report years |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/transactions | List transactions (with filters) |
| GET | /api/transactions/export | Export transactions as CSV |
| POST | /api/transactions/confirm | Save parsed transactions |
| PUT | /api/transactions/:id | Update transaction category |
| DELETE | /api/transactions/:id | Delete transaction |

### Upload & Ledgers
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/upload | Upload and parse PDF |
| GET | /api/upload/banks | List supported banks |
| GET | /api/upload/ledgers | List uploaded ledgers |
| DELETE | /api/upload/ledgers/:id | Delete ledger |

### Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/categories | List categories |
| POST | /api/categories | Create category |
| GET | /api/categories/:id | Get category with patterns |
| PUT | /api/categories/:id | Update category |
| DELETE | /api/categories/:id | Delete category |
| POST | /api/categories/:id/patterns | Add pattern to category |
| POST | /api/categories/:id/patterns/quick | Create quick pattern |
| DELETE | /api/categories/:id/patterns/:patternId | Delete pattern |
| GET | /api/categories/patterns/exists | Check if pattern exists |

### Recurring Patterns
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/recurring | List recurring patterns |
| POST | /api/recurring/detect | Detect recurring patterns |
| PUT | /api/recurring/:id | Toggle pattern active status |
| GET | /api/recurring/:id/transactions | List pattern transactions |
| DELETE | /api/recurring/:id | Delete recurring pattern |

### Backup
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/backup/export | Export workspace data |
| POST | /api/backup/import | Import workspace data |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/health | Health check |

## Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage
```

Tests use Vitest and cover parsers, services, middleware, and error handling.

## License

[MIT](LICENSE)

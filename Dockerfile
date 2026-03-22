# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build all packages
RUN npm run build

# Prune dev dependencies, keeping native modules intact
RUN npm prune --omit=dev

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Install su-exec for dropping privileges in entrypoint
RUN apk add --no-cache su-exec

# Copy dependencies with pre-compiled native modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
# Copy workspace-level node_modules (non-hoisted dependencies like pdfjs-dist)
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

# Copy built files
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Create writable directories for the node user
RUN mkdir -p /data /app/uploads && chown node:node /data /app/uploads

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5181
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/data

# Expose port
EXPOSE 5181

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5181/api/health || exit 1

# Entrypoint fixes data directory permissions then drops to node user
ENTRYPOINT ["docker-entrypoint.sh"]

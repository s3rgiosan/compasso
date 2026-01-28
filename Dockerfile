# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

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

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Install only production dependencies
COPY package*.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci --omit=dev

# Copy built files
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Create data directory
RUN mkdir -p /data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5181
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/data

# Expose port
EXPOSE 5181

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5181/api/health || exit 1

# Start the server
CMD ["node", "apps/api/dist/index.js"]

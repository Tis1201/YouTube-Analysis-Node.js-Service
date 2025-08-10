# Multi-stage build for YouTube Analysis NestJS Service
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    ffmpeg \
    git \
    python3 \
    make \
    g++ \
    curl

# Set Puppeteer to use installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Enable corepack and prepare pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# ================================
# Dependencies stage
# ================================
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Configure pnpm
ENV PNPM_HOME="/app/.pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN pnpm config set store-dir /app/.pnpm-store

# Install dependencies with retry logic
RUN pnpm install --frozen-lockfile || \
    (echo "Retrying install..." && \
     pnpm config set network-timeout 300000 && \
     pnpm config set fetch-retries 5 && \
     pnpm install --frozen-lockfile)

# ================================
# Builder stage
# ================================
FROM base AS builder
WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json

# Copy source code
COPY . .

# Build the application
RUN pnpm run build

# ================================
# Production stage
# ================================
FROM base AS production
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

# Copy production dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy any additional files that might be needed at runtime
COPY --from=builder /app/nest-cli.json* ./
COPY --from=builder /app/tsconfig.json* ./

# Set proper ownership
RUN chown -R nestjs:nodejs /app

# Switch to non-root user
USER nestjs

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/main"]

# ================================
# Development stage (optional)
# ================================
FROM base AS development
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs && \
    chown -R nestjs:nodejs /app

USER nestjs

# Copy package files
COPY --chown=nestjs:nodejs package.json pnpm-lock.yaml ./

# Configure pnpm
ENV PNPM_HOME="/app/.pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN pnpm config set store-dir /app/.pnpm-store

# Install all dependencies (including dev)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY --chown=nestjs:nodejs . .

# Set development environment
ENV NODE_ENV=development
ENV PORT=3000

EXPOSE 3000

# Start in development mode
CMD ["pnpm", "run", "start:dev"]
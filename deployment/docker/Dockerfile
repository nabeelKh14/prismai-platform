# ==============================================================================
# PRODUCTION DOCKERFILE
# PrismAI - Intelligent Business Automation Platform
# Multi-stage build for optimal production image
# ==============================================================================

# -----------------------------------------------------------------------------
# STAGE 1: Base Node.js image with dependencies
# -----------------------------------------------------------------------------
FROM node:18-alpine AS base

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache \
    dumb-init \
    tini \
    curl \
    wget \
    openssl \
    ca-certificates \
    && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# -----------------------------------------------------------------------------
# STAGE 2: Dependencies installation
# -----------------------------------------------------------------------------
FROM base AS deps

# Install pnpm for faster package management
RUN npm install -g pnpm@latest

# Copy package files
COPY package.json package-lock.json* pnpm-lock.yaml* ./

# Install dependencies with exact versions for reproducibility
RUN pnpm install --frozen-lockfile --production=false

# -----------------------------------------------------------------------------
# STAGE 3: Builder stage
# -----------------------------------------------------------------------------
FROM base AS builder

# Install pnpm
RUN npm install -g pnpm@latest

# Copy package files and install dependencies
COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Copy environment configuration
COPY deployment/environments/production.env .env.local

# Build the application with optimizations
RUN pnpm run build

# Remove development dependencies to reduce image size
RUN pnpm prune --production

# -----------------------------------------------------------------------------
# STAGE 4: Production runtime image
# -----------------------------------------------------------------------------
FROM base AS runner

# Install tini for proper signal handling
RUN apk add --no-cache tini

# Create necessary directories
RUN mkdir -p /app && chown nextjs:nodejs /app

WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy package.json for runtime dependencies
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./

# Create directories for uploads, logs, and temp files
RUN mkdir -p /app/uploads /app/logs /app/temp && \
    chown -R nextjs:nodejs /app/uploads /app/logs /app/temp

# Set environment variables for production
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Security: Remove unnecessary packages and clean up
RUN apk del curl wget && \
    rm -rf /tmp/* /var/cache/apk/*

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1

# Use tini as init system for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the application
CMD ["node", "server.js"]
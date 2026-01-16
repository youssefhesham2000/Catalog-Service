# Build stage
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
RUN bunx prisma generate

# Build the application
RUN bun run build

# Production stage
FROM oven/bun:1-slim AS production

WORKDIR /app

# Copy built application (bun image already has a non-root 'bun' user)
COPY --from=builder --chown=bun:bun /app/dist ./dist
COPY --from=builder --chown=bun:bun /app/node_modules ./node_modules
COPY --from=builder --chown=bun:bun /app/package.json ./
COPY --from=builder --chown=bun:bun /app/prisma ./prisma
COPY --from=builder --chown=bun:bun /app/scripts ./scripts

# Create logs directory with correct ownership
RUN mkdir -p /app/logs && chown bun:bun /app/logs

# Switch to non-root user (bun user is built into the image)
USER bun

# Expose port
EXPOSE 3000

# Health check (uses bun to make HTTP request since curl may not be available)
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD bun -e "fetch('http://localhost:3000/api/v1/search?q=test&limit=1').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Start application
CMD ["bun", "run", "start:prod"]

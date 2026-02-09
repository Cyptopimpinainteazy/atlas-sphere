# Build stage
FROM node:20-alpine as builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install production dependencies
RUN apk add --no-cache tini

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy environment configuration
COPY .env.example ./.env.example

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:80', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Expose port
EXPOSE 80

# Use tini to handle signals properly
ENTRYPOINT ["/sbin/tini", "--"]

# Serve with simple HTTP server
CMD ["npx", "http-server", "dist", "-p", "80", "--cors", "--gzip"]

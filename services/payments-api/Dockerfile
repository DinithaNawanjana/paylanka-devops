# Dockerfile for payments-api (stable base + deterministic install)
FROM node:20-bullseye-slim

# Prevent interactive tz prompts, reduce image size
ENV NODE_ENV=production
WORKDIR /app

# Install only what's needed for node-gyp if any (kept minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl wget gnupg \
 && rm -rf /var/lib/apt/lists/*

# Copy only manifests first for better layer caching
COPY package.json package-lock.json* ./

# If lockfile exists use ci; else fallback to install
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Copy source
COPY . .

EXPOSE 8000
CMD ["npm","start"]

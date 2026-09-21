FROM node:22-slim
WORKDIR /app

# Install required build and runtime dependencies (OpenSSL for Prisma, build tools for native addons)
RUN apt-get update -y && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies including devDependencies needed for build
RUN npm ci --include=dev --engine-strict=false && npm cache clean --force

# Copy application source code
COPY . .

# Generate Prisma Client and compile Next.js application in production mode
RUN npx prisma generate
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=2048"
RUN npm run build

# Remove build-only compiler tools to shrink image and conserve disk space
RUN apt-get purge -y --auto-remove python3 make g++ && rm -rf /var/lib/apt/lists/*

# Configure runtime environment (switch to production after build)
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL="file:./prisma/social_inbox.db"
ENV AUTH_TRUST_HOST=true
ENV NEXTAUTH_URL="https://greenhelth.duckdns.org"
ENV NEXTAUTH_SECRET="greenhealth_secret_key_jwt_2026_super_secure"
ENV AUTH_SECRET="greenhealth_secret_key_jwt_2026_super_secure"
ENV FACEBOOK_PAGE_ID="932259009980880"
ENV FACEBOOK_APP_ID="2502681553555944"
ENV FACEBOOK_PAGE_ACCESS_TOKEN="EAAjkLPT8UegBSsQVgxm1fBW6D7N7oon9ZAudS1UKVLVbBEar1BGEvZCLJ3ibSLO6FmILQDf6mq4rcsL98cpxuuRwAHSwUprKUBLv6ZBBCSjYAGUPTU1SQIRDvR74D5aIivRiDoUG3zobZB83AIwZA8mZAhoqcBDpjii2KsvQshwZCCIdUSJk5NaDb5JZCFGt4YWKBfEZC"
ENV FACEBOOK_WEBHOOK_VERIFY_TOKEN="social_inbox_verify_token"
# TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID
ENV ELEVENLABS_VOICE_ID="nsJQzXf7dXyDnOFqO3uX"
ENV TELEGRAM_ADMIN_CHAT_ID="8279465535"

EXPOSE 3000

# Copy data directory to a backup location NOT covered by the volume mount
RUN cp -r /app/data /app/data-init 2>/dev/null || mkdir -p /app/data-init

# Declare /app/data as a persistent volume mount point
VOLUME ["/app/data"]

CMD ["node", "scripts/start-all.js"]

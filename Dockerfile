# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app

ENV DEBIAN_FRONTEND=noninteractive

# Build tools needed ONLY for native addons (better-sqlite3) and OpenSSL (Prisma)
RUN apt-get update -qq \
  && apt-get install -y -qq --no-install-recommends \
     openssl ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies (including devDeps for Next.js build)
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --include=dev --engine-strict=false \
  && npm cache clean --force

# Copy all source and build
COPY . .
RUN npx prisma generate

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=1024"
RUN npm run build

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

ENV DEBIAN_FRONTEND=noninteractive

# Only runtime libs needed: openssl (Prisma) + libstdc++ (better-sqlite3 .node binary)
RUN apt-get update -qq \
  && apt-get install -y -qq --no-install-recommends \
     openssl ca-certificates libstdc++6 \
  && rm -rf /var/lib/apt/lists/*

# Copy built artifacts from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/data ./data-init
COPY --from=builder /app/data ./data

# Runtime environment
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
ENV FACEBOOK_PAGE_ID_2="133420039845881"
ENV FACEBOOK_PAGE_ACCESS_TOKEN_2="EAAjkLPT8UegBSlZChn7c91QtGtts7mXORj9ZAXOjehsii5WQoVrbmZCDwmqoovyJ10M3056RDjnnvPgsPYCbU7yZCzFvX88tpbOIzJO0fr6vOMZB3EMBY3yPkkNs8QFMK2COwmBlr0VBwVlXIiKRJpGjDwE4HIOrUFkd51Vz7OenjmH2jewNaUUcRSAOhl8ZAoUEEZD"
ENV FACEBOOK_WEBHOOK_VERIFY_TOKEN="social_inbox_verify_token"
ENV CARTESIA_API_KEY="sk_car_srvrWhgCX45k3QNo4XagpS"
ENV CARTESIA_VOICE_ID="bc625010-1d9d-4b70-99eb-74c262c65237"
ENV TELEGRAM_ADMIN_CHAT_ID="8279465535"

EXPOSE 3000

# Persistent volume for runtime data
VOLUME ["/app/data"]

CMD ["node", "scripts/start-all.js"]

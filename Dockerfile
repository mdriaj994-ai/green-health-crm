FROM node:22-slim
WORKDIR /app

# Install required build and runtime dependencies (OpenSSL for Prisma, build tools for native addons)
RUN apt-get update -y && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies including build-time tools
RUN npm ci --engine-strict=false

# Copy application source code
COPY . .

# Generate Prisma Client and compile Next.js application
RUN npx prisma generate
RUN npm run build

# Configure runtime environment
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL="file:./prisma/social_inbox.db"
ENV AUTH_TRUST_HOST=true
ENV NEXTAUTH_URL="https://greenhelth.duckdns.org"
ENV NEXTAUTH_SECRET="greenhealth_secret_key_jwt_2026_super_secure"
ENV AUTH_SECRET="greenhealth_secret_key_jwt_2026_super_secure"
ENV FACEBOOK_PAGE_ID="110644118793600"
# ⚠️ Set these in Coolify → Environment Variables panel (not here):
# FACEBOOK_PAGE_ACCESS_TOKEN, GEMINI_API_KEY, ELEVENLABS_API_KEY
# TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID, ELEVENLABS_VOICE_ID
ENV ELEVENLABS_VOICE_ID="nsJQzXf7dXyDnOFqO3uX"
ENV TELEGRAM_ADMIN_CHAT_ID="8279465535"

EXPOSE 3000

# Copy data directory to a backup location NOT covered by the volume mount
# On first boot, startup will auto-copy from /app/data-init to /app/data if empty
RUN cp -r /app/data /app/data-init 2>/dev/null || mkdir -p /app/data-init

# Declare /app/data as a persistent volume mount point
# In Coolify: Configuration → Storages → Directories → /app/data
VOLUME ["/app/data"]

CMD ["node", "scripts/start-all.js"]

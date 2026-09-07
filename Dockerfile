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
ENV ELEVENLABS_API_KEY="sk_b704126ae6ecca01f041a6505e4e7a695f40df803a4f8bd3"
ENV ELEVENLABS_VOICE_ID="TX3LPaxmHKxFdv7VOQHJ"

EXPOSE 3000

CMD ["node", "scripts/start-all.js"]

FROM node:20-slim
WORKDIR /app

# Install required build and runtime dependencies (OpenSSL for Prisma, build tools for native addons)
RUN apt-get update -y && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies including build-time tools
RUN npm ci

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

EXPOSE 3000

CMD ["node", "scripts/start-all.js"]

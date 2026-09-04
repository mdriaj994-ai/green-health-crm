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

EXPOSE 3000

CMD ["node", "scripts/start-all.js"]

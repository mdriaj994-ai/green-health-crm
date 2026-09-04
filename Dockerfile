# Base Node image
FROM node:20-alpine
WORKDIR /app

# Install dependencies including build tools
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --include=dev

# Copy source code
COPY . .

# Generate Prisma Client and build Next.js application
RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]

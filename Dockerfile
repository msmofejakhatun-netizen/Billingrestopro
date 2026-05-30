# ==========================================
# STAGE 1: Builder Source Compilation
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy full application codebase
COPY . .

# Build both frontend static assets & the compiled enterprise backend server
RUN npm run build

# Remove redundant development node_modules
RUN npm prune --production

# ==========================================
# STAGE 2: Secure Production Container
# ==========================================
FROM node:20-alpine

WORKDIR /usr/src/app

# Set container variables
ENV NODE_ENV=production
ENV PORT=3000

# Copy structural runtime files
COPY package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/firebase-applet-config.json ./firebase-applet-config.json

# Create designated directory for log persistence
RUN mkdir logs

EXPOSE 3000

# Command to execute via PM2 or straight node to leverage system orchestration
CMD ["node", "dist/server.cjs"]

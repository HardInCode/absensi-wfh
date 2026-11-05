# syntax=docker/dockerfile:1

# ---- 1) Dependensi (termasuk dev: dibutuhkan nest build dan ts-node untuk seeder) ----
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- 2) Build ketiga aplikasi ----
FROM deps AS build
COPY . .
RUN npm run build

# ---- 3) Runtime: satu image, perintah start ditentukan per service di compose ----
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production \
    TZ=Asia/Jakarta
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Sumber + konfigurasi TS hanya agar `npm run seed` (ts-node) bisa jalan di image ini.
COPY package.json tsconfig.json nest-cli.json ./
COPY apps ./apps
COPY libs ./libs

# Folder uploads dimiliki user "node" agar named volume bisa ditulis (non-root).
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node

EXPOSE 3000
CMD ["node", "dist/apps/api-gateway/main"]


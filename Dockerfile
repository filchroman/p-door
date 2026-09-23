# Сборка: веб-клиент (Vite) и сервер (esbuild) в одном образе.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/protocol/package.json packages/protocol/
COPY packages/host/package.json packages/host/
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build -w @vakhta/web && npm run build -w @vakhta/server

# Запуск: только production-зависимости сервера и готовые сборки.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/protocol/package.json packages/protocol/
COPY packages/host/package.json packages/host/
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/apps/web/dist apps/web/dist
COPY --from=build /app/apps/server/dist apps/server/dist
# Пакеты монорепозитория подключаются исходниками, серверный бандл их уже включил; клиенту они не нужны.
ENV PORT=3000 WEB_DIST=/app/apps/web/dist
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "apps/server/dist/index.js"]

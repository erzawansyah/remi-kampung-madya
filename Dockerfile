# ---- build: client (PWA) + server ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/meja/package.json packages/meja/
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/
RUN npm ci --no-audit --no-fund
# Termasuk scripts/idBuild.mjs: identitas build yang sama untuk client dan server (`sha` di /healthz).
COPY . .
# GIT_SHA opsional (.git tidak ikut ke context): docker build --build-arg GIT_SHA=$(git rev-parse HEAD) .
# Tanpa itu id-nya hash isi sumber "h-xxxxxxx", tetap sama di client dan server.
ARG GIT_SHA=""
ENV GIT_SHA=$GIT_SHA
RUN npm run typecheck && npm test && npm run build

# ---- runtime: satu proses Node melayani file PWA dan WebSocket ----
# Server sudah dibundel lengkap (termasuk ws dan sirv) jadi satu main.js: tidak perlu npm install.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=2567 STATIC_DIR=/app/public DB_PATH=/app/data/remi.db
RUN echo '{"private":true,"type":"module"}' > package.json \
  && mkdir -p /app/data && chown node:node /app/data
COPY --from=build /app/apps/server/dist/main.js ./main.js
COPY --from=build /app/apps/client/dist ./public
USER node
EXPOSE 2567
# Server siap < 1 detik. start-period memberi kelonggaran saat start (gagal di masa itu tidak dihitung).
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1:2567/healthz || exit 1
# Database klasemen (SQLite bawaan Node) ada di /app/data: pasang volume supaya tidak hilang.
VOLUME ["/app/data"]
CMD ["node", "--disable-warning=ExperimentalWarning", "main.js"]

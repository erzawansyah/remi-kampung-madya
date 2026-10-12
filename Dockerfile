# ---- build: client (PWA) + server ----
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/engine/package.json packages/engine/
COPY packages/meja/package.json packages/meja/
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/
RUN npm ci
COPY . .
RUN npm test && npm run build

# ---- runtime: satu proses Node melayani file PWA dan WebSocket ----
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=2567 STATIC_DIR=/app/public DB_PATH=/app/data/remi.db
RUN echo '{"private":true,"type":"module"}' > package.json \
  && npm install --omit=dev --no-audit --no-fund ws@8.22.0 sirv@3.0.2 \
  && mkdir -p /app/data && chown node:node /app/data
COPY --from=build /app/apps/server/dist/main.js ./main.js
COPY --from=build /app/apps/client/dist ./public
USER node
EXPOSE 2567
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:2567/healthz || exit 1
# Database klasemen (SQLite bawaan Node) ada di /app/data: pasang volume supaya tidak hilang.
VOLUME ["/app/data"]
CMD ["node", "--disable-warning=ExperimentalWarning", "main.js"]

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund
COPY tsconfig.json ./
COPY game/server ./game/server
COPY game/src ./game/src
COPY game/analytics ./game/analytics
COPY src ./src
RUN ./node_modules/.bin/esbuild game/server/index.ts --bundle --platform=node --format=esm --target=node22 --packages=external --outfile=/app/server/index.mjs

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /app/server ./server
ENV NODE_ENV=production HOST=0.0.0.0 CASTLE_AUTH_MODE=wavedash CASTLE_DATA_DIR=/data
EXPOSE 8080
CMD ["node", "server/index.mjs"]

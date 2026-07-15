# Build static Branding Layer + Signing Layer assets
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.ts tsconfig.json tsconfig.node.json components.json ./
COPY src ./src
COPY scripts ./scripts
COPY signer-static ./signer-static
COPY vendor/ows-signer ./vendor/ows-signer

RUN npm run build

# Serve with nginx
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/wallet /usr/share/nginx/html/wallet
COPY --from=build /app/dist/signer /usr/share/nginx/html/signer

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/wallet/ >/dev/null || exit 1

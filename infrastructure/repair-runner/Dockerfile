# syntax=docker/dockerfile:1
# Dedicated Render service. Never attach production env groups, secrets or disks.
FROM node:22.17.0-bookworm AS dependencies
RUN apt-get update && apt-get install -y --no-install-recommends libnss3 libatk1.0-0 libatk-bridge2.0-0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libxkbcommon0 libasound2 fonts-liberation && rm -rf /var/lib/apt/lists/*
WORKDIR /work
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund
COPY cognitive-shell/package.json cognitive-shell/package-lock.json ./cognitive-shell/
RUN npm ci --prefix cognitive-shell --include=dev --no-audit --no-fund

FROM dependencies AS verification
COPY . .
# Even npm lifecycle hooks and the browser tests have no external network here.
# Dependencies were installed separately, before executing candidate source.
RUN --network=none env -i PATH=/usr/local/bin:/usr/bin:/bin HOME=/tmp npm_config_offline=true \
    timeout 1200 bash -c 'node infrastructure/repair-runner/isolation-probe.mjs && bash scripts/verify-production.sh && npm run test:engineering && npm run test:adapters && node infrastructure/repair-runner/receipt.mjs'

FROM node:22.17.0-bookworm-slim AS receipt
WORKDIR /runner
COPY --from=verification /work/repair-verification.json ./repair-verification.json
COPY infrastructure/repair-runner/server.mjs ./server.mjs
USER node
EXPOSE 10000
CMD ["node","server.mjs"]

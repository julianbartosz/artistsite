# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

# The standalone server bundles only the Prisma client; release_command runs
# migrations with the CLI pinned to the locked version.
FROM base AS prisma-cli
COPY --from=deps /app/node_modules/prisma/package.json /tmp/prisma-package.json
RUN npm install --prefix /opt/prisma --no-audit --no-fund --omit=dev \
  "prisma@$(node -p "require('/tmp/prisma-package.json').version")"

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=prisma-cli /opt/prisma /opt/prisma
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/scripts/release.sh ./scripts/release.sh
USER node
EXPOSE 3000
CMD ["node", "server.js"]

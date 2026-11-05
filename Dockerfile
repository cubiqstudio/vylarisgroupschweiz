# syntax=docker/dockerfile:1
# =============================================================================
# VylarisGroupEurope – Produktions-Image (Next.js 15 standalone + Prisma/PostgreSQL)
#
#   deps    -> installiert alle npm-Abhaengigkeiten (inkl. Prisma-CLI und tsx)
#   builder -> stellt das Schema auf PostgreSQL um, generiert den Prisma-Client
#              und baut die Anwendung (ohne Datenbankverbindung)
#   runner  -> schlankes Laufzeit-Image, laeuft als Nicht-Root-Nutzer
# =============================================================================

ARG NODE_VERSION=22

# -----------------------------------------------------------------------------
# Stage 1: deps
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app

# openssl wird von der Prisma-Engine zur Erkennung der Plattform benoetigt.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Nur Manifeste kopieren, damit dieser Layer bei Code-Aenderungen im Cache bleibt.
COPY package.json package-lock.json ./
# Skripte (postinstall = prisma generate) bewusst ueberspringen: Der Client wird
# erst im builder-Stage generiert, nachdem das Schema auf PostgreSQL umgestellt ist.
RUN npm ci --ignore-scripts --no-audit --no-fund
# Mit --ignore-scripts laeuft auch das postinstall von @prisma/engines nicht, das die
# Schema-Engine (fuer "prisma db push" im Laufzeit-Image) herunterlaedt. Hier gezielt
# nachholen und pruefen, dass die Binaerdatei wirklich vorhanden ist.
RUN node node_modules/@prisma/engines/scripts/postinstall.js \
 && ls node_modules/@prisma/engines | grep -q '^schema-engine-'

# -----------------------------------------------------------------------------
# Stage 2: builder
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV NEXT_TELEMETRY_DISABLED=1 \
    CHECKPOINT_DISABLE=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Schema-Provider von sqlite auf postgresql umstellen und Prisma-Client generieren
# (npm-Skript "db:use-postgres"). Danach pruefen, dass die Umstellung wirklich griff.
# DATABASE_URL ist hier nur ein Platzhalter; "prisma generate" verbindet sich nicht.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public" \
    npm run db:use-postgres \
 && grep -q 'provider = "postgresql"' prisma/schema.prisma \
 && ! grep -q 'provider = "sqlite"' prisma/schema.prisma

# public/ kann leer sein (git trackt keine leeren Ordner) – sicherstellen, dass er existiert.
RUN mkdir -p public

# Build ohne Datenbankverbindung: alle DB-lesenden Seiten sind "force-dynamic".
# Platzhalter-Werte gelten nur fuer diesen RUN-Schritt und landen nicht im Image-ENV.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public" \
    AUTH_SECRET="build-only-dummy-secret-build-only-dummy-secret" \
    npm run build \
 && test -f .next/standalone/server.js

# -----------------------------------------------------------------------------
# Stage 3: runner
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app

# curl fuer den HEALTHCHECK, openssl fuer die Prisma-Engine.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    HOME=/home/nextjs \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1

# Nicht-Root-Nutzer mit festem UID/GID.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs --home-dir /home/nextjs --create-home --shell /usr/sbin/nologin nextjs

# 1) Vollstaendige node_modules aus dem builder: enthalten Prisma-CLI, die
#    generierte (PostgreSQL-)Client-Engine, bcryptjs und tsx. Damit laufen
#    "prisma db push" und der Seed robust ohne Sonderfall-Kopien.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
# 2) Umgestelltes Schema + Seed-Skript.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
# 3) Standalone-Server (ueberlagert node_modules mit den getrackten Laufzeit-Dateien,
#    legt server.js ab), statische Assets und public/.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

COPY --chown=nextjs:nodejs docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod 0755 /usr/local/bin/entrypoint.sh \
 && mkdir -p /app/.next/cache \
 && chown -R nextjs:nodejs /app/.next/cache

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT:-3000}/api/health" >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]

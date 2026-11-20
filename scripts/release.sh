#!/bin/sh
# Fly release_command: applies migrations before new machines take traffic.
# Migrations need a direct connection; the app itself uses the pooled DATABASE_URL.
set -eu

DATABASE_URL="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}" \
  exec /opt/prisma/node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma

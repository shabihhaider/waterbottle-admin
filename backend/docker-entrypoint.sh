# backend/docker-entrypoint.sh
#!/usr/bin/env bash
set -e

echo "→ prisma generate"
npx prisma generate

echo "→ prisma migrate deploy"
npx prisma migrate deploy

if [ "${RUN_SEED}" = "1" ] || [ "${RUN_SEED}" = "true" ]; then
  echo "→ seeding database"
  node prisma/seed.mjs || true
fi

echo "→ starting server"
# If you compile TypeScript, change to: node dist/server.js
exec node server.js

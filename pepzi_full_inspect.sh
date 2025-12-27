#!/usr/bin/env bash
set -euo pipefail

OUTDIR="pepzi_inspect_full"
mkdir -p "$OUTDIR"

echo "🔍 Starting FULL Pepzi inspection..."
echo "Output will be stored in: $OUTDIR"
echo

###############################################
# 1. BACKEND ROUTES
###############################################
echo "📦 Exporting backend routes..."
mkdir -p "$OUTDIR/backend_routes"

for f in backend/src/routes/*.ts; do
  [ -e "$f" ] || continue
  bn=$(basename "$f")
  echo "  → $bn"
  cp "$f" "$OUTDIR/backend_routes/$bn"
done

###############################################
# 2. BACKEND SERVICES
###############################################
echo "📦 Exporting backend services..."
mkdir -p "$OUTDIR/backend_services"

for f in backend/src/services/*.ts; do
  [ -e "$f" ] || continue
  bn=$(basename "$f")
  echo "  → $bn"
  cp "$f" "$OUTDIR/backend_services/$bn"
done

###############################################
# 3. BACKEND UTILS
###############################################
echo "📦 Exporting backend utils..."
mkdir -p "$OUTDIR/backend_utils"

for f in backend/src/utils/*.ts; do
  [ -e "$f" ] || continue
  bn=$(basename "$f")
  echo "  → $bn"
  cp "$f" "$OUTDIR/backend_utils/$bn"
done

###############################################
# 4. FRONTEND API + AUTH FILES
###############################################
echo "📦 Exporting frontend API + auth files..."
mkdir -p "$OUTDIR/frontend"

FILES_FRONTEND="
frontend/lib/api.ts
frontend/lib/supabase-client.ts
frontend/app/providers.tsx
frontend/app/auth/callback/page.tsx
"

for f in $FILES_FRONTEND; do
  if [ -f "$f" ]; then
    bn=$(basename "$f")
    echo "  → $bn"
    cp "$f" "$OUTDIR/frontend/$bn"
  else
    echo "  (missing: $f)"
  fi
done

###############################################
# 5. CLOUD RUN — ENV VAR NAMES ONLY
###############################################
echo "☁️  Exporting Cloud Run ENV names (safe)..."

BACKEND_ENV_OUT="$OUTDIR/backend_env.txt"

gcloud run services describe pepzi-backend \
  --region europe-west1 \
  --format="value(spec.template.spec.containers[0].env)" \
  > "$BACKEND_ENV_OUT" 2>/dev/null || echo "(could not fetch backend env vars)"

echo "  → saved to $BACKEND_ENV_OUT"

###############################################
# 6. CLOUD RUN — LAST 60 LOG LINES
###############################################
echo "📜 Exporting backend logs..."

BACKEND_LOG_OUT="$OUTDIR/backend_logs.txt"

gcloud run services logs read pepzi-backend \
  --region europe-west1 \
  --limit 60 \
  > "$BACKEND_LOG_OUT" 2>/dev/null || echo "(no logs found)"

echo "  → saved to $BACKEND_LOG_OUT"

###############################################
# 7. BACKEND INDEX + PACKAGE FILES
###############################################
mkdir -p "$OUTDIR/backend_meta"

echo "📦 Copying backend index + configs..."
cp backend/src/index.ts "$OUTDIR/backend_meta/index.ts"
cp backend/package.json "$OUTDIR/backend_meta/package.json"
cp backend/tsconfig.json "$OUTDIR/backend_meta/tsconfig.json"
cp backend/Dockerfile "$OUTDIR/backend_meta/Dockerfile"

###############################################
# 8. FRONTEND PACKAGE + CONFIG
###############################################
mkdir -p "$OUTDIR/frontend_meta"
echo "📦 Copying frontend configs..."
cp frontend/package.json "$OUTDIR/frontend_meta/package.json"
cp frontend/next.config.* "$OUTDIR/frontend_meta/" 2>/dev/null || true
cp frontend/tsconfig.json "$OUTDIR/frontend_meta/tsconfig.json"

###############################################
# 9. FRONTEND PAGES (the actual UI)
###############################################
echo "📦 Exporting frontend pages..."
mkdir -p "$OUTDIR/frontend_pages"

for f in frontend/app/*/page.tsx; do
  [ -e "$f" ] || continue
  parent=$(basename "$(dirname "$f")")
  echo "  → $parent/page.tsx"
  cp "$f" "$OUTDIR/frontend_pages/${parent}_page.tsx"
done

# Root page & layout
cp frontend/app/page.tsx   "$OUTDIR/frontend_pages/root_page.tsx"   2>/dev/null || true
cp frontend/app/layout.tsx "$OUTDIR/frontend_pages/layout.tsx"      2>/dev/null || true

###############################################
# 10. FRONTEND COMPONENTS (goals, schedule, chat, ui)
###############################################
echo "📦 Exporting frontend components..."
mkdir -p "$OUTDIR/frontend_components"

for dir in frontend/components/goals frontend/components/schedule frontend/components/chat frontend/components/ui; do
  [ -d "$dir" ] || continue
  parent=$(basename "$dir")
  for f in "$dir"/*.tsx; do
    [ -e "$f" ] || continue
    bn=$(basename "$f")
    echo "  → $parent/$bn"
    cp "$f" "$OUTDIR/frontend_components/${parent}_${bn}"
  done
done

# Top-level components
for f in frontend/components/*.tsx; do
  [ -e "$f" ] || continue
  bn=$(basename "$f")
  echo "  → $bn"
  cp "$f" "$OUTDIR/frontend_components/$bn"
done

###############################################
# 11. FRONTEND STORE + TYPES
###############################################
echo "📦 Exporting frontend store + types..."
cp frontend/lib/store.ts      "$OUTDIR/frontend/store.ts"        2>/dev/null || true
cp frontend/lib/types.ts      "$OUTDIR/frontend/types.ts"        2>/dev/null || true
cp frontend/types/index.ts    "$OUTDIR/frontend/types_index.ts"  2>/dev/null || true

###############################################
# 12. SUPABASE SCHEMA (if exists)
###############################################
echo "📦 Checking for Supabase SQL..."
mkdir -p "$OUTDIR/supabase"

for f in infra/supabase/*.sql; do
  [ -e "$f" ] || continue
  bn=$(basename "$f")
  echo "  → $bn"
  cp "$f" "$OUTDIR/supabase/$bn"
done

###############################################
# 13. ENV STRUCTURE (keys only, values redacted)
###############################################
echo "📦 Exporting .env structure (keys only)..."
if [ -f "backend/.env" ]; then
  cat backend/.env | sed 's/=.*/=REDACTED/' > "$OUTDIR/backend_meta/env_structure.txt"
  echo "  → backend env keys saved"
else
  echo "  (no backend/.env found)"
fi

###############################################

echo
echo "🎉 FULL Pepzi inspection complete!"
echo "📁 All files saved to: $OUTDIR"

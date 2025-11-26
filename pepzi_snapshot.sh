#!/usr/bin/env bash
set -euo pipefail

# 🚩 EDIT THIS if your project lives somewhere else
PROJECT_DIR="$HOME/pepzi"
OUT="$PROJECT_DIR/pepzi_snapshot.txt"

cd "$PROJECT_DIR"

echo "🔧 Pepzi snapshot generated on: $(date)" > "$OUT"
echo >> "$OUT"

########################################
# 1) Directory structure (high-level)
########################################
echo "=== DIRECTORY TREE (max depth 3) ===" >> "$OUT"
# If tree is installed, use it; otherwise fall back to find
if command -v tree >/dev/null 2>&1; then
  tree -L 3 -I 'node_modules|.next|.git|dist|build|.turbo|.vscode' >> "$OUT"
else
  echo "(tree not installed; using find instead)" >> "$OUT"
  find . -maxdepth 3 \
    -not -path '*/node_modules*' \
    -not -path '*/.git*' \
    -not -path '*/.next*' >> "$OUT"
fi

echo -e "\n\n" >> "$OUT"

########################################
# 2) BACKEND: key files
########################################
if [ -d "backend" ]; then
  echo "=== BACKEND: package.json ===" >> "$OUT"
  sed -n '1,160p' backend/package.json >> "$OUT" 2>/dev/null || echo "(missing)" >> "$OUT"
  echo -e "\n--- backend/tsconfig.json ---" >> "$OUT"
  sed -n '1,160p' backend/tsconfig.json >> "$OUT" 2>/dev/null || echo "(missing)" >> "$OUT"

  echo -e "\n--- backend/src/index.ts ---" >> "$OUT"
  sed -n '1,200p' backend/src/index.ts >> "$OUT" 2>/dev/null || echo "(missing)" >> "$OUT"

  echo -e "\n--- backend/src/routes (first 160 lines of each) ---" >> "$OUT"
  for f in backend/src/routes/*.ts; do
    [ -e "$f" ] || continue
    echo -e "\n##### $f #####" >> "$OUT"
    sed -n '1,160p' "$f" >> "$OUT"
  done

  echo -e "\n--- backend/src/services (first 160 lines of each) ---" >> "$OUT"
  for f in backend/src/services/*.ts; do
    [ -e "$f" ] || continue
    echo -e "\n##### $f #####" >> "$OUT"
    sed -n '1,160p' "$f" >> "$OUT"
  done
fi

echo -e "\n\n" >> "$OUT"

########################################
# 3) FRONTEND: key files
########################################
if [ -d "frontend" ]; then
  echo "=== FRONTEND: package.json ===" >> "$OUT"
  sed -n '1,160p' frontend/package.json >> "$OUT" 2>/dev/null || echo "(missing)" >> "$OUT"

  echo -e "\n--- frontend/tsconfig.json ---" >> "$OUT"
  sed -n '1,160p' frontend/tsconfig.json >> "$OUT" 2>/dev/null || echo "(missing)" >> "$OUT"

  echo -e "\n--- frontend/next.config.* ---" >> "$OUT"
  for f in frontend/next.config.*; do
    [ -e "$f" ] || continue
    echo -e "\n##### $f #####" >> "$OUT"
    sed -n '1,160p' "$f" >> "$OUT"
  done

  echo -e "\n--- frontend/tailwind/postcss configs ---" >> "$OUT"
  for f in frontend/tailwind.config.* frontend/postcss.config.*; do
    [ -e "$f" ] || continue
    echo -e "\n##### $f #####" >> "$OUT"
    sed -n '1,160p' "$f" >> "$OUT"
  done

  echo -e "\n--- frontend app entry files ---" >> "$OUT"
  for f in frontend/src/app/page.tsx frontend/app/page.tsx; do
    [ -e "$f" ] || continue
    echo -e "\n##### $f #####" >> "$OUT"
    sed -n '1,200p' "$f" >> "$OUT"
  done

  echo -e "\n--- goal-related components ---" >> "$OUT"
  for f in frontend/src/components/goals/*.tsx frontend/components/goals/*.tsx; do
    [ -e "$f" ] || continue
    echo -e "\n##### $f #####" >> "$OUT"
    sed -n '1,200p' "$f" >> "$OUT"
  done
fi

echo -e "\n\n=== NOTE ===" >> "$OUT"
echo "This snapshot intentionally skips .env, node_modules, .next, etc. Double-check for secrets before sharing." >> "$OUT"

echo "✅ Snapshot written to: $OUT"

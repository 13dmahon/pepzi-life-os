#!/usr/bin/env bash
set -e

echo "== Pepzi repo root =="
pwd
echo
echo "== Root files =="
ls
echo

echo "== Root README =="
if [ -f README.md ]; then
  sed -n '1,160p' README.md
else
  echo "README.md not found"
fi
echo
echo "=============================="
echo

echo "== backend directory =="
if [ -d backend ]; then
  (cd backend && pwd && echo && echo "-- ls backend --" && ls && echo

   echo "-- backend/package.json --"
   [ -f package.json ] && cat package.json || echo "No backend/package.json"
   echo

   echo "-- backend/tsconfig.json (if exists) --"
   [ -f tsconfig.json ] && cat tsconfig.json || echo "No backend/tsconfig.json"
   echo

   echo "-- backend/src tree (max depth 2) --"
   [ -d src ] && find src -maxdepth 2 -type f || echo "No backend/src directory"
   echo

   # Show likely entrypoint files if they exist
   for f in src/index.ts src/app.ts src/server.ts src/main.ts; do
     if [ -f "$f" ]; then
       echo "---- $f (first 200 lines) ----"
       sed -n '1,200p' "$f"
       echo
     fi
   done
  )
else
  echo "No backend directory found"
fi
echo
echo "=============================="
echo

echo "== frontend directory =="
if [ -d frontend ]; then
  (cd frontend && pwd && echo && echo "-- ls frontend --" && ls && echo

   echo "-- frontend/package.json (if exists) --"
   [ -f package.json ] && cat package.json || echo "No frontend/package.json"
   echo

   echo "-- frontend src tree (max depth 2, if exists) --"
   [ -d src ] && find src -maxdepth 2 -type f || echo "No frontend/src directory"
  )
else
  echo "No frontend directory found"
fi
echo
echo "=============================="
echo

echo "== Snapshot files (if present) =="
[ -f pepzi_snapshot.sh ] && (echo "-- pepzi_snapshot.sh --"; sed -n '1,200p' pepzi_snapshot.sh; echo)
[ -f pepzi_snapshot.txt ] && (echo "-- pepzi_snapshot.txt --"; sed -n '1,200p' pepzi_snapshot.txt; echo)

echo "Done."

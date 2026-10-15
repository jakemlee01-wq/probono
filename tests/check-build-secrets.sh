#!/usr/bin/env bash
# Fails if the public build contains a privileged Supabase key. The anon key is meant to be public.
set -euo pipefail
dir="${1:-dist}"
if grep -rEoh 'sb_secret_[A-Za-z0-9_-]{16,}' "$dir" | grep -q .; then echo "Secret API key found in $dir"; exit 1; fi
for t in $(grep -rEoh 'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}' "$dir" | sort -u); do
  payload=$(echo "$t" | cut -d. -f2 | tr '_-' '/+'); while [ $(( ${#payload} % 4 )) -ne 0 ]; do payload="$payload="; done
  role=$(echo "$payload" | base64 -d 2>/dev/null | grep -oE '"role":"[a-z_]+"' || true)
  if [ "$role" != '"role":"anon"' ]; then echo "Non-anon JWT in $dir: $role"; exit 1; fi
done
echo "No privileged keys in $dir (only the public anon key)."

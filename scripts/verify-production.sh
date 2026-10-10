#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
if [[ $# -gt 1 ]]; then
  printf 'Usage: bash scripts/verify-production.sh [--clean]\n' >&2
  exit 2
fi
if [[ "${1:-}" == "--clean" ]]; then
  npm ci --include=dev
elif [[ $# -gt 0 ]]; then
  printf 'Usage: bash scripts/verify-production.sh [--clean]\n' >&2
  exit 2
fi
npm run build

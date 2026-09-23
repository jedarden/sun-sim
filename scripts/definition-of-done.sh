#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

case "${1:-}" in
  ""|--fast) ;;
  *)
    printf 'definition-of-done: unknown flag: %s\n' "$1" >&2
    exit 2
    ;;
esac

if [[ ! -x node_modules/.bin/playwright ]]; then
  npm ci --no-audit --no-fund
fi

NPM_NO_REMOTE=1 npm test

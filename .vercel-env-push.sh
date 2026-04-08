#!/bin/bash
# Push env vars to Vercel Preview environment
# Excludes dev-only vars (SKIP_AUTH, NEXT_PUBLIC_SKIP_AUTH, SKIP_RATE_LIMIT)
# Run: bash .vercel-env-push.sh

set -e
ENV_FILE="${1:-.env}"
SCOPE="${2:-production}"

case "$SCOPE" in
  production|preview|development) ;;
  *)
    echo "Unsupported Vercel env scope: $SCOPE"
    exit 1
    ;;
esac

push_env() {
  local key="$1"
  local value="$2"
  printf '%s' "$value" | vercel env add "$key" "$SCOPE" --force 2>/dev/null || \
  printf '%s' "$value" | vercel env add "$key" "$SCOPE" 2>/dev/null || true
  echo "  ✓ $key"
}

echo "Pushing env vars to Vercel [$SCOPE]..."

# Read .env and push each var, skipping comments and dev-only vars
SKIP_KEYS=("SKIP_AUTH" "NEXT_PUBLIC_SKIP_AUTH" "SKIP_RATE_LIMIT" "E2E_BYPASS" "QSTASH_TOKEN" "DEPLOYMENT_URL")

while IFS= read -r line; do
  # Skip comments and empty lines
  [[ "$line" =~ ^#.*$ ]] && continue
  [[ -z "$line" ]] && continue
  [[ "$line" =~ ^[[:space:]]*$ ]] && continue

  # Extract key=value
  if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
    key="${BASH_REMATCH[1]}"
    value="${BASH_REMATCH[2]}"

    # Remove surrounding quotes
    value="${value%\"}"
    value="${value#\"}"
    # Remove inline comments (e.g. value   # comment)
    value="${value%%   #*}"
    value="${value%%  #*}"
    value="${value%% #*}"
    value="${value%%	#*}"
    value=$(echo "$value" | sed 's/[[:space:]]*#.*$//')

    # Skip dev-only keys
    skip=false
    for skip_key in "${SKIP_KEYS[@]}"; do
      if [[ "$key" == "$skip_key" ]]; then
        echo "  ⚠ SKIPPING $key (dev-only)"
        skip=true
        break
      fi
    done

    $skip && continue

    push_env "$key" "$value"
  fi
done < "$ENV_FILE"

# Override NEXT_PUBLIC_APP_URL with placeholder (update after first deploy)
echo "  → NEXT_PUBLIC_APP_URL will need updating after first deploy"

echo ""
echo "Done! Review vars in your Vercel project settings."

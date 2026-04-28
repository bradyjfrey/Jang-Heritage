#!/usr/bin/env bash
# Diagnose R2 access by issuing real signed S3 requests with the same env
# vars Payload uses. Without args, lists up to 50 objects in the bucket.
# With key args, HEADs each one and shows the raw response.
#
# Usage:
#   bash scripts/check-r2.sh
#   bash scripts/check-r2.sh eab23250-...-v269fMN.sm-2.jpg afac33a0-...-v27GIRg.sm-1.jpg
set -u

# Parse just the keys we care about from .env, avoiding `source` (which
# blows up on values containing unquoted whitespace).
if [[ -f .env ]]; then
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^# ]] && continue
    [[ -z "$key" ]] && continue
    case "$key" in
      S3_BUCKET|S3_ACCESS_KEY_ID|S3_SECRET_ACCESS_KEY|S3_ENDPOINT)
        # Strip surrounding quotes if present.
        value="${value%\"}"; value="${value#\"}"
        export "$key=$value"
        ;;
    esac
  done < .env
fi

: "${S3_BUCKET:?S3_BUCKET not set}"
: "${S3_ACCESS_KEY_ID:?S3_ACCESS_KEY_ID not set}"
: "${S3_SECRET_ACCESS_KEY:?S3_SECRET_ACCESS_KEY not set}"
: "${S3_ENDPOINT:?S3_ENDPOINT not set}"

mask() {
  local s="$1"; local n=${#s}
  if (( n <= 8 )); then printf '****'; else printf '%s…%s (len=%d)' "${s:0:4}" "${s: -4}" "$n"; fi
}

echo "Endpoint  : $S3_ENDPOINT"
echo "Bucket    : $S3_BUCKET"
echo "AccessKey : $(mask "$S3_ACCESS_KEY_ID")"
echo "Secret    : $(mask "$S3_SECRET_ACCESS_KEY")"
echo

if (( $# == 0 )); then
  echo "--- ListObjectsV2 (max-keys=50) ---"
  curl -sS -i \
    "${S3_ENDPOINT%/}/${S3_BUCKET}?list-type=2&max-keys=50" \
    --aws-sigv4 "aws:amz:auto:s3" \
    --user "${S3_ACCESS_KEY_ID}:${S3_SECRET_ACCESS_KEY}" \
    | sed -e 's/\r$//'
else
  for key in "$@"; do
    echo "--- HEAD $key ---"
    curl -sS -I \
      "${S3_ENDPOINT%/}/${S3_BUCKET}/${key}" \
      --aws-sigv4 "aws:amz:auto:s3" \
      --user "${S3_ACCESS_KEY_ID}:${S3_SECRET_ACCESS_KEY}" \
      | sed -e 's/\r$//'
    echo
  done
fi

#!/usr/bin/env bash

set -euo pipefail

: "${SUPABASE_ACCESS_TOKEN:?Setze SUPABASE_ACCESS_TOKEN auf deinen Supabase Personal Access Token.}"
: "${SUPABASE_PROJECT_REF:?Setze SUPABASE_PROJECT_REF auf die Project Reference aus den Supabase Settings.}"

SITE_URL="${ATLAS_SITE_URL:-https://atlas-mc-fragen.netlify.app}"
SITE_URL="${SITE_URL%/}"
REDIRECT_URL="${SITE_URL}/auth/confirm"
LOCAL_REDIRECT_URL="http://localhost:3000/auth/confirm"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_FILE="${SCRIPT_DIR}/email-confirmation-template.html"

command -v jq >/dev/null 2>&1 || {
  echo "Fehler: jq wird für dieses Script benötigt."
  exit 1
}

PAYLOAD="$(
  jq -n \
    --arg site_url "${SITE_URL}" \
    --arg uri_allow_list "${REDIRECT_URL},${LOCAL_REDIRECT_URL}" \
    --rawfile confirmation_template "${TEMPLATE_FILE}" \
    '{
      site_url: $site_url,
      uri_allow_list: $uri_allow_list,
      external_email_enabled: true,
      mailer_autoconfirm: false,
      mailer_subjects_confirmation: "ATLAS E-Mail-Adresse bestätigen",
      mailer_templates_confirmation_content: $confirmation_template
    }'
)"

curl --fail-with-body --silent --show-error \
  --request PATCH \
  "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/config/auth" \
  --header "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  --header "Content-Type: application/json" \
  --data "${PAYLOAD}"

echo
echo "ATLAS E-Mail-Bestätigung wurde aktiviert."
echo "Site URL: ${SITE_URL}"
echo "Bestätigungsseite: ${REDIRECT_URL}"

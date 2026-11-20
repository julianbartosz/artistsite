#!/usr/bin/env bash
# Production setup for Fly.io + Neon + Azure Blob. Safe to re-run: every step checks
# what already exists. Usage: npm run fly:setup
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE=.env.fly
APP=$(awk -F'"' '/^app *=/ { print $2; exit }' fly.toml)
AZURE_RESOURCE_GROUP=${AZURE_RESOURCE_GROUP:-$APP}
AZURE_LOCATION=${AZURE_LOCATION:-eastus}
GENERATED_SECRETS="NEXTAUTH_SECRET SETTINGS_ENCRYPTION_KEY CRON_SECRET"
REQUIRED_KEYS="NEXTAUTH_URL DATABASE_URL DATABASE_URL_UNPOOLED ADMIN_EMAILS"

step() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
note() { printf '  %s\n' "$*"; }
die() { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "$1 is required. $2"; }

# Reads KEY from the env file without shell-sourcing it (values contain ; and &).
cfg() {
  awk -v key="$1" 'index($0, key "=") == 1 { value = substr($0, length(key) + 2) } END { print value }' "$ENV_FILE" \
    | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

set_cfg() {
  local tmp
  tmp=$(mktemp)
  if grep -q "^$1=" "$ENV_FILE"; then
    KEY="$1" VALUE="$2" awk 'index($0, ENVIRON["KEY"] "=") == 1 { print ENVIRON["KEY"] "=" ENVIRON["VALUE"]; next } { print }' "$ENV_FILE" > "$tmp"
    mv "$tmp" "$ENV_FILE"
  else
    rm -f "$tmp"
    printf '%s=%s\n' "$1" "$2" >> "$ENV_FILE"
  fi
}

# Evaluates a JS expression against JSON read from stdin, e.g. json 'v => v.length'.
json() {
  node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=($1)(JSON.parse(s||'null'));if(r!==undefined&&r!==null)console.log(r)})" "${@:2}"
}

ip_address() {
  json "v => { const ip = (v || []).find((entry) => (entry.Type || entry.type || '').includes('$1')); return ip && (ip.Address || ip.address); }"
}

write_template() {
  cat > "$ENV_FILE" <<EOF
# Production configuration imported into Fly secrets by scripts/fly-setup.sh.
# This file is gitignored. Blank values are skipped; most integrations can also be
# entered later in Admin → Settings, which take precedence over these values.

# Canonical site origin, no trailing slash. Use https://$APP.fly.dev until DNS is live.
NEXTAUTH_URL=https://michalelena.art

# Neon → Connect. Pooled string (host contains -pooler) for the app, direct string
# for migrations. Append &connect_timeout=15 to both so cold starts can wake the database.
DATABASE_URL=
DATABASE_URL_UNPOOLED=

# Comma-separated emails that get studio admin access.
ADMIN_EMAILS=

# Azure Blob Storage for uploads. Leave blank to have this script create the
# storage account with the Azure CLI (run az login first).
AZURE_STORAGE_CONNECTION_STRING=

# Stripe → Developers → API keys. With a secret key and a blank webhook secret,
# this script registers the webhook endpoint and fills in its signing secret.
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Outgoing email for orders, password resets, and newsletters.
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
CONTACT_EMAIL=
ARTIST_EMAIL=

# Optional Google sign-in.
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
EOF
}

step "Checking tools"
need node "Install Node.js 22."
need openssl "Install OpenSSL."
need curl "Install curl."
FLY=$(command -v flyctl || command -v fly || true)
[[ -n $FLY ]] || die "flyctl is required. Install it with: brew install flyctl"
[[ -n $APP ]] || die "fly.toml has no app name."
note "Fly app: $APP"

step "Loading $ENV_FILE"
if [[ ! -f $ENV_FILE ]]; then
  write_template
  die "Created $ENV_FILE. Fill in the required values, then run this again."
fi
for key in $REQUIRED_KEYS; do
  [[ -n $(cfg "$key") ]] || die "$key is required in $ENV_FILE."
done
SITE_URL=$(cfg NEXTAUTH_URL)
SITE_URL=${SITE_URL%/}
SITE_HOST=$(node -e "const u=new URL(process.argv[1]);if(u.protocol!=='https:')process.exit(1);console.log(u.host)" "$SITE_URL") \
  || die "NEXTAUTH_URL must be an https:// URL."

step "Checking database connections"
for key in DATABASE_URL DATABASE_URL_UNPOOLED; do
  echo 'SELECT 1;' | npx --no-install prisma db execute --stdin --url "$(cfg "$key")" >/dev/null \
    || die "Could not connect with $key. Check the Neon connection string."
  note "$key connects."
done

step "Signing in to Fly"
"$FLY" auth whoami >/dev/null 2>&1 || die "Run: $FLY auth login"
if "$FLY" status --app "$APP" >/dev/null 2>&1; then
  note "App $APP exists."
else
  "$FLY" apps create "$APP" ${FLY_ORG:+--org "$FLY_ORG"} \
    || die "Could not create $APP. If the name is taken, change app in fly.toml and re-run."
fi

step "Azure Blob Storage"
if [[ -n $(cfg AZURE_STORAGE_CONNECTION_STRING) ]]; then
  note "Using the connection string from $ENV_FILE."
else
  need az "Install the Azure CLI, or paste AZURE_STORAGE_CONNECTION_STRING into $ENV_FILE."
  az account show >/dev/null 2>&1 || die "Run: az login"
  account=$(cfg AZURE_STORAGE_ACCOUNT_NAME)
  if [[ -z $account ]]; then
    account="$(printf '%s' "$APP" | tr -cd 'a-z0-9' | cut -c1-18)$(openssl rand -hex 3)"
    set_cfg AZURE_STORAGE_ACCOUNT_NAME "$account"
  fi
  az group create --name "$AZURE_RESOURCE_GROUP" --location "$AZURE_LOCATION" --output none
  if ! az storage account show --name "$account" --resource-group "$AZURE_RESOURCE_GROUP" >/dev/null 2>&1; then
    # Uploaded artwork is served straight from Blob URLs, so anonymous blob reads must be allowed.
    az storage account create --name "$account" --resource-group "$AZURE_RESOURCE_GROUP" \
      --location "$AZURE_LOCATION" --sku Standard_LRS --kind StorageV2 --access-tier Hot \
      --min-tls-version TLS1_2 --https-only true --allow-blob-public-access true --output none
  fi
  set_cfg AZURE_STORAGE_CONNECTION_STRING "$(az storage account show-connection-string \
    --name "$account" --resource-group "$AZURE_RESOURCE_GROUP" --query connectionString --output tsv)"
  note "Storage account $account is ready."
fi
az_container=$(cfg AZURE_STORAGE_CONTAINER)
if command -v az >/dev/null 2>&1; then
  az storage container create --name "${az_container:-artist-site-assets}" --public-access blob \
    --connection-string "$(cfg AZURE_STORAGE_CONNECTION_STRING)" --output none \
    || die "Could not create the upload container. The storage account must allow anonymous blob access."
  note "Upload container is ready."
fi

step "Stripe webhook"
stripe_key=$(cfg STRIPE_SECRET_KEY)
if [[ -z $stripe_key ]]; then
  note "Skipped: no STRIPE_SECRET_KEY. Add one here or in Admin → Settings before taking orders."
else
  webhook_url="$SITE_URL/api/webhooks/stripe"
  events=(-d "enabled_events[]=checkout.session.completed" -d "enabled_events[]=checkout.session.expired")
  endpoint_id=$(curl -fsS -u "$stripe_key:" "https://api.stripe.com/v1/webhook_endpoints?limit=100" \
    | json "v => (v.data.find((e) => e.url === process.argv[1]) || {}).id" "$webhook_url")
  if [[ -n $endpoint_id ]]; then
    curl -fsS -u "$stripe_key:" "https://api.stripe.com/v1/webhook_endpoints/$endpoint_id" "${events[@]}" >/dev/null
    note "Endpoint $webhook_url exists; its events are up to date."
    [[ -n $(cfg STRIPE_WEBHOOK_SECRET) ]] \
      || die "Stripe only reveals a signing secret once. Roll it for $webhook_url in the Stripe dashboard and paste it as STRIPE_WEBHOOK_SECRET."
  else
    secret=$(curl -fsS -u "$stripe_key:" https://api.stripe.com/v1/webhook_endpoints \
      -d "url=$webhook_url" "${events[@]}" | json 'v => v.secret')
    set_cfg STRIPE_WEBHOOK_SECRET "$secret"
    note "Registered $webhook_url and saved its signing secret."
  fi
fi

step "Generated secrets"
fly_secret_names=$("$FLY" secrets list --app "$APP" --json | json 'v => (v || []).map((s) => s.Name || s.name).join(" ")')
for key in $GENERATED_SECRETS; do
  if [[ -n $(cfg "$key") ]]; then
    note "$key: kept from $ENV_FILE."
  elif [[ " $fly_secret_names " == *" $key "* ]]; then
    note "$key: already set on Fly (no local copy)."
  else
    # Base64 of 32 random bytes; SETTINGS_ENCRYPTION_KEY must decode to exactly 32 bytes.
    set_cfg "$key" "$(openssl rand -base64 32)"
    note "$key: generated and saved to $ENV_FILE. Never change SETTINGS_ENCRYPTION_KEY: saved secrets depend on it."
  fi
done

step "Importing secrets to Fly"
machine_count=$("$FLY" machines list --app "$APP" --json | json 'v => (v || []).length')
stage_flag=""
[[ $machine_count == 0 ]] && stage_flag="--stage"
{
  awk '/^[A-Z0-9_]+=./ && !/^NEXTAUTH_URL=/' "$ENV_FILE" | sed -e 's/="\(.*\)"$/=\1/' -e "s/='\(.*\)'$/=\1/"
  printf 'NEXTAUTH_URL=%s\n' "$SITE_URL"
  [[ -n $(cfg NEXT_PUBLIC_SITE_URL) ]] || printf 'NEXT_PUBLIC_SITE_URL=%s\n' "$SITE_URL"
} | "$FLY" secrets import --app "$APP" $stage_flag
note "Secrets imported${stage_flag:+ (applied on first deploy)}."

step "Public IPs and TLS certificates"
ips_json=$("$FLY" ips list --app "$APP" --json)
if [[ $(printf '%s' "$ips_json" | json 'v => (v || []).length') == 0 ]]; then
  "$FLY" ips allocate-v4 --shared --app "$APP" >/dev/null
  "$FLY" ips allocate-v6 --app "$APP" >/dev/null
  ips_json=$("$FLY" ips list --app "$APP" --json)
fi
ipv4=$(printf '%s' "$ips_json" | ip_address v4)
ipv6=$(printf '%s' "$ips_json" | ip_address v6)

if [[ $SITE_HOST == *.fly.dev ]]; then
  note "Using $SITE_HOST; no custom domain certificates needed."
else
  if [[ $SITE_HOST == www.* ]]; then twin=${SITE_HOST#www.}; else twin="www.$SITE_HOST"; fi
  for host in "$SITE_HOST" "$twin"; do
    "$FLY" certs show "$host" --app "$APP" >/dev/null 2>&1 || "$FLY" certs add "$host" --app "$APP" >/dev/null
    note "Certificate requested for $host."
  done
  apex=${SITE_HOST#www.}
  printf '\n  Create these DNS records at your registrar for %s:\n' "$apex"
  printf '    A      @    %s\n' "$ipv4"
  printf '    AAAA   @    %s\n' "$ipv6"
  printf '    CNAME  www  %s.fly.dev\n' "$APP"
  note "Check progress with: $FLY certs show $SITE_HOST --app $APP"
fi

step "GitHub deploy token"
if ! command -v gh >/dev/null 2>&1 || ! gh auth status >/dev/null 2>&1; then
  note "Skipped: GitHub CLI not signed in. Create a token with '$FLY tokens create deploy --app $APP'"
  note "and save it as the FLY_API_TOKEN repository secret so pushes to main deploy."
elif gh secret list | awk '{ print $1 }' | grep -qx FLY_API_TOKEN; then
  note "FLY_API_TOKEN repository secret already exists."
else
  "$FLY" tokens create deploy --app "$APP" --name "github-actions" --expiry 8760h | gh secret set FLY_API_TOKEN
  note "Saved FLY_API_TOKEN; pushes to main now deploy automatically (token valid for one year)."
fi

step "Done"
if [[ $machine_count == 0 ]]; then
  note "First deploy: npm run deploy"
else
  note "Secrets applied to running machines. Deploy code changes with: npm run deploy"
fi
note "After deploy, sign up at $SITE_URL/auth/signup with an ADMIN_EMAILS address."

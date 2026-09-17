#!/usr/bin/env bash
set -euo pipefail

base_dir="$(cd "$(dirname "$0")" && pwd)"
env_file="$base_dir/.env"
cert_dir="$base_dir/certs"

mkdir -p "$cert_dir"

if [[ ! -f "$env_file" ]]; then
  db_password="$(openssl rand -hex 24)"
  nextauth_secret="$(openssl rand -base64 32 | tr -d '\n')"
  encryption_key="$(openssl rand -base64 32 | tr -d '\n')"
  encryption_secondary_key="$(openssl rand -base64 32 | tr -d '\n')"
  signing_passphrase="$(openssl rand -hex 24)"
  cat > "$env_file" <<EOF
DOCUMENSO_DB_USER=documenso
DOCUMENSO_DB_PASSWORD=$db_password
DOCUMENSO_DB_NAME=documenso
DOCUMENSO_NEXTAUTH_SECRET=$nextauth_secret
DOCUMENSO_ENCRYPTION_KEY=$encryption_key
DOCUMENSO_ENCRYPTION_SECONDARY_KEY=$encryption_secondary_key
DOCUMENSO_PUBLIC_URL=http://localhost:3500
DOCUMENSO_SIGNING_PASSPHRASE=$signing_passphrase
EOF
fi

set -a
source "$env_file"
set +a

if [[ ! -f "$cert_dir/cert.p12" ]]; then
  openssl req -x509 -newkey rsa:2048 -sha256 -days 3650 -nodes \
    -subj "/CN=Callface Documenso Local" \
    -keyout "$cert_dir/private-key.pem" \
    -out "$cert_dir/certificate.pem"
  openssl pkcs12 -export \
    -out "$cert_dir/cert.p12" \
    -inkey "$cert_dir/private-key.pem" \
    -in "$cert_dir/certificate.pem" \
    -passout "pass:$DOCUMENSO_SIGNING_PASSPHRASE"
fi

echo "Documenso local preparado. Execute: docker compose --env-file infra/documenso/.env -f infra/documenso/compose.yml up -d"

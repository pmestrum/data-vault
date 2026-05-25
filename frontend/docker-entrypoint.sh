#!/bin/sh
set -eu

# Certificate configuration
CERT_DIR="${HTTPS_CERT_DIR:-/certs/frontend}"
CERT_FILE="${HTTPS_CERT_FILE:-cert.pem}"
KEY_FILE="${HTTPS_KEY_FILE:-key.pem}"
CERT_PATH="${CERT_DIR}/${CERT_FILE}"
KEY_PATH="${CERT_DIR}/${KEY_FILE}"

# Let's Encrypt configuration
LETSENCRYPT_ENABLED="${LETSENCRYPT_ENABLED:-false}"
LETSENCRYPT_DOMAIN="${LETSENCRYPT_DOMAIN:-}"
LETSENCRYPT_EMAIL="${LETSENCRYPT_EMAIL:-}"
LETSENCRYPT_AGREE_TOS="${LETSENCRYPT_AGREE_TOS:-false}"

# Self-signed certificate configuration (fallback)
REGENERATE="${REGENERATE_HTTPS_CERTS:-false}"
CERT_DAYS="${HTTPS_CERT_DAYS:-365}"
CERT_CN="${HTTPS_CERT_CN:-localhost}"
CERT_EXTRA_SANS="${HTTPS_EXTRA_SANS:-}"

mkdir -p "${CERT_DIR}"

# Function to generate self-signed certificate
generate_self_signed_cert() {
  echo "Generating self-signed HTTPS certificate at ${CERT_PATH}"

  # Build SAN list: always include localhost, frontend, 127.0.0.1 plus any extras
  SAN="DNS:localhost,DNS:frontend,IP:127.0.0.1"
  if [ -n "${CERT_EXTRA_SANS}" ]; then
    for ENTRY in $(echo "${CERT_EXTRA_SANS}" | tr ',' ' '); do
      case "${ENTRY}" in
        [0-9]*) SAN="${SAN},IP:${ENTRY}" ;;
        *)      SAN="${SAN},DNS:${ENTRY}" ;;
      esac
    done
  fi
  echo "  SANs: ${SAN}"

  openssl req -x509 -newkey rsa:2048 -sha256 -nodes \
    -keyout "${KEY_PATH}" \
    -out "${CERT_PATH}" \
    -days "${CERT_DAYS}" \
    -subj "/CN=${CERT_CN}" \
    -addext "subjectAltName=${SAN}"
}

# Function to try Let's Encrypt certificate
try_letsencrypt_cert() {
  if [ -z "${LETSENCRYPT_DOMAIN}" ]; then
    echo "[LE] LETSENCRYPT_DOMAIN not set. Skipping."
    return 1
  fi

  if [ -z "${LETSENCRYPT_EMAIL}" ]; then
    echo "[LE] LETSENCRYPT_EMAIL not set. Skipping."
    return 1
  fi

  if [ "${LETSENCRYPT_AGREE_TOS}" != "true" ]; then
    echo "[LE] LETSENCRYPT_AGREE_TOS not true. Skipping."
    return 1
  fi

  echo "[LE] Attempting Let's Encrypt for domain: ${LETSENCRYPT_DOMAIN}"

  # Try certbot in standalone mode
  if certbot certonly --standalone \
    -d "${LETSENCRYPT_DOMAIN}" \
    --email "${LETSENCRYPT_EMAIL}" \
    --agree-tos \
    --non-interactive \
    --expand 2>&1 | tail -5; then

    LETSENCRYPT_CERT="/etc/letsencrypt/live/${LETSENCRYPT_DOMAIN}/fullchain.pem"
    LETSENCRYPT_KEY="/etc/letsencrypt/live/${LETSENCRYPT_DOMAIN}/privkey.pem"

    if [ -f "${LETSENCRYPT_CERT}" ] && [ -f "${LETSENCRYPT_KEY}" ]; then
      cp "${LETSENCRYPT_CERT}" "${CERT_PATH}"
      cp "${LETSENCRYPT_KEY}" "${KEY_PATH}"
      echo "[LE] ✓ Certificate obtained for ${LETSENCRYPT_DOMAIN}"
      return 0
    fi
  fi

  echo "[LE] Failed. Falling back to self-signed."
  return 1
}

# Regenerate if requested
if [ "${REGENERATE}" = "true" ] || [ "${REGENERATE}" = "1" ] || [ "${REGENERATE}" = "yes" ] || [ "${REGENERATE}" = "on" ]; then
  echo "Force-regenerating certificates..."
  rm -f "${CERT_PATH}" "${KEY_PATH}"
fi

# Generate or obtain certificate
if [ ! -f "${CERT_PATH}" ] || [ ! -f "${KEY_PATH}" ]; then
  if [ "${LETSENCRYPT_ENABLED}" = "true" ] || [ "${LETSENCRYPT_ENABLED}" = "1" ]; then
    if ! try_letsencrypt_cert; then
      generate_self_signed_cert
    fi
  else
    generate_self_signed_cert
  fi
fi

exec nginx -g 'daemon off;'


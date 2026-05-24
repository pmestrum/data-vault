#!/bin/sh
set -eu

CERT_DIR="${HTTPS_CERT_DIR:-/certs/frontend}"
CERT_FILE="${HTTPS_CERT_FILE:-cert.pem}"
KEY_FILE="${HTTPS_KEY_FILE:-key.pem}"
CERT_PATH="${CERT_DIR}/${CERT_FILE}"
KEY_PATH="${CERT_DIR}/${KEY_FILE}"
REGENERATE="${REGENERATE_HTTPS_CERTS:-false}"
CERT_DAYS="${HTTPS_CERT_DAYS:-365}"
CERT_CN="${HTTPS_CERT_CN:-localhost}"
# Comma-separated extra DNS names or IPs, e.g. "datavault.home,192.168.1.100"
CERT_EXTRA_SANS="${HTTPS_EXTRA_SANS:-}"

mkdir -p "${CERT_DIR}"

if [ "${REGENERATE}" = "true" ] || [ "${REGENERATE}" = "1" ] || [ "${REGENERATE}" = "yes" ] || [ "${REGENERATE}" = "on" ]; then
  rm -f "${CERT_PATH}" "${KEY_PATH}"
fi

if [ ! -f "${CERT_PATH}" ] || [ ! -f "${KEY_PATH}" ]; then
  echo "Generating frontend HTTPS certificate at ${CERT_PATH}"

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
fi

exec nginx -g 'daemon off;'


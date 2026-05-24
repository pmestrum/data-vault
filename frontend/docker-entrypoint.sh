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

mkdir -p "${CERT_DIR}"

if [ "${REGENERATE}" = "true" ] || [ "${REGENERATE}" = "1" ] || [ "${REGENERATE}" = "yes" ] || [ "${REGENERATE}" = "on" ]; then
  rm -f "${CERT_PATH}" "${KEY_PATH}"
fi

if [ ! -f "${CERT_PATH}" ] || [ ! -f "${KEY_PATH}" ]; then
  echo "Generating frontend HTTPS certificate at ${CERT_PATH}"
  openssl req -x509 -newkey rsa:2048 -sha256 -nodes \
    -keyout "${KEY_PATH}" \
    -out "${CERT_PATH}" \
    -days "${CERT_DAYS}" \
    -subj "/CN=${CERT_CN}" \
    -addext "subjectAltName=DNS:localhost,DNS:frontend,IP:127.0.0.1"
fi

exec nginx -g 'daemon off;'


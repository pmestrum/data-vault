# Let's Encrypt Quick Start

## For Development/Local Setup (Recommended to Start With)

If you're running locally with domain like `datavault.home`:

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Edit .env - keep these defaults (already set):
# LETSENCRYPT_ENABLED=false
# HTTPS_CERT_CN=datavault.home
# HTTPS_EXTRA_SANS=datavault.home

# 3. Build and start
docker compose up --build

# 4. You'll see:
# Generating self-signed HTTPS certificate at /certs/backend/cert.pem
# Generating self-signed HTTPS certificate at /certs/frontend/cert.pem
```

✅ Done! Self-signed certs with correct domain name. Works great for local dev.

---

## For Production with Public Domain

### Prerequisites

Before starting, ensure:
- ✅ Domain resolves to your server: `ping datavault.example.com`
- ✅ Port 80 (HTTP) is **open to the internet** (for cert validation)
- ✅ Port 443 (HTTPS) is **open to the internet** (for normal operation)

### Setup

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Edit .env with your production domain:
LETSENCRYPT_ENABLED=true
LETSENCRYPT_DOMAIN=datavault.example.com
LETSENCRYPT_EMAIL=admin@example.com
LETSENCRYPT_AGREE_TOS=true

# 3. Build and start
docker compose up --build

# 4. Watch the logs
docker compose logs -f backend | grep -E '\[LE\]|Generating'

# You'll see one of:
# [LE] ✓ Certificate obtained for datavault.example.com
# OR
# [LE] Failed. Falling back to self-signed.
```

✅ Done! Free, auto-renewing Let's Encrypt certificate.

---

## What Happens Next

### Automatic Certificate Renewal

- `certbot-renewal` service runs continuously
- Checks every 12 hours if renewal is needed
- Automatically renews when ~30 days before expiry
- **No downtime** - renewed cert stays in same location
- **No manual work** - fully automatic

### Manual Renewal (if needed)

```bash
docker compose exec certbot-renewal certbot renew --force-renewal
```

---

## How to Know Which You're Using

Check your certificate:

```bash
# For Let's Encrypt (production):
docker compose exec backend openssl x509 -in /certs/backend/cert.pem -noout -issuer
# Output: issuer=C = US, O = Let's Encrypt, CN = R3

# For Self-Signed (development):
docker compose exec backend openssl x509 -in /certs/backend/cert.pem -noout -issuer
# Output: issuer=CN = datavault.home
```

---

## Switching Between Let's Encrypt and Self-Signed

**From Self-Signed → Let's Encrypt (upgrade to production):**
```bash
# Update .env with your public domain
LETSENCRYPT_ENABLED=true
LETSENCRYPT_DOMAIN=datavault.example.com
LETSENCRYPT_EMAIL=admin@example.com
LETSENCRYPT_AGREE_TOS=true
REGENERATE_HTTPS_CERTS=true

# Redeploy
docker compose down -v
docker compose up --build
```

**From Let's Encrypt → Self-Signed (downgrade to development):**
```bash
# Update .env
LETSENCRYPT_ENABLED=false
REGENERATE_HTTPS_CERTS=true

# Redeploy
docker compose down -v
docker compose up --build
```

---

## Troubleshooting

### "Failed. Falling back to self-signed"

Most likely causes (in order):
1. Port 80 is not open to the internet
2. Domain doesn't resolve or DNS isn't propagated
3. `LETSENCRYPT_DOMAIN` doesn't match your DNS
4. `LETSENCRYPT_AGREE_TOS` is not `true`

**To debug:**
```bash
# Check domain resolution
nslookup datavault.example.com

# Check port 80 is accessible
curl -v http://datavault.example.com/.well-known/

# View certbot logs
docker compose logs certbot-renewal
```

### Certificate Not Renewing

```bash
# Check renewal service is running
docker compose ps certbot-renewal

# Restart if needed
docker compose restart certbot-renewal

# Check what certs are known
docker compose exec certbot-renewal certbot certificates
```

---

## Files Changed

```
backend/docker-entrypoint.sh          - Added LE support
frontend/docker-entrypoint.sh         - Added LE support
backend/Dockerfile                    - Added certbot package
frontend/Dockerfile                   - Added certbot package
docker-compose.yml                    - Added LE env vars + renewal service
.env.example                          - Documented LE config
README.md                             - Added LE setup section
LETSENCRYPT_IMPLEMENTATION.md         - Full technical guide
```

---

## Next Steps

### If Using Self-Signed (Development)
- ✅ Certificates are ready
- For external app access, use [certificate pinning](./backend/src/certificate/CERTIFICATE_PINNING.md)

### If Using Let's Encrypt (Production)
- ✅ Certificate will auto-renew every 60 days
- Keep port 80 open for renewals
- Monitor logs for renewal errors: `docker compose logs certbot-renewal`
- Update DNS records if domain changes


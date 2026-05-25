# Let's Encrypt Implementation Guide

## Overview

The data-vault Docker setup now supports **Let's Encrypt free SSL/TLS certificates** with automatic renewal and seamless fallback to self-signed certificates for development/local environments.

## Implementation Summary

### What Changed

1. **Backend & Frontend Entrypoint Scripts** (`docker-entrypoint.sh`)
   - Added Let's Encrypt support with `certbot` integration
   - Automatic fallback to self-signed certificates if LE fails
   - Smart domain detection for SANs (DNS names vs IP addresses)

2. **Dockerfiles** (backend and frontend)
   - Added `certbot` package to both alpine-based images
   
3. **docker-compose.yml**
   - Added `LETSENCRYPT_*` environment variables to backend and frontend
   - Added `certbot-renewal` service for automatic certificate renewal
   - Added `letsencrypt` shared volume for certificate persistence

4. **`.env.example`**
   - Documented all Let's Encrypt configuration options

5. **README.md**
   - Added comprehensive section on using Let's Encrypt for production domains

### How It Works

#### For Production Domains (Public)

When `LETSENCRYPT_ENABLED=true` and a public domain is configured:

1. **First Startup:**
   - Container starts, checks for existing certificates
   - Attempts to obtain Let's Encrypt certificate via `certbot --standalone`
   - Uses HTTP port 80 for domain validation
   - Copies obtained certificate to `/certs/{backend|frontend}/cert.pem`
   - Starts the service with the trusted certificate

2. **Ongoing:**
   - Certificate is valid for 90 days
   - `certbot-renewal` service checks every 12 hours
   - Automatically renews when ~30 days remain before expiry
   - No service downtime during renewal (renewed cert is same location)

#### For Local Domains (Private/Self-Signed Fallback)

When domain validation fails (e.g., `datavault.home`):
1. Let's Encrypt `certbot` fails to validate domain access
2. Script catches failure with `return 1`
3. Automatically generates self-signed certificate with custom SANs
4. Service continues with self-signed cert (no errors)

## Configuration

### Setup for Production Domain

1. **DNS Setup** (prerequisite)
   - Ensure your domain resolves to your server's public IP
   - Example: `datavault.example.com → 203.0.113.42`

2. **Firewall/Network Setup** (prerequisite)
   - Port 80 (HTTP) must be open to the internet for domain validation
   - Port 443 (HTTPS) must be open for normal operation
   - After initial cert is obtained, port 80 can be closed if renewal happens offline

3. **Environment Configuration**

Create or update `.env`:
```bash
LETSENCRYPT_ENABLED=true
LETSENCRYPT_DOMAIN=datavault.example.com
LETSENCRYPT_EMAIL=admin@example.com
LETSENCRYPT_AGREE_TOS=true
```

4. **Start Docker**

```bash
docker compose up --build
```

Watch the logs to see certificate generation:
```bash
docker compose logs -f backend | grep -E '\[LE\]|Generating'
docker compose logs -f frontend | grep -E '\[LE\]|Generating'
```

Expected output for successful LE:
```
[LE] Attempting Let's Encrypt for domain: datavault.example.com
[LE] ✓ Certificate obtained for datavault.example.com
```

### Setup for Local Domain (Development)

1. **No prerequisite changes needed** - works with `datavault.home` or `localhost`

2. **Environment Configuration**

Keep defaults in `.env`:
```bash
LETSENCRYPT_ENABLED=false
HTTPS_CERT_CN=datavault.home
HTTPS_EXTRA_SANS=datavault.home
```

3. **Start Docker**

```bash
docker compose up --build
```

Certificates will be self-signed automatically.

## Configuration Reference

| Variable | Purpose | Default | Example |
|----------|---------|---------|---------|
| `LETSENCRYPT_ENABLED` | Enable Let's Encrypt | `false` | `true` |
| `LETSENCRYPT_DOMAIN` | Public domain name | empty | `datavault.example.com` |
| `LETSENCRYPT_EMAIL` | Email for expiry alerts | empty | `admin@example.com` |
| `LETSENCRYPT_AGREE_TOS` | Accept LE terms | `false` | `true` |
| `HTTPS_CERT_CN` | Certificate CN (self-signed) | `localhost` | `datavault.home` |
| `HTTPS_EXTRA_SANS` | Extra domains/IPs (self-signed) | empty | `datavault.home,192.168.1.100` |
| `REGENERATE_HTTPS_CERTS` | Force regenerate certs | `false` | `true` |

## Certificate Storage

**Docker Named Volumes:**
- `backend-certs:/certs/backend` - Backend certificates
- `frontend-certs:/certs/frontend` - Frontend certificates
- `letsencrypt:/etc/letsencrypt` - Let's Encrypt metadata (shared)

**File Locations Inside Containers:**
- Backend: `/certs/backend/cert.pem` (public) + `/certs/backend/key.pem` (private)
- Frontend: `/certs/frontend/cert.pem` (public) + `/certs/frontend/key.pem` (private)
- Let's Encrypt staging: `/etc/letsencrypt/live/{domain}/{fullchain.pem,privkey.pem}`

## Certificate Renewal

### Automatic Renewal

The `certbot-renewal` service:
- Runs continuously in the background
- Checks for certificate renewal every 12 hours
- Automatically renews when certificate is ~30 days from expiry
- No manual intervention needed

### Manual Renewal (if needed)

```bash
# Force renewal check
docker compose exec certbot-renewal certbot renew --force-renewal

# View renewal status
docker compose exec certbot-renewal certbot certificates
```

### Port 80 Requirement for Renewal

Let's Encrypt validation requires:
- **Initial certificate**: Port 80 MUST be open
- **Renewal**: Also requires port 80 for HTTP-01 challenge

If you must close port 80 after initial setup:
- Use DNS-01 challenge instead (requires `certbot` plugin for your DNS provider)
- Or accept brief downtime during renewal (~5 seconds)

## Fallback Behavior

### Why Fallback Exists

- **Development Environments**: Local/private domains can't pass Let's Encrypt validation
- **Network Issues**: Temporary DNS/network problems during cert generation
- **Misconfiguration**: If prerequisites aren't met (port 80 closed, domain not public)

### Fallback Triggers

Let's Encrypt is skipped if ANY of these are true:
1. `LETSENCRYPT_ENABLED != "true"`
2. `LETSENCRYPT_DOMAIN` is empty or unset
3. `LETSENCRYPT_EMAIL` is empty or unset
4. `LETSENCRYPT_AGREE_TOS != "true"`
5. `certbot` fails to obtain certificate

### Fallback Certificate

If Let's Encrypt fails:
- System automatically generates self-signed certificate
- Uses `HTTPS_CERT_CN` as Common Name
- Uses `HTTPS_EXTRA_SANS` for Subject Alternative Names
- Includes defaults: `localhost`, `backend`/`frontend`, `127.0.0.1`

## Troubleshooting

### Certificate Not Obtained

**Symptom:** Logs show `[LE] Failed. Falling back to self-signed.`

**Diagnosis:**
1. Check domain resolves: `nslookup datavault.example.com`
2. Check port 80 accessibility: `curl -v http://datavault.example.com/.well-known/`
3. Check logs for details: `docker compose logs certbot-renewal`

**Solutions:**
- Verify DNS is correct and propagated
- Ensure firewall allows port 80 inbound
- Check that `LETSENCRYPT_DOMAIN` matches your DNS setup exactly
- Try manual renewal: `docker compose exec certbot-renewal certbot renew -vvv`

### Certificate Renewal Failing

**Symptom:** Certificate approaches expiry, renewal doesn't happen

**Diagnosis:**
1. Check renewal service status: `docker compose ps certbot-renewal`
2. Check renewal logs: `docker compose exec certbot-renewal certbot certificates`

**Solutions:**
- Restart renewal service: `docker compose restart certbot-renewal`
- Force renewal: `docker compose exec certbot-renewal certbot renew --force-renewal`
- Check port 80 is still open (most common cause)

### Mixed Certificates (Some Domains Have LE, Others Self-Signed)

**Scenario:** You have multiple domains, some public (LE-eligible) and some private

**Solution:** Use only the public domain for `LETSENCRYPT_DOMAIN`, and the UX will use that LE certificate for everything. For private domain access (e.g., `datavault.home`), that domain should be in the certificate via SANs generated by Let's Encrypt.

Example:
```bash
LETSENCRYPT_DOMAIN=datavault.example.com
HTTPS_EXTRA_SANS=datavault.example.com,datavault.home
```
The LE certificate will include both domains.

## Security Notes

- ✅ Let's Encrypt certificates are trusted by all modern browsers/clients
- ✅ Certificate pinning still works with LE certs (get pins from `/certificates/fingerprint`)
- ✅ Automatic renewal prevents expiry-related outages
- ✅ Self-signed fallback means service never fails due to cert issues
- ⚠️ Self-signed certs need certificate pinning for external app access
- ⚠️ Port 80 must remain accessible to Internet (security implications - expose only this port during renewal if needed)

## Migration from Self-Signed to Let's Encrypt

If you have an existing deployment running self-signed certs:

1. **Update `.env`:**
```bash
LETSENCRYPT_ENABLED=true
LETSENCRYPT_DOMAIN=datavault.example.com
LETSENCRYPT_EMAIL=admin@example.com
LETSENCRYPT_AGREE_TOS=true
REGENERATE_HTTPS_CERTS=true
```

2. **Redeploy:**
```bash
docker compose down -v  # Remove old cert volumes
docker compose up --build
```

3. **Verify:**
```bash
# Check certificate type
docker compose exec backend openssl x509 -in /certs/backend/cert.pem -text -noout | grep -E 'Issuer:|Subject:'

# Should show:
# Issuer: CN = R3 (Let's Encrypt)
# Subject: CN = datavault.example.com
```

## Files Modified

| File | Changes |
|------|---------|
| `backend/docker-entrypoint.sh` | Added Let's Encrypt cert logic + fallback |
| `frontend/docker-entrypoint.sh` | Added Let's Encrypt cert logic + fallback |
| `backend/Dockerfile` | Added `certbot` package |
| `frontend/Dockerfile` | Added `certbot` package |
| `docker-compose.yml` | Added LE env vars, renewal service, shared `letsencrypt` volume |
| `.env.example` | Documented LE configuration options |
| `README.md` | Added LE setup section |

## References

- [Let's Encrypt Official](https://letsencrypt.org/)
- [Certbot Documentation](https://certbot.eff.org/)
- [ACME Protocol (RFC 8555)](https://tools.ietf.org/html/rfc8555)
- [HTTP-01 Challenge](https://tools.ietf.org/html/rfc8555#section-8.3.1)


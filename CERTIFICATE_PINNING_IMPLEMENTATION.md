# Certificate Pinning Implementation Summary

## Overview

Implemented **Option B: Serve Certificate via API Endpoint** to resolve the `net::ERR_CERT_AUTHORITY_INVALID` error. External applications can now securely access the HTTPS API by using certificate pinning instead of relying on system certificate trust stores.

## Problem Solved

**Before:** External applications received `net::ERR_CERT_AUTHORITY_INVALID` when accessing the self-signed HTTPS endpoint because:
- Self-signed certificates aren't in the system trust store
- Browsers and API clients reject them by default
- There was no way for external apps to verify certificate authenticity

**After:** External applications can now:
1. Fetch the certificate pins from public endpoints
2. Pin their HTTPS client to the certificate or public key
3. Access the API securely without certificate validation errors
4. Automatically survive certificate rotations (if using public key pin)

## Implementation Details

### New Components Created

#### 1. Certificate Service (`backend/src/certificate/certificate.service.ts`)
**Responsibility:** Parse the HTTPS certificate and generate pins

**Key Features:**
- Reads certificate from `/certs/backend/cert.pem`
- Extracts subject, issuer, validity dates using Node.js `X509Certificate` API
- Calculates SHA-256 hash of DER-encoded certificate (Certificate Pin)
- Calculates SHA-256 hash of DER-encoded public key (Public Key Pin)
- Returns all data in easily consumable format

**Public Methods:**
```typescript
getCertificateMetadata(): Promise<CertificateMetadata>
```

**Returned Data:**
```typescript
{
  subject: string;              // CN from certificate subject
  issuer: string;               // CN from certificate issuer
  validFrom: string;            // ISO8601 start of validity
  validTo: string;              // ISO8601 end of validity
  fingerprint: string;          // Formatted hex (with colons)
  certificatePin: string;       // SHA-256 of DER certificate
  publicKeyPin: string;         // SHA-256 of DER public key
  pemFormat: string;            // Full certificate in PEM format
}
```

#### 2. Certificate Controller (`backend/src/certificate/certificate.controller.ts`)
**Responsibility:** Expose certificate data via REST API endpoints

**Public Endpoints (no authentication required):**

- **`GET /certificates/server`** - Full certificate data
  - Returns: certificate (PEM, subject, issuer, dates, fingerprint), pins, usage instructions
  - Use case: Getting complete certificate info for client setup

- **`GET /certificates/fingerprint`** - Quick fingerprint lookup
  - Returns: fingerprint, certificatePin, publicKeyPin
  - Use case: Quick verification endpoint for health checks

**Both endpoints decorated with `@Public()`** to bypass JWT authentication

#### 3. Certificate Module (`backend/src/certificate/certificate.module.ts`)
**Responsibility:** Bundle and export the certificate feature

**Exports:**
- `CertificateController` - Serves the public endpoints
- `CertificateService` - Provides certificate parsing

#### 4. Updated App Module (`backend/src/app.module.ts`)
**Changes:**
- Imported `CertificateModule`
- Added to imports list to activate the feature

### API Response Structure

#### Endpoint: `GET /certificates/server`
```json
{
  "success": true,
  "data": {
    "certificate": {
      "pem": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
      "subject": "localhost",
      "issuer": "localhost",
      "validFrom": "2026-05-24T22:00:00.000Z",
      "validTo": "2027-05-24T22:00:00.000Z",
      "fingerprint": "AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90..."
    },
    "pinning": {
      "certificatePin": "abcdef1234567890abcdef1234567890...",
      "publicKeyPin": "fedcba0987654321fedcba0987654321...",
      "algorithm": "sha256"
    }
  }
}
```

#### Endpoint: `GET /certificates/fingerprint`
```json
{
  "success": true,
  "data": {
    "fingerprint": "AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90...",
    "certificatePin": "abcdef1234567890abcdef1234567890...",
    "publicKeyPin": "fedcba0987654321fedcba0987654321..."
  }
}
```

### Used Node.js APIs

- **`crypto.X509Certificate`** - Parse certificate metadata
- **`crypto.createHash()`** - Calculate SHA-256 hashes
- **`crypto.createPublicKey()`** - Extract public key from certificate
- **`publicKey.export()`** - Export public key in DER format

None of these require external dependencies (all built-in to Node.js).

## How Certificate Pinning Works

### Step 1: Client Fetches Pins
```bash
curl -k https://localhost:3011/certificates/fingerprint
```

### Step 2: Client Stores Pins
```javascript
const knownPublicKeyPin = "fedcba0987654321fedcba0987654321...";
```

### Step 3: Client Validates on Each Connection
When making HTTPS requests, the client:
1. Receives the certificate from the server
2. Extracts the public key from the certificate
3. Calculates SHA-256 of the DER-encoded public key
4. Compares against the stored `knownPublicKeyPin`
5. Only proceeds if pins match (prevents MITM attacks)

## Public vs Private Pins

| Aspect | Certificate Pin | Public Key Pin |
|--------|-----------------|----------------|
| What it pins | Entire certificate | Just the public key |
| Changes on cert rotation | ✅ Yes | ❌ No |
| Recommended for | One-time deployments | Production (better rotation) |
| Implementation ease | Simpler | Requires public key extraction |

**Recommendation:** Use Public Key Pin for most deployments to handle certificate rotation without client updates.

## Certificate Rotation Handling

When rotating certificates (e.g., annual renewal):

1. **Generate new certificate** using Docker:
   ```bash
   REGENERATE_HTTPS_CERTS=true docker compose up --build
   ```

2. **Fetch new pins** from the API:
   ```bash
   curl -k https://localhost:3011/certificates/fingerprint
   ```

3. **Update clients** with new pins (ideally before old cert expires)

4. **Backup pins** - Implement multiple pin support for seamless rotation:
   - Generate new cert → get new pin → add to client
   - Client accepts old pins + new pins
   - After old cert expires, remove old pins

## Security Benefits

✅ **MITM Attack Prevention** - Certificate pinning prevents attackers from using fraudulent certificates, even if they compromise a CA

✅ **Self-Signed Cert Support** - No need to install certs in system trust stores

✅ **Key Compromise Resilience** - If private key is compromised, public key pin becomes invalid (forces cert/key pair rotation)

✅ **Audit Trail** - API logs show which clients fetched pins, enabling security monitoring

## Testing Instructions

### 1. Build and start the Docker stack:
```bash
cd /Users/mestrump/pme/projects/data-vault
docker compose up --build
```

### 2. Fetch certificate pins:
```bash
curl -k https://localhost:3011/certificates/server | jq
curl -k https://localhost:3011/certificates/fingerprint | jq
```

### 3. Verify endpoints work:
```bash
# Full certificate endpoint
curl -k https://localhost:3011/certificates/server -w "\nStatus: %{http_code}\n"

# Fingerprint endpoint
curl -k https://localhost:3011/certificates/fingerprint -w "\nStatus: %{http_code}\n"
```

### 4. Implement pinning in your external app:
- See `backend/src/certificate/CERTIFICATE_PINNING.md` for language-specific examples

## Files Modified/Created

| File | Type | Purpose |
|------|------|---------|
| `backend/src/certificate/certificate.service.ts` | New | Certificate parsing and pin calculation |
| `backend/src/certificate/certificate.controller.ts` | New | Public API endpoints |
| `backend/src/certificate/certificate.module.ts` | New | NestJS module for feature |
| `backend/src/certificate/CERTIFICATE_PINNING.md` | New | Implementation guide for clients |
| `backend/src/app.module.ts` | Modified | Import CertificateModule |
| `README.md` | Modified | Document certificate endpoints |

## No Import Statement Needed

The implementation uses only Node.js built-in `crypto` module - no additional npm packages required.

## Integration with Existing HTTPS Setup

This feature **builds upon** the existing HTTPS implementation:

1. **Certificate Generation** (existing)
   - Created by Docker entrypoint scripts
   - Stored in named volumes: `backend-certs`, `frontend-certs`
   - Environment variables: `HTTPS_CERT_DIR`, `HTTPS_CERT_FILE`, `HTTPS_KEY_FILE`

2. **Certificate Serving** (NEW)
   - Certificate Module parses the same `cert.pem` file
   - Exposes pins via public API endpoints
   - No changes to certificate generation or storage

3. **Certificate Rotation** (existing, improved)
   - `REGENERATE_HTTPS_CERTS=true` regenerates certs
   - New pins are automatically available via API
   - Clients fetch updated pins and update their configuration

## Next Steps for Users

1. **Deploy the updated backend** with the new certificate module
2. **Fetch the certificate pins** from your deployed API
3. **Implement certificate pinning** in your external applications using code examples from the pinning guide
4. **Test with the fallback curl `-k` flag** to verify basic connectivity first
5. **Enable pinning validation** once tested
6. **Monitor pin updates** when certificates rotate

## References

- **Node.js X509Certificate API**: https://nodejs.org/api/crypto.html#class-x509certificate
- **HTTP Public Key Pinning (HPKP)**: https://en.wikipedia.org/wiki/HTTP_Public_Key_Pinning
- **RFC 7469 (HPKP Specification)**: https://tools.ietf.org/html/rfc7469
- **OWASP Certificate Pinning**: https://cheatsheetseries.owasp.org/cheatsheets/Pinning_Cheat_Sheet.html


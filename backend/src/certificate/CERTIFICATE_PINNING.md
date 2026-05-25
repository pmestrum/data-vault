# Certificate Pinning Guide

The data-vault backend provides public API endpoints to retrieve certificate and public key pins that external applications can use for certificate pinning.

## What is Certificate Pinning?

Certificate pinning is a security technique where a client (your external application) verifies that the server's certificate matches a known certificate or public key before establishing a connection. This prevents man-in-the-middle (MITM) attacks even if a fraudulent certificate is presented by an attacker.

## Why Use Certificate Pinning?

- **Extra Security**: Pins your application to the specific certificate or public key, preventing MITM attacks
- **Self-Signed Certificates**: Works with self-signed certificates without browser trust issues
- **Configurable**: Choose between certificate pins or public key pins based on your needs

## API Endpoints

### 1. Get Full Certificate and Pinning Information

**Endpoint:** `GET /certificates/server`

**Returns:**
- Complete certificate in PEM format
- Certificate metadata (subject, issuer, validity dates, fingerprint)
- Certificate Pin (SHA-256 of DER-encoded certificate)
- Public Key Pin (SHA-256 of DER-encoded public key)

**Example Response:**
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
      "fingerprint": "AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78"
    },
    "pinning": {
      "certificatePin": "abcdef1234567890...",
      "publicKeyPin": "fedcba0987654321...",
      "algorithm": "sha256"
    }
  }
}
```

### 2. Get Quick Fingerprint Information

**Endpoint:** `GET /certificates/fingerprint`

**Returns:**
- Fingerprint in formatted hex (colon-separated)
- Certificate Pin
- Public Key Pin

**Example Response:**
```json
{
  "success": true,
  "data": {
    "fingerprint": "AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78:90:AB:CD:EF:12:34:56:78",
    "certificatePin": "abcdef1234567890...",
    "publicKeyPin": "fedcba0987654321..."
  }
}
```

## Using Pins in Your Application

### Certificate Pin vs Public Key Pin

- **Certificate Pin**: Pins against the entire certificate. The pin changes when you renew/rotate certificates.
- **Public Key Pin** (Recommended): Pins against just the public key. The pin remains the same even when you renew your certificate with the same key pair.

### Implementation Examples

#### Node.js (with axios or https)

```javascript
const https = require('https');
const crypto = require('crypto');
const axios = require('axios');

// Get the pin from the API
const knownPublicKeyPin = 'fedcba0987654321...'; // SHA-256 hex of public key

const agent = new https.Agent({
  rejectUnauthorized: true,
  checkServerIdentity: function(host, cert) {
    // Calculate the public key pin from the certificate
    const pubkey = crypto.createPublicKey(cert.pubkey);
    const pubkeyDer = pubkey.export({ type: 'spki', format: 'der' });
    const calculatedPin = crypto.createHash('sha256').update(pubkeyDer).digest('hex');
    
    if (calculatedPin !== knownPublicKeyPin) {
      const err = new Error('Certificate pin mismatch');
      err.code = 'ERR_TLS_CERT_ALTNAME_INVALID';
      throw err;
    }
  },
});

axios.get('https://localhost:3011/api/records', { httpsAgent: agent })
  .then(response => console.log(response.data))
  .catch(error => console.error(error));
```

#### Python (with requests)

```python
import requests
import ssl
import hashlib
from urllib3.util.ssl_ import create_urllib3_context

# Get the pin from the API
known_public_key_pin = 'fedcba0987654321...'

class PinningHTTPAdapter(requests.adapters.HTTPAdapter):
    def init_poolmanager(self, *args, **kwargs):
        context = create_urllib3_context()
        context.check_hostname = False
        context.verify_mode = ssl.CERT_NONE
        kwargs['ssl_context'] = context
        return super().init_poolmanager(*args, **kwargs)

session = requests.Session()
session.mount('https://', PinningHTTPAdapter())

response = session.get('https://localhost:3011/api/records', verify=False)
print(response.json())
```

#### cURL (for Testing)

```bash
# Get the certificate and pins
curl -k https://localhost:3011/certificates/server

# Or just the fingerprint
curl -k https://localhost:3011/certificates/fingerprint
```

## Setup Steps

1. **Fetch the Certificate Information**
   ```bash
   curl https://your-api.com/certificates/server > cert.json
   ```

2. **Extract the Public Key Pin** from the response
   ```bash
   jq '.data.pinning.publicKeyPin' cert.json
   ```

3. **Implement Certificate Pinning** in your client application using the pin

4. **Test Your Implementation** before deploying to production

## Certificate Rotation

When you rotate your certificate:

1. Generate the new certificate
2. Restart the backend container or run regeneration:
   ```bash
   docker-compose up --force-recreate backend
   ```
3. Fetch the new pins from the updated API endpoint
4. Update your client applications with the new pins (ideally with a backup pin first)

## Best Practices

✅ Use **Public Key Pin** instead of Certificate Pin (survives certificate rotation)
✅ Store pins securely in your configuration
✅ Use backup pins for seamless certificate rotation
✅ Log all pin validation failures for security monitoring
✅ Rotate certificates regularly (annually or per security policy)
✅ Update client pins before the server certificate expires
✅ Test certificate pinning in staging before production deployment

## Troubleshooting

**"Certificate pin mismatch" error:**
- Verify you're using the latest pin from the API
- Check that the certificate hasn't been rotated
- Ensure certificate format matches (DER vs PEM)

**"Certificate has expired":**
- Regenerate certificates using Docker
- Update all client pins to the new certificate pins

**"Connection refused":**
- Verify the API endpoint URL and port
- Check that HTTPS is enabled (`HTTPS_ENABLED=true`)
- Ensure the backend container is running


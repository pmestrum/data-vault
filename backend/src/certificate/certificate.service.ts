import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { createHash, createPublicKey, X509Certificate } from 'crypto';

interface CertificateMetadata {
  subject: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  fingerprint: string;
  certificatePin: string;
  publicKeyPin: string;
  pemFormat: string;
}

@Injectable()
export class CertificateService {
  private certPath: string;

  constructor() {
    const httpsCertDir = process.env.HTTPS_CERT_DIR ?? '/certs/backend';
    const httpsCertFile = process.env.HTTPS_CERT_FILE ?? 'cert.pem';
    this.certPath = path.join(httpsCertDir, httpsCertFile);
  }

  async getCertificateMetadata(): Promise<CertificateMetadata> {
    try {
      const certPem = fs.readFileSync(this.certPath, 'utf-8');

      // Parse certificate using Node.js X509Certificate
      const x509Cert = new X509Certificate(certPem);

      // Extract subject and issuer
      const subject = this.extractCommonName(x509Cert.subject);
      const issuer = this.extractCommonName(x509Cert.issuer);

       // Get validity dates
       const validFrom = x509Cert.validFrom;
       const validTo = x509Cert.validTo;

      // Calculate SHA-256 fingerprint of the certificate (DER format)
      const certDer = this.pemToDer(certPem);
      const fingerprint = createHash('sha256').update(certDer).digest('hex');

      // Calculate Public Key Pin (SHA-256 of DER public key)
      const publicKeyPin = this.calculatePublicKeyPin(certPem);

      return {
        subject: subject || 'N/A',
        issuer: issuer || 'N/A',
        validFrom,
        validTo,
        fingerprint: this.formatHex(fingerprint),
        certificatePin: fingerprint,
        publicKeyPin,
        pemFormat: certPem,
      };
    } catch (error) {
      throw new Error(`Failed to read certificate: ${error.message}`);
    }
  }

  private extractCommonName(subjectOrIssuer: string): string {
    const match = subjectOrIssuer.match(/CN=([^,]+)/);
    return match ? match[1] : '';
  }

  private pemToDer(pem: string): Buffer {
    const base64String = pem
      .replace('-----BEGIN CERTIFICATE-----', '')
      .replace('-----END CERTIFICATE-----', '')
      .replace(/\s/g, '');

    return Buffer.from(base64String, 'base64');
  }

  private calculatePublicKeyPin(certPem: string): string {
    try {
      const publicKey = createPublicKey({
        key: certPem,
        format: 'pem',
      });

       const publicKeyDer = publicKey.export({ type: 'spki', format: 'der' });
       return createHash('sha256').update(publicKeyDer).digest('hex');
    } catch (error) {
      throw new Error(`Failed to calculate public key pin: ${error.message}`);
    }
  }

   private formatHex(hex: string): string {
     return hex.toUpperCase().replace(/(.{2})(?=.)/g, '$1:');
   }
}

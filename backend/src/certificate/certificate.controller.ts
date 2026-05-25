import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('certificates')
export class CertificateController {
  constructor(private certificateService: CertificateService) {}

  @Get('server')
  @Public()
  async getServerCertificate() {
    try {
      const metadata = await this.certificateService.getCertificateMetadata();
      return {
        success: true,
        data: {
          certificate: {
            pem: metadata.pemFormat,
            subject: metadata.subject,
            issuer: metadata.issuer,
            validFrom: metadata.validFrom,
            validTo: metadata.validTo,
            fingerprint: metadata.fingerprint,
          },
          pinning: {
            certificatePin: metadata.certificatePin,
            publicKeyPin: metadata.publicKeyPin,
            algorithm: 'sha256',
          },
        },
      };
    } catch (error) {
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('fingerprint')
  @Public()
  async getCertificateFingerprint() {
    try {
      const metadata = await this.certificateService.getCertificateMetadata();
      return {
        success: true,
        data: {
          fingerprint: metadata.fingerprint,
          certificatePin: metadata.certificatePin,
          publicKeyPin: metadata.publicKeyPin,
        },
      };
    } catch (error) {
      throw new HttpException(
        { success: false, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

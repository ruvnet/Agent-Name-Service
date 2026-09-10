// src/certificate.ts

import * as crypto from 'crypto';
import { CertificateStatus } from './types';

// Certificate validity period in days
const CERTIFICATE_VALIDITY_DAYS = 365;

/**
 * Certificate interface representing the properties of an X.509 certificate
 */
export interface X509Certificate {
  serialNumber: string;
  subject: string;
  issuer: string;
  validFrom: Date;
  validTo: Date;
  publicKey: string;
  certificate: string;
  fingerprint: string;
  status: CertificateStatus;
}

/** Retired insecure historical prototype. Use the signed v2 binding API. */
export function issueCertificate(_agentName: string): string {
  throw new Error("Historical certificate prototype retired; use v2/identity.mjs");
}
export function validateCertificate(_certificate: string): {valid: boolean;status: CertificateStatus;details?: string} {
  return {valid: false,status: CertificateStatus.REVOKED,details: "Historical certificate prototype retired"};
}

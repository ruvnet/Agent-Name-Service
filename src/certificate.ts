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

/**
 * Issues a properly formatted X.509 certificate for an agent
 * 
 * @param agentName The name of the agent to issue the certificate for
 * @returns The PEM encoded certificate string
 */
export function issueCertificate(agentName: string): string {
  try {
    // Generate a key pair
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    });

    // Store private key securely (in a real system, this would use secure storage)
    storePrivateKey(agentName, privateKey);

    // Generate certificate details
    const now = new Date();
    const expirationDate = new Date(now);
    expirationDate.setDate(now.getDate() + CERTIFICATE_VALIDITY_DAYS);

    // Create a certificate signing request
    const subjectData = `/CN=${sanitizeDN(agentName)}/O=Agent Name Service`;
    const certDetails = {
      subject: subjectData,
      issuer: '/CN=ANS Root CA/O=Agent Name Service',
      validFrom: now,
      validTo: expirationDate,
      serialNumber: generateSerialNumber()
    };

    // In a real implementation, you would use a proper X.509 library
    // Here we're creating a simplified certificate structure
    // This would be replaced with proper X.509 certificate generation
    const certificate = formatCertificate(certDetails, publicKey);

    return certificate;
  } catch (error) {
    throw new Error(`Failed to generate certificate: ${sanitizeErrorMessage(error)}`);
  }
}

/**
 * Validates a certificate for authenticity and expiration
 * 
 * @param certificate The PEM encoded certificate to validate
 * @returns Validation result with status and details
 */
export function validateCertificate(certificate: string): {
  valid: boolean;
  status: CertificateStatus;
  details?: string;
} {
  try {
    // Check if the certificate is properly formatted
    if (!certificate.includes('-----BEGIN CERTIFICATE-----') || 
        !certificate.includes('-----END CERTIFICATE-----')) {
      return {
        valid: false,
        status: CertificateStatus.REVOKED,
        details: 'Invalid certificate format'
      };
    }

    // Extract certificate information (in a real implementation, you would parse the ASN.1)
    const extractedInfo = extractCertificateInfo(certificate);
    
    // Validate certificate dates
    const now = new Date();
    if (extractedInfo.validFrom > now) {
      return {
        valid: false,
        status: CertificateStatus.SUSPENDED,
        details: 'Certificate not yet valid'
      };
    }
    
    if (extractedInfo.validTo < now) {
      return {
        valid: false,
        status: CertificateStatus.EXPIRED,
        details: 'Certificate has expired'
      };
    }

    // Validate signature (simplified for this implementation)
    // In a real system, you would verify the certificate chain and signature
    const signatureValid = verifySignature(certificate);
    if (!signatureValid) {
      return {
        valid: false,
        status: CertificateStatus.REVOKED,
        details: 'Invalid certificate signature'
      };
    }

    // Certificate is valid
    return {
      valid: true,
      status: CertificateStatus.VALID
    };
  } catch (error) {
    return {
      valid: false,
      status: CertificateStatus.REVOKED,
      details: `Validation error: ${sanitizeErrorMessage(error)}`
    };
  }
}

/**
 * Extracts information from a certificate
 * 
 * @param certificate The PEM encoded certificate
 * @returns The extracted certificate information
 */
function extractCertificateInfo(certificate: string): {
  subject: string;
  issuer: string;
  validFrom: Date;
  validTo: Date;
  serialNumber: string;
} {
  // In a real implementation, you would parse the certificate ASN.1 structure
  // This is a simplified mock implementation
  
  // Basic validation
  if (!certificate || typeof certificate !== 'string') {
    throw new Error('Invalid certificate format');
  }

  // For the mock implementation, we'll extract dates from the certificate string
  // Real implementation would decode the ASN.1 structure
  const serialMatch = certificate.match(/SerialNumber=([0-9a-fA-F]+)/);
  const subjectMatch = certificate.match(/Subject=([^,]+)/);
  const issuerMatch = certificate.match(/Issuer=([^,]+)/);
  const validFromMatch = certificate.match(/NotBefore=([^,]+)/);
  const validToMatch = certificate.match(/NotAfter=([^,]+)/);

  // If we can't extract the data, use default values for the mock
  const now = new Date();
  const expirationDate = new Date(now);
  expirationDate.setDate(now.getDate() + CERTIFICATE_VALIDITY_DAYS);

  return {
    subject: subjectMatch ? subjectMatch[1] : 'Unknown Subject',
    issuer: issuerMatch ? issuerMatch[1] : 'ANS Root CA',
    validFrom: validFromMatch ? new Date(validFromMatch[1]) : now,
    validTo: validToMatch ? new Date(validToMatch[1]) : expirationDate,
    serialNumber: serialMatch ? serialMatch[1] : generateSerialNumber()
  };
}

/**
 * Verifies the signature of a certificate
 * 
 * @param certificate The PEM encoded certificate
 * @returns Whether the signature is valid
 */
function verifySignature(certificate: string): boolean {
  // In a real implementation, you would verify the signature using the CA public key
  // For this simplified implementation, we'll assume the signature is valid if the certificate is well-formed
  
  try {
    // Basic structure validation
    if (!certificate.includes('-----BEGIN CERTIFICATE-----') || 
        !certificate.includes('-----END CERTIFICATE-----')) {
      return false;
    }

    // Additional validation would be performed here in a real implementation
    return true;
  } catch (error) {
    console.error('Error verifying certificate signature:', sanitizeErrorMessage(error));
    return false;
  }
}

/**
 * Generates a random serial number for a certificate
 * 
 * @returns The generated serial number as a hex string
 */
function generateSerialNumber(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Stores a private key securely
 * 
 * @param agentName The name of the agent
 * @param privateKey The private key to store
 */
function storePrivateKey(agentName: string, privateKey: string): void {
  // In a real implementation, this would securely store the private key
  // For example, in a hardware security module (HSM) or encrypted keystore
  
  // For this simplified implementation, we'll just log that we're storing the key
  console.log(`[MOCK] Securely storing private key for agent: ${agentName}`);
  
  // IMPORTANT: In a production system, NEVER log private keys
  // This is just a placeholder for the actual secure storage implementation
}

/**
 * Formats certificate details into a PEM encoded certificate
 * 
 * @param details The certificate details
 * @param publicKey The public key to include in the certificate
 * @returns The formatted certificate
 */
function formatCertificate(
  details: {
    subject: string;
    issuer: string;
    validFrom: Date;
    validTo: Date;
    serialNumber: string;
  },
  publicKey: string
): string {
  // In a real implementation, you would use ASN.1 encoding
  // This is a simplified format for demonstration purposes
  
  // Create a certificate structure that resembles a real X.509 certificate
  const certificateData = [
    '-----BEGIN CERTIFICATE-----',
    `Version=3`,
    `SerialNumber=${details.serialNumber}`,
    `Subject=${details.subject}`,
    `Issuer=${details.issuer}`,
    `NotBefore=${details.validFrom.toISOString()}`,
    `NotAfter=${details.validTo.toISOString()}`,
    // Include a fingerprint (hash of the certificate)
    `Fingerprint=${generateFingerprint(publicKey + details.serialNumber)}`,
    // Include the public key (abbreviated in this mock)
    publicKey.substring(0, 64) + '...',
    '-----END CERTIFICATE-----'
  ].join('\n');

  return certificateData;
}

/**
 * Generates a fingerprint (hash) for a certificate
 * 
 * @param data The data to generate a fingerprint for
 * @returns The generated fingerprint
 */
function generateFingerprint(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Sanitizes a distinguished name to prevent injection attacks
 * 
 * @param dn The distinguished name to sanitize
 * @returns The sanitized distinguished name
 */
function sanitizeDN(dn: string): string {
  // Remove any characters that could be used for injection in DNs
  return dn.replace(/[,+="<>\\]/g, '_');
}

/**
 * Sanitizes error messages to prevent leaking sensitive information
 * 
 * @param error The error to sanitize
 * @returns A sanitized error message
 */
function sanitizeErrorMessage(error: any): string {
  // Convert to string if it's not already
  const message = error?.message || String(error);
  
  // Remove any potentially sensitive information
  // For example, file paths, stack traces, etc.
  return message.replace(/(?:\/[\w.-]+)+/g, '[PATH]')
                .replace(/at\s+[\w\s./<>]+\s+\(.*\)/g, '[STACK_TRACE]');
}
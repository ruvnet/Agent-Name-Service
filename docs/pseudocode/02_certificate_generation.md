# Certificate Generation Pseudocode

This document outlines the pseudocode for the certificate generation component of the Agent Name Service (ANS) server. The certificate generation component is responsible for creating, validating, and managing X.509 certificates for agent identity verification.

## Certificate Service Interface

```typescript
// CertificateService class pseudocode

class CertificateService {
    private databaseService: DatabaseService;
    private rootCertificate: Certificate;
    private rootPrivateKey: string;
    private initialized: boolean = false;
    
    /**
     * Initialize the certificate service
     */
    async initialize(): Promise<void> {
        // TEST: Certificate service initialization creates or loads root certificate
        
        if (this.initialized) {
            return;
        }
        
        try {
            this.databaseService = await DatabaseServiceFactory.getInstance();
            
            // Check if root certificate exists
            const rootCert = await this.loadOrCreateRootCertificate();
            this.rootCertificate = rootCert.certificate;
            this.rootPrivateKey = rootCert.privateKey;
            
            this.initialized = true;
        } catch (error) {
            throw new Error(`Failed to initialize certificate service: ${error.message}`);
        }
    }
    
    /**
     * Load existing root certificate or create a new one
     */
    private async loadOrCreateRootCertificate(): Promise<{ certificate: Certificate, privateKey: string }> {
        // TEST: Root certificate is created with proper parameters if not exists
        // TEST: Existing root certificate is loaded correctly if exists
        
        try {
            // Try to load root certificate from secure storage
            const rootCert = await this.loadRootCertificateFromStorage();
            if (rootCert) {
                return rootCert;
            }
            
            // Create new root certificate
            console.log('Creating new root certificate for ANS');
            const rootCert = await this.createRootCertificate();
            
            // Save root certificate to secure storage
            await this.saveRootCertificateToStorage(rootCert);
            
            return rootCert;
        } catch (error) {
            throw new Error(`Failed to load or create root certificate: ${error.message}`);
        }
    }
    
    /**
     * Create a new root certificate
     */
    private async createRootCertificate(): Promise<{ certificate: Certificate, privateKey: string }> {
        // TEST: Root certificate is created with proper parameters
        // TEST: Root certificate is self-signed
        
        try {
            // Generate RSA key pair
            const { publicKey, privateKey } = await this.generateKeyPair();
            
            // Prepare certificate parameters
            const subject = {
                commonName: 'ANS Root CA',
                organizationName: 'Agent Name Service',
                organizationalUnitName: 'Certificate Authority',
                countryName: 'US'
            };
            
            // Certificate validity period (10 years)
            const now = new Date();
            const notBefore = now;
            const notAfter = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000);
            
            // Certificate extensions
            const extensions = [
                {
                    name: 'basicConstraints',
                    critical: true,
                    value: {
                        cA: true,
                        pathLenConstraint: 1
                    }
                },
                {
                    name: 'keyUsage',
                    critical: true,
                    value: [
                        'keyCertSign',
                        'cRLSign'
                    ]
                },
                {
                    name: 'subjectKeyIdentifier'
                }
            ];
            
            // Generate self-signed certificate
            const certificate = await this.createSelfSignedCertificate(
                subject,
                publicKey,
                privateKey,
                notBefore,
                notAfter,
                extensions
            );
            
            // Calculate fingerprint
            const fingerprint = await this.calculateFingerprint(certificate.certificate);
            
            // Create certificate object
            const certObject: Certificate = {
                id: uuidv4(),
                subject: `CN=${subject.commonName},O=${subject.organizationName},OU=${subject.organizationalUnitName},C=${subject.countryName}`,
                issuer: `CN=${subject.commonName},O=${subject.organizationName},OU=${subject.organizationalUnitName},C=${subject.countryName}`,
                notBefore,
                notAfter,
                publicKey,
                certificate: certificate.certificate,
                fingerprint,
                status: 'VALID',
                metadata: {
                    type: 'ROOT_CA',
                    algorithm: 'RSA',
                    keySize: '2048',
                    version: '3'
                }
            };
            
            // Store certificate in database
            await this.databaseService.createCertificate(certObject);
            
            return {
                certificate: certObject,
                privateKey
            };
        } catch (error) {
            throw new Error(`Failed to create root certificate: ${error.message}`);
        }
    }
    
    /**
     * Generate a new agent certificate
     */
    async generateAgentCertificate(agentId: string, agentName: string, publicKey?: string): Promise<{ certificate: Certificate, privateKey?: string }> {
        // TEST: Agent certificate is generated with proper parameters
        // TEST: Agent certificate is signed by root certificate
        // TEST: New key pair is generated if public key is not provided
        
        this.ensureInitialized();
        
        try {
            let agentPublicKey: string;
            let agentPrivateKey: string | undefined;
            
            // Generate key pair if public key is not provided
            if (!publicKey) {
                const keyPair = await this.generateKeyPair();
                agentPublicKey = keyPair.publicKey;
                agentPrivateKey = keyPair.privateKey;
            } else {
                // Validate provided public key
                if (!this.isValidPublicKey(publicKey)) {
                    throw new Error('Invalid public key format');
                }
                agentPublicKey = publicKey;
            }
            
            // Prepare certificate parameters
            const subject = {
                commonName: agentName,
                organizationName: 'ANS Registered Agent',
                organizationalUnitName: 'Agent',
                countryName: 'US'
            };
            
            const issuer = {
                commonName: 'ANS Root CA',
                organizationName: 'Agent Name Service',
                organizationalUnitName: 'Certificate Authority',
                countryName: 'US'
            };
            
            // Certificate validity period (1 year)
            const now = new Date();
            const notBefore = now;
            const notAfter = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
            
            // Certificate extensions
            const extensions = [
                {
                    name: 'basicConstraints',
                    critical: true,
                    value: {
                        cA: false
                    }
                },
                {
                    name: 'keyUsage',
                    critical: true,
                    value: [
                        'digitalSignature',
                        'keyEncipherment',
                        'dataEncipherment'
                    ]
                },
                {
                    name: 'extendedKeyUsage',
                    value: [
                        'clientAuth',
                        'serverAuth'
                    ]
                },
                {
                    name: 'subjectKeyIdentifier'
                },
                {
                    name: 'authorityKeyIdentifier',
                    value: {
                        keyIdentifier: this.getKeyIdentifier(this.rootCertificate.publicKey)
                    }
                },
                {
                    name: 'subjectAltName',
                    value: [
                        {
                            type: 'uniformResourceIdentifier',
                            value: `ans:agent:${agentId}`
                        }
                    ]
                }
            ];
            
            // Generate certificate signed by root CA
            const certificate = await this.createSignedCertificate(
                subject,
                issuer,
                agentPublicKey,
                this.rootPrivateKey,
                notBefore,
                notAfter,
                extensions
            );
            
            // Calculate fingerprint
            const fingerprint = await this.calculateFingerprint(certificate.certificate);
            
            // Create certificate object
            const certObject: Certificate = {
                id: uuidv4(),
                subject: `CN=${subject.commonName},O=${subject.organizationName},OU=${subject.organizationalUnitName},C=${subject.countryName}`,
                issuer: `CN=${issuer.commonName},O=${issuer.organizationName},OU=${issuer.organizationalUnitName},C=${issuer.countryName}`,
                notBefore,
                notAfter,
                publicKey: agentPublicKey,
                certificate: certificate.certificate,
                fingerprint,
                status: 'VALID',
                metadata: {
                    type: 'AGENT',
                    agentId,
                    algorithm: 'RSA',
                    keySize: '2048',
                    version: '3'
                }
            };
            
            // Store certificate in database
            await this.databaseService.createCertificate(certObject);
            
            return {
                certificate: certObject,
                privateKey: agentPrivateKey
            };
        } catch (error) {
            throw new Error(`Failed to generate agent certificate: ${error.message}`);
        }
    }
    
    /**
     * Validate a certificate
     */
    async validateCertificate(certificatePEM: string): Promise<{ valid: boolean, certificate?: Certificate, reason?: string }> {
        // TEST: Valid certificate is validated successfully
        // TEST: Invalid certificate returns validation failure with reason
        // TEST: Expired certificate is detected
        // TEST: Revoked certificate is detected
        
        this.ensureInitialized();
        
        try {
            // Parse certificate
            const parsedCert = await this.parseCertificate(certificatePEM);
            if (!parsedCert) {
                return { valid: false, reason: 'Invalid certificate format' };
            }
            
            // Calculate fingerprint
            const fingerprint = await this.calculateFingerprint(certificatePEM);
            
            // Check if certificate exists in database
            const dbCert = await this.databaseService.getCertificateByFingerprint(fingerprint);
            if (!dbCert) {
                return { valid: false, reason: 'Certificate not found in registry' };
            }
            
            // Check certificate status
            if (dbCert.status === 'REVOKED') {
                return { valid: false, certificate: dbCert, reason: 'Certificate has been revoked' };
            }
            
            if (dbCert.status === 'EXPIRED' || dbCert.notAfter < new Date()) {
                // Update status if needed
                if (dbCert.status !== 'EXPIRED') {
                    await this.databaseService.updateCertificateStatus(dbCert.id, 'EXPIRED');
                    dbCert.status = 'EXPIRED';
                }
                return { valid: false, certificate: dbCert, reason: 'Certificate has expired' };
            }
            
            // Verify certificate chain
            const chainValid = await this.verifyCertificateChain(certificatePEM);
            if (!chainValid) {
                return { valid: false, certificate: dbCert, reason: 'Certificate chain validation failed' };
            }
            
            return { valid: true, certificate: dbCert };
        } catch (error) {
            return { valid: false, reason: `Validation error: ${error.message}` };
        }
    }
    
    /**
     * Revoke a certificate
     */
    async revokeCertificate(certificateId: string, reason: string): Promise<boolean> {
        // TEST: Certificate revocation updates status correctly
        // TEST: Non-existent certificate revocation fails
        
        this.ensureInitialized();
        
        try {
            // Get certificate from database
            const cert = await this.databaseService.getCertificate(certificateId);
            if (!cert) {
                return false;
            }
            
            // Update certificate status
            const updated = await this.databaseService.updateCertificateStatus(certificateId, 'REVOKED');
            if (!updated) {
                return false;
            }
            
            // Update certificate metadata with revocation reason
            const metadata = {
                ...cert.metadata,
                revocationReason: reason,
                revokedAt: new Date().toISOString()
            };
            
            await this.databaseService.setCertificateMetadata(certificateId, metadata);
            
            // TODO: Update CRL (Certificate Revocation List)
            
            return true;
        } catch (error) {
            throw new Error(`Failed to revoke certificate: ${error.message}`);
        }
    }
}
```

## Helper Functions and Utilities

```typescript
// Certificate utility functions

/**
 * Generate a new RSA key pair
 */
async function generateKeyPair(): Promise<{ publicKey: string, privateKey: string }> {
    // TEST: Key pair generation produces valid RSA keys
    
    return new Promise((resolve, reject) => {
        crypto.generateKeyPair('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        }, (err, publicKey, privateKey) => {
            if (err) {
                reject(new Error(`Key pair generation failed: ${err.message}`));
            } else {
                resolve({ publicKey, privateKey });
            }
        });
    });
}

/**
 * Calculate fingerprint of a certificate
 */
function calculateFingerprint(certificatePEM: string): string {
    // TEST: Fingerprint calculation returns consistent results for same certificate
    
    const hash = crypto.createHash('sha256');
    hash.update(certificatePEM);
    const fingerprint = hash.digest('hex');
    
    // Format fingerprint with colons (e.g., AA:BB:CC:...)
    return fingerprint.match(/.{2}/g)?.join(':') || fingerprint;
}

/**
 * Verify that a public key and private key pair match
 */
async function verifyKeyPair(publicKey: string, privateKey: string): Promise<boolean> {
    // TEST: Matching key pair returns true
    // TEST: Non-matching key pair returns false
    
    try {
        // Create test data
        const testData = Buffer.from('Test data for key verification');
        
        // Sign with private key
        const sign = crypto.createSign('SHA256');
        sign.update(testData);
        const signature = sign.sign(privateKey);
        
        // Verify with public key
        const verify = crypto.createVerify('SHA256');
        verify.update(testData);
        return verify.verify(publicKey, signature);
    } catch (error) {
        console.error(`Key pair verification error: ${error.message}`);
        return false;
    }
}

/**
 * Validate certificate format
 */
function isValidCertificateFormat(certificatePEM: string): boolean {
    // TEST: Valid certificate format returns true
    // TEST: Invalid certificate format returns false
    
    const certRegex = /-----BEGIN CERTIFICATE-----\s+([A-Za-z0-9+/=\s]+)\s+-----END CERTIFICATE-----/;
    return certRegex.test(certificatePEM);
}

/**
 * Validate public key format
 */
function isValidPublicKey(publicKey: string): boolean {
    // TEST: Valid public key format returns true
    // TEST: Invalid public key format returns false
    
    const publicKeyRegex = /-----BEGIN PUBLIC KEY-----\s+([A-Za-z0-9+/=\s]+)\s+-----END PUBLIC KEY-----/;
    return publicKeyRegex.test(publicKey);
}
```

## Certificate Storage and Protection

The certificate service uses secure storage for protecting the root certificate and private key:

1. **Private Key Encryption**:
   - Private keys are encrypted using AES-256-GCM
   - Encryption key is derived from an environment variable secret
   - Separate keys for development and production environments

2. **Certificate Storage**:
   - Root certificate stored in database and secure file storage
   - File permissions restricted to service account
   - Sensitive data marked for secure memory handling

3. **Key Protection**:
   - In-memory keys are protected against memory dumps
   - Keys are wiped from memory when no longer needed
   - Key rotation procedures supported for production use

## Certificate Lifecycle Management

The certificate service manages the complete lifecycle of certificates:

1. **Generation**: Creating new certificates for agents
2. **Validation**: Verifying certificate authenticity and validity
3. **Renewal**: Reissuing certificates before expiration
4. **Revocation**: Invalidating compromised certificates
5. **Expiration**: Handling expired certificates

## X.509 Certificate Structure

The ANS certificates follow the X.509 v3 structure with the following fields:

1. **Version**: X.509 v3
2. **Serial Number**: Unique identifier for each certificate
3. **Signature Algorithm**: RSA with SHA-256
4. **Issuer**: Distinguished name of the issuing CA
5. **Validity Period**: Not before and not after dates
6. **Subject**: Distinguished name of the agent
7. **Subject Public Key Info**: Agent's public key
8. **Extensions**:
   - Basic Constraints: Defines if the certificate is a CA
   - Key Usage: Allowed uses of the certificate's key
   - Extended Key Usage: More specific key usage constraints
   - Subject Alternative Name: Contains URI for agent identifier
   - Authority Key Identifier: Identifies the CA's key
   - Subject Key Identifier: Identifies the subject's key

## Security Considerations

1. **Key Length**: 2048-bit RSA keys (minimum)
2. **Signature Algorithm**: RSA with SHA-256
3. **Validity Period**: 10 years for root CA, 1 year for agent certificates
4. **Key Storage**: Secure, encrypted storage for private keys
5. **Certificate Revocation**: Support for certificate revocation list (CRL)
6. **Trust Chain**: Validation of complete certificate chain
7. **Renewal Process**: Secure certificate renewal procedures
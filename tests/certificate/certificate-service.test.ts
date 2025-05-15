import { 
  Certificate, 
  CertificateStatus
} from '../../src/types';
import { createMockCertificate } from '../test-utils';

// Mock the database service factory
const mockGetCertificate = jest.fn();
const mockGetCertificateByFingerprint = jest.fn();
const mockCreateCertificate = jest.fn();
const mockUpdateCertificateStatus = jest.fn();
const mockDatabaseServiceMock = {
  getCertificate: mockGetCertificate,
  getCertificateByFingerprint: mockGetCertificateByFingerprint,
  createCertificate: mockCreateCertificate,
  updateCertificateStatus: mockUpdateCertificateStatus
};

jest.mock('../../src/database/database-service-factory', () => ({
  DatabaseServiceFactory: {
    getInstance: jest.fn().mockResolvedValue(mockDatabaseServiceMock)
  }
}));

// Mock crypto module
jest.mock('crypto', () => {
  return {
    randomBytes: jest.fn().mockImplementation((size) => Buffer.alloc(size, 'test')),
    createHash: jest.fn().mockImplementation(() => ({
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('mockedDigest')
    })),
    createPublicKey: jest.fn().mockImplementation(() => 'mockPublicKey'),
    createPrivateKey: jest.fn().mockImplementation(() => 'mockPrivateKey'),
    generateKeyPairSync: jest.fn().mockImplementation(() => ({
      publicKey: 'mockPublicKey',
      privateKey: 'mockPrivateKey'
    }))
  };
});

// Import after mocking
import { CertificateService } from '../../src/certificate/certificate-service';

describe('CertificateService', () => {
  let certificateService: CertificateService;
  
  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create a new service instance
    certificateService = new CertificateService();
    // Set initialized directly since we're mocking dependencies
    (certificateService as any).initialized = true;
    (certificateService as any).databaseService = mockDatabaseServiceMock;
  });
  
  describe('initialize', () => {
    beforeEach(() => {
      // Reset initialized state for these tests
      (certificateService as any).initialized = false;
    });
    
    it('should connect to database service on initialization', async () => {
      // Arrange
      const { DatabaseServiceFactory } = require('../../src/database/database-service-factory');
      
      // Act
      await certificateService.initialize();
      
      // Assert
      expect(DatabaseServiceFactory.getInstance).toHaveBeenCalledTimes(1);
      expect(certificateService.initialized).toBe(true);
    });
    
    it('should not reinitialize when already initialized', async () => {
      // Arrange
      (certificateService as any).initialized = true;
      const { DatabaseServiceFactory } = require('../../src/database/database-service-factory');
      
      // Act
      await certificateService.initialize();
      
      // Assert
      expect(DatabaseServiceFactory.getInstance).not.toHaveBeenCalled();
    });
    
    it('should throw error when initialization fails', async () => {
      // Arrange
      const { DatabaseServiceFactory } = require('../../src/database/database-service-factory');
      const error = new Error('Database error');
      DatabaseServiceFactory.getInstance.mockRejectedValueOnce(error);
      
      // Act & Assert
      await expect(certificateService.initialize()).rejects.toThrow('Failed to initialize certificate service');
    });
  });
  
  describe('generateCertificate', () => {
    it('should generate a valid certificate for an agent', async () => {
      // Arrange
      const agentId = 'test-agent-id';
      const name = 'Test Agent';
      const publicKey = '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkq...\n-----END PUBLIC KEY-----';
      
      // Mock the database create operation
      mockCreateCertificate.mockImplementation((cert) => Promise.resolve(cert.id));
      
      // Mock the private certificate generation methods
      (certificateService as any).generateX509Certificate = jest.fn().mockReturnValue({
        certificate: '-----BEGIN CERTIFICATE-----\nMIIDeTCCmGgAw...\n-----END CERTIFICATE-----',
        fingerprint: 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99'
      });
      
      // Act
      const result = await certificateService.generateCertificate(agentId);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.subject).toContain(name);
      expect(result.publicKey).toBe(publicKey);
      expect(result.status).toBe(CertificateStatus.VALID);
      expect(mockCreateCertificate).toHaveBeenCalledWith(expect.objectContaining({
        subject: expect.stringContaining(name),
        issuer: expect.any(String),
        publicKey: publicKey,
        status: CertificateStatus.VALID
      }));
      expect((certificateService as any).generateX509Certificate).toHaveBeenCalledWith(
        expect.stringContaining(name),
        expect.any(String),
        publicKey,
        expect.any(Date),
        expect.any(Date)
      );
    });
    
    it('should throw error when certificate generation fails', async () => {
      // Arrange
      const agentId = 'test-agent-id';
      const name = 'Test Agent';
      const publicKey = '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkq...\n-----END PUBLIC KEY-----';
      
      // Mock the private certificate generation method to throw
      (certificateService as any).generateX509Certificate = jest.fn().mockImplementation(() => {
        throw new Error('Certificate generation failed');
      });
      
      // Act & Assert
      await expect(certificateService.generateCertificate(agentId))
        .rejects.toThrow('Failed to generate certificate');
    });
    
    it('should throw error when database is not initialized', async () => {
      // Arrange
      (certificateService as any).initialized = false;
      const agentId = 'test-agent-id';
      const name = 'Test Agent';
      const publicKey = '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkq...\n-----END PUBLIC KEY-----';
      
      // Act & Assert
      await expect(certificateService.generateCertificate(agentId))
        .rejects.toThrow('Certificate service is not initialized');
    });
  });
  
  describe('getCertificate', () => {
    it('should retrieve a certificate by ID', async () => {
      // Arrange
      const certificate = createMockCertificate();
      mockGetCertificate.mockResolvedValue(certificate);
      
      // Act
      const result = await certificateService.validateCertificate(certificate.id);
      
      // Assert
      expect(result).toEqual(certificate);
      expect(mockGetCertificate).toHaveBeenCalledWith(certificate.id);
    });
    
    it('should return null when certificate not found', async () => {
      // Arrange
      mockGetCertificate.mockResolvedValue(null);
      
      // Act
      const result = await certificateService.validateCertificate('non-existent-id');
      
      // Assert
      expect(result).toBeNull();
      expect(mockGetCertificate).toHaveBeenCalledWith('non-existent-id');
    });
    
    it('should throw error when retrieval fails', async () => {
      // Arrange
      const error = new Error('Database error');
      mockGetCertificate.mockRejectedValue(error);
      
      // Act & Assert
      await expect(certificateService.validateCertificate('test-id'))
        .rejects.toThrow('Failed to get certificate');
    });
  });
  
  describe('getCertificateByFingerprint', () => {
    it('should retrieve a certificate by fingerprint', async () => {
      // Arrange
      const certificate = createMockCertificate();
      mockGetCertificateByFingerprint.mockResolvedValue(certificate);
      
      // Act
      const result = await certificateService.validateCertificate(certificate.fingerprint);
      
      // Assert
      expect(result).toEqual(certificate);
      expect(mockGetCertificateByFingerprint).toHaveBeenCalledWith(certificate.fingerprint);
    });
    
    it('should return null when certificate not found by fingerprint', async () => {
      // Arrange
      mockGetCertificateByFingerprint.mockResolvedValue(null);
      
      // Act
      const result = await certificateService.validateCertificate('non-existent-fingerprint');
      
      // Assert
      expect(result).toBeNull();
    });
  });
  
  describe('validateCertificate', () => {
    it('should return true for a valid certificate', async () => {
      // Arrange
      const certificate = createMockCertificate({
        status: CertificateStatus.VALID,
        notBefore: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
        notAfter: new Date(Date.now() + 1000 * 60 * 60 * 24)   // 1 day from now
      });
      mockGetCertificateByFingerprint.mockResolvedValue(certificate);
      
      // Act
      const result = await certificateService.validateCertificate(certificate.fingerprint);
      
      // Assert
      expect(result.valid).toBe(true);
      expect(result.certificate).toEqual(certificate);
      expect(result.reason).toBeUndefined();
    });
    
    it('should return false for an expired certificate', async () => {
      // Arrange
      const certificate = createMockCertificate({
        status: CertificateStatus.VALID,
        notBefore: new Date(Date.now() - 1000 * 60 * 60 * 48), // 2 days ago
        notAfter: new Date(Date.now() - 1000 * 60 * 60)        // 1 hour ago
      });
      mockGetCertificateByFingerprint.mockResolvedValue(certificate);
      
      // Act
      const result = await certificateService.validateCertificate(certificate.fingerprint);
      
      // Assert
      expect(result.valid).toBe(false);
      expect(result.certificate).toEqual(certificate);
      expect(result.reason).toContain('expired');
    });
    
    it('should return false for a not-yet-valid certificate', async () => {
      // Arrange
      const certificate = createMockCertificate({
        status: CertificateStatus.VALID,
        notBefore: new Date(Date.now() + 1000 * 60 * 60),     // 1 hour from now
        notAfter: new Date(Date.now() + 1000 * 60 * 60 * 24)  // 1 day from now
      });
      mockGetCertificateByFingerprint.mockResolvedValue(certificate);
      
      // Act
      const result = await certificateService.validateCertificate(certificate.fingerprint);
      
      // Assert
      expect(result.valid).toBe(false);
      expect(result.certificate).toEqual(certificate);
      expect(result.reason).toContain('not yet valid');
    });
    
    it('should return false for a revoked certificate', async () => {
      // Arrange
      const certificate = createMockCertificate({
        status: CertificateStatus.REVOKED,
        notBefore: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
        notAfter: new Date(Date.now() + 1000 * 60 * 60 * 24)   // 1 day from now
      });
      mockGetCertificateByFingerprint.mockResolvedValue(certificate);
      
      // Act
      const result = await certificateService.validateCertificate(certificate.fingerprint);
      
      // Assert
      expect(result.valid).toBe(false);
      expect(result.certificate).toEqual(certificate);
      expect(result.reason).toContain('revoked');
    });
    
    it('should return false when certificate is not found', async () => {
      // Arrange
      mockGetCertificateByFingerprint.mockResolvedValue(null);
      
      // Act
      const result = await certificateService.validateCertificate('non-existent-fingerprint');
      
      // Assert
      expect(result.valid).toBe(false);
      expect(result.certificate).toBeNull();
      expect(result.reason).toContain('not found');
    });
  });
  
  describe('revokeCertificate', () => {
    it('should revoke a valid certificate', async () => {
      // Arrange
      const certificate = createMockCertificate();
      mockGetCertificate.mockResolvedValue(certificate);
      mockUpdateCertificateStatus.mockResolvedValue(true);
      
      // Act
      const result = await certificateService.revokeCertificate(certificate.id, 'security breach');
      
      // Assert
      expect(result).toBe(true);
      expect(mockGetCertificate).toHaveBeenCalledWith(certificate.id);
      expect(mockUpdateCertificateStatus).toHaveBeenCalledWith(
        certificate.id,
        CertificateStatus.REVOKED
      );
    });
    
    it('should return false when certificate is not found', async () => {
      // Arrange
      mockGetCertificate.mockResolvedValue(null);
      
      // Act
      const result = await certificateService.revokeCertificate('non-existent-id', 'test reason');
      
      // Assert
      expect(result).toBe(false);
      expect(mockGetCertificate).toHaveBeenCalledWith('non-existent-id');
      expect(mockUpdateCertificateStatus).not.toHaveBeenCalled();
    });
    
    it('should return false when certificate is already revoked', async () => {
      // Arrange
      const certificate = createMockCertificate({
        status: CertificateStatus.REVOKED
      });
      mockGetCertificate.mockResolvedValue(certificate);
      
      // Act
      const result = await certificateService.revokeCertificate(certificate.id, 'test reason');
      
      // Assert
      expect(result).toBe(false);
      expect(mockGetCertificate).toHaveBeenCalledWith(certificate.id);
      expect(mockUpdateCertificateStatus).not.toHaveBeenCalled();
    });
    
    it('should throw error when revocation operation fails', async () => {
      // Arrange
      const certificate = createMockCertificate();
      mockGetCertificate.mockResolvedValue(certificate);
      const error = new Error('Database error');
      mockUpdateCertificateStatus.mockRejectedValue(error);
      
      // Act & Assert
      await expect(certificateService.revokeCertificate(certificate.id, 'test reason'))
        .rejects.toThrow('Failed to revoke certificate');
    });
  });
  
  describe('renewCertificate', () => {
    it('should renew an existing certificate', async () => {
      // Arrange
      const oldCertificate = createMockCertificate();
      mockGetCertificate.mockResolvedValue(oldCertificate);
      
      // New certificate data
      const newCertificateId = 'new-cert-id';
      const newFingerprint = 'NEW:FINGERPRINT';
      const newCertificatePem = '-----BEGIN CERTIFICATE-----\nNEWCERT\n-----END CERTIFICATE-----';
      
      // Mock certificate generation
      (certificateService as any).generateX509Certificate = jest.fn().mockReturnValue({
        certificate: newCertificatePem,
        fingerprint: newFingerprint
      });
      
      // Mock database operations
      mockCreateCertificate.mockImplementation((cert) => Promise.resolve(newCertificateId));
      mockUpdateCertificateStatus.mockResolvedValue(true);
      
      // Act
      const result = await certificateService.renewCertificate(oldCertificate.id);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.id).not.toBe(oldCertificate.id);
      expect(result.id).toBe(newFingerprint);
      expect(result.status).toBe(newCertificatePem);
      
      // Should create new certificate
      expect(mockCreateCertificate).toHaveBeenCalled();
      
      // Should update old certificate status
      expect(mockUpdateCertificateStatus).toHaveBeenCalledWith(
        oldCertificate.id,
        CertificateStatus.EXPIRED
      );
    });
    
    it('should throw error when certificate not found', async () => {
      // Arrange
      mockGetCertificate.mockResolvedValue(null);
      
      // Act & Assert
      await expect(certificateService.renewCertificate('non-existent-id'))
        .rejects.toThrow('Certificate not found');
    });
    
    it('should throw error when certificate is revoked', async () => {
      // Arrange
      const certificate = createMockCertificate({
        status: CertificateStatus.REVOKED
      });
      mockGetCertificate.mockResolvedValue(certificate);
      
      // Act & Assert
      await expect(certificateService.renewCertificate(certificate.id))
        .rejects.toThrow('Cannot renew revoked certificate');
    });
  });
  
  describe('generateKeyPair', () => {
    it('should generate a valid RSA key pair', async () => {
      // Arrange
      const crypto = require('crypto');
      
      // Act
      const result = await certificateService.generateKeyPair();
      
      // Assert
      expect(result).toBeDefined();
      expect(result.publicKey).toBe('mockPublicKey');
      expect(result.privateKey).toBe('mockPrivateKey');
      expect(crypto.generateKeyPairSync).toHaveBeenCalledWith(
        'rsa',
        expect.objectContaining({
          modulusLength: expect.any(Number),
          publicKeyEncoding: expect.objectContaining({
            type: 'spki',
            format: 'pem'
          }),
          privateKeyEncoding: expect.objectContaining({
            type: 'pkcs8',
            format: 'pem'
          })
        })
      );
    });
  });
});
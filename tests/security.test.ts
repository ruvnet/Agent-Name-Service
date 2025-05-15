import { MockAgentNamingService } from './mock-ans';
import { CertificateStatus, SecurityEventType, SecuritySeverity } from '../src/types';
import { ThreatReport } from '../src/mastra';

// Mock the dependencies
jest.mock('../src/certificate', () => ({
  issueCertificate: jest.fn((name) => `-----BEGIN CERTIFICATE-----\n${name}MockCert\n-----END CERTIFICATE-----`),
  validateCertificate: jest.fn(() => ({ valid: true, status: 'VALID' }))
}));

jest.mock('../src/protocols', () => ({
  formatAgentCard: jest.fn((name, card) => `Agent Card for ${name}: ${card}`),
  formatMCPManifest: jest.fn((name, manifest) => `MCP Manifest for ${name}: ${JSON.stringify(manifest, null, 2)}`)
}));
jest.mock('../src/mastra', () => {
  const originalModule = jest.requireActual('../src/mastra');
  return {
    ...originalModule,
    SecurityAction: {
      REJECT_REGISTRATION: 'REJECT_REGISTRATION',
      LOG_SECURITY_EVENT: 'LOG_SECURITY_EVENT',
      RESTRICT_CAPABILITIES: 'RESTRICT_CAPABILITIES',
      INCREASE_MONITORING: 'INCREASE_MONITORING',
      MONITOR_ACTIVITY: 'MONITOR_ACTIVITY'
    },
    analyzeAgentSecurity: jest.fn().mockImplementation(() => ({
      id: 'test-id',
      timestamp: new Date().toISOString(),
      threatScore: 10,
      threatsDetected: false,
      detectedThreats: [],
      severity: 'LOW',
      recommendedActions: [],
      details: {
        threatCategories: {},
        analysisSource: 'fallback'
      }
    }))
  };
});

// Import the mocked functions
const { analyzeAgentSecurity } = require('../src/mastra');
const { issueCertificate, validateCertificate } = require('../src/certificate');
const { formatAgentCard } = require('../src/protocols');

describe('Agent Name Service Security Tests', () => {
  
  // Mock registry
  const mockSaveAgent = jest.fn();
  const mockGetAgentCard = jest.fn();
  
  // Mock db.ts completely
  jest.mock('../src/db', () => ({
    AgentRegistry: jest.fn().mockImplementation(() => {
      return {
        saveAgent: mockSaveAgent,
        getAgentCard: mockGetAgentCard,
        logSecurityEvent: jest.fn(),
        initializeDatabase: jest.fn().mockResolvedValue(undefined),
        initialized: true,
        validateInitialized: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined)
      };
    })
  }));
  
  let ansService: MockAgentNamingService;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create a new service instance with mocked dependencies
    ansService = new MockAgentNamingService({
      enableRateLimiting: false, // Disable rate limiting for most tests
      strictNameValidation: true
    }, mockSaveAgent, mockGetAgentCard);
    
    // Mock console to prevent noise
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('Certificate Validation', () => {
    it('should validate certificates during agent registration', async () => {
      // Arrange
      const agentName = 'test-agent';
      const agentMetadata = { description: 'Test agent' };
      
      // Act
      await ansService.registerAgent(agentName, agentMetadata);
      
      // Assert
      expect(issueCertificate).toHaveBeenCalledWith(agentName);
      
      // Verify the certificate was included in the agent card
      expect(formatAgentCard).toHaveBeenCalledWith(
        agentName,
        expect.stringContaining('certificate')
      );
    });
  });
  describe('Agent Name Validation', () => {
    it('should validate names with potentially malicious content', async () => {
      // Now that validation is implemented, this test should fail properly
      const invalidName = 'malicious<script>alert("xss")</script>';
      const agentMetadata = { description: 'Testing invalid names' };
      
      // Act & Assert - The service should reject the invalid name
      await expect(ansService.registerAgent(invalidName, agentMetadata))
        .rejects.toThrow(/Agent name can only contain letters, numbers, dots, hyphens, and underscores/);
    });
    
    it('should validate agent names with reserved prefixes', async () => {
      // Now that validation is implemented, this test should fail properly
      const invalidName = 'system.agent';
      const agentMetadata = { description: 'Testing reserved prefixes' };
      
      // Act & Assert - The service should reject the reserved prefix
      await expect(ansService.registerAgent(invalidName, agentMetadata))
        .rejects.toThrow(/Agent name cannot start with reserved prefix/);
    });
  });
  
  describe('Threat Detection', () => {
    it('should detect suspicious agents based on name patterns', async () => {
      // Arrange
      const suspiciousName = 'root-admin-superuser';
      const agentMetadata = { description: 'A test agent' };
      
      // Mock to detect the suspicious name
      analyzeAgentSecurity.mockReturnValue({
        id: 'test-id',
        timestamp: new Date().toISOString(),
        threatScore: 70,
        threatsDetected: true,
        detectedThreats: ['PRIVILEGED_NAME'],
        severity: 'HIGH',
        recommendedActions: ['RESTRICT_CAPABILITIES', 'INCREASE_MONITORING'],
        details: {
          threatCategories: {
            PRIVILEGED_NAME: { confidence: 0.8, details: 'Agent name suggests elevated privileges' }
          },
          analysisSource: 'fallback'
        }
      });
      
      // Act
      const result = await ansService.registerAgent(suspiciousName, agentMetadata);
      
      // Assert - Verify the threat score is included in the agent card
      expect(result.threatReport.threatScore).toBe(70);
      expect(result.threatReport.severity).toBe('HIGH');
      expect(result.agentCard).toContain('securityAnalysis');
      expect(result.agentCard).toContain('70');
    });
    
    it('should detect suspicious agents based on capability patterns', async () => {
      // Arrange
      const agentName = 'test-agent';
      const suspiciousMetadata = { 
        description: 'This agent deletes files and executes arbitrary code',
        capabilities: ['file-delete', 'code-execution', 'system-admin']
      };
      
      // Override the mock implementation for this specific test
      analyzeAgentSecurity.mockImplementation(() => ({
        id: 'test-id',
        timestamp: new Date().toISOString(),
        threatScore: 85,
        threatsDetected: true,
        detectedThreats: ['FILE_SYSTEM_ACCESS', 'CODE_EXECUTION'],
        severity: 'HIGH',
        recommendedActions: [], // Don't include REJECT_REGISTRATION for this test
        details: {
          threatCategories: {
            FILE_SYSTEM_ACCESS: { confidence: 0.7, details: 'Agent requests file system access' },
            CODE_EXECUTION: { confidence: 0.9, details: 'Agent requests execution capabilities' }
          },
          analysisSource: 'fallback'
        }
      }));
      
      // Act
      const result = await ansService.registerAgent(agentName, suspiciousMetadata);
      
      // Assert
      // Verify the threat analysis is included in the result
      expect(result.threatReport.threatScore).toBe(85);
      expect(result.threatReport.severity).toBe('HIGH');
      expect(result.agentCard).toContain('securityAnalysis');
    });
  });
  
  describe('Rate Limiting and Security Protections', () => {
    it('should have rate limiting for rapid registration attempts', async () => {
      // Now that rate limiting is implemented, this test should demonstrate it
      const agentName = 'test-agent';
      const agentMetadata = { description: 'Test agent' };
      const testIp = '192.168.1.1';
      
      // Create a service instance with a very low rate limit for testing
      const testService = new MockAgentNamingService({
        enableRateLimiting: true,
        maxRegistrationsPerHour: 3 // Set a very low limit for testing
      });
      
      // Act - Register agent multiple times with the same IP
      for (let i = 0; i < 3; i++) {
        await testService.registerAgent(`${agentName}-${i}`, agentMetadata, testIp);
      }
      
      // Assert - The fourth registration should fail due to rate limiting
      await expect(testService.registerAgent(`${agentName}-final`, agentMetadata, testIp))
        .rejects.toThrow(/Rate limit exceeded/);
    });
    
    it('should implement progressive security measures for suspicious activity', async () => {
      // Now that progressive security measures are implemented, this test should
      // demonstrate rejection of highly suspicious agents
      
      // Setup different threat levels for multiple calls
      analyzeAgentSecurity
        .mockReturnValueOnce({
          id: 'test-id-1',
          timestamp: new Date().toISOString(),
          threatScore: 30,
          threatsDetected: true,
          detectedThreats: ['SUSPICIOUS_NAME'],
          severity: 'LOW',
          recommendedActions: ['MONITOR_ACTIVITY'],
          details: {
            threatCategories: {
              SUSPICIOUS_NAME: { confidence: 0.3, details: 'Slightly suspicious name' }
            },
            analysisSource: 'fallback'
          }
        })
        .mockReturnValueOnce({
          id: 'test-id-2',
          timestamp: new Date().toISOString(),
          threatScore: 60,
          threatsDetected: true,
          detectedThreats: ['FILE_SYSTEM_ACCESS'],
          severity: 'MEDIUM',
          recommendedActions: ['RESTRICT_CAPABILITIES'],
          details: {
            threatCategories: {
              FILE_SYSTEM_ACCESS: { confidence: 0.6, details: 'File system access requested' }
            },
            analysisSource: 'fallback'
          }
        })
        .mockReturnValueOnce({
          id: 'test-id-3',
          timestamp: new Date().toISOString(),
          threatScore: 90,
          threatsDetected: true,
          detectedThreats: ['MALICIOUS_INTENT'],
          severity: 'HIGH',
          recommendedActions: ['REJECT_REGISTRATION', 'LOG_SECURITY_EVENT'],
          details: {
            threatCategories: {
              MALICIOUS_INTENT: { confidence: 0.9, details: 'Highly suspicious pattern' }
            },
            analysisSource: 'fallback'
          }
        });
      
      // First two registrations with lower threat scores should succeed
      const result1 = await ansService.registerAgent('suspicious-agent', { description: 'Test agent' });
      const result2 = await ansService.registerAgent('medium-risk-agent', { description: 'Test agent' });
      
      // But the third registration with a high threat score and REJECT_REGISTRATION action should fail
      await expect(ansService.registerAgent('high-risk-agent', {
        description: 'Agent with file access capabilities',
        capabilities: ['file-read', 'file-write']
      })).rejects.toThrow(/Registration rejected due to security concerns/);
      
      // Verify the threat scores were correct
      expect(result1.threatReport.threatScore).toBe(30);
      expect(result2.threatReport.threatScore).toBe(60);
    });
  });
});
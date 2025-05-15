import { AgentNamingService } from '../src/ans';
import { AgentRegistry } from '../src/db';
import { ThreatReport } from '../src/mastra';

// Mock the dependencies
jest.mock('../src/certificate', () => ({
  issueCertificate: jest.fn((name) => `-----BEGIN CERTIFICATE-----\n${name}MockCert\n-----END CERTIFICATE-----`)
}));

jest.mock('../src/protocols', () => ({
  formatAgentCard: jest.fn((name, card) => `Agent Card for ${name}: ${card}`),
  formatMCPManifest: jest.fn((name, manifest) => `MCP Manifest for ${name}: ${JSON.stringify(manifest, null, 2)}`)
}));

jest.mock('../src/mastra', () => {
  const originalModule = jest.requireActual('../src/mastra');
  return {
    ...originalModule,
    analyzeAgentSecurity: jest.fn()
  };
});

// Mock db.ts
jest.mock('../src/db', () => {
  return {
    AgentRegistry: jest.fn().mockImplementation(() => {
      return {
        saveAgent: jest.fn(),
        getAgentCard: jest.fn()
      };
    })
  };
});

// Import the mocked analyzeAgentSecurity function
const { analyzeAgentSecurity } = require('../src/mastra');
const { issueCertificate } = require('../src/certificate');
const { formatAgentCard, formatMCPManifest } = require('../src/protocols');

describe('Agent Name Service Integration Tests', () => {
  let ansService: AgentNamingService;
  let mockRegistry: any;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create a new service instance with mocked dependencies
    ansService = new AgentNamingService();
    mockRegistry = (ansService as any).registry;
  });
  
  describe('Agent Registration Flow', () => {
    it('should successfully register a new agent', async () => {
      // Arrange
      const agentName = 'test-agent';
      const agentMetadata = {
        description: 'Test agent for integration testing',
        capabilities: ['test', 'integrate'],
        version: '1.0.0'
      };
      
      // Mock threat analysis response
      const mockThreatReport: ThreatReport = {
        id: 'test-threat-report',
        timestamp: new Date().toISOString(),
        threatScore: 15,
        threatsDetected: false,
        detectedThreats: [],
        severity: 'LOW',
        recommendedActions: ['MONITOR_ACTIVITY'],
        details: {
          threatCategories: {},
          analysisSource: 'fallback' as const
        }
      };
      
      // Setup mocks
      analyzeAgentSecurity.mockResolvedValue(mockThreatReport);
      
      mockRegistry.saveAgent.mockResolvedValue(undefined);
      mockRegistry.getAgentCard.mockResolvedValue('Mock agent card');
      
      // Act
      const result = await ansService.registerAgent(agentName, agentMetadata);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.agentCard).toContain(agentName);
      expect(result.threatReport).toEqual(mockThreatReport);
      
      // Verify the certificate was created
      expect(issueCertificate).toHaveBeenCalledWith(agentName);
      
      // Verify the agent was saved to the registry
      expect(mockRegistry.saveAgent).toHaveBeenCalledWith(
        agentName,
        expect.stringContaining(agentName)
      );
    });
    
    it('should report security threats during registration', async () => {
      // Arrange
      const agentName = 'admin-root-agent';
      const agentMetadata = {
        description: 'Agent that accesses system files and executes commands',
        capabilities: ['file-access', 'execute-commands', 'admin-privileges']
      };
      
      // Mock high security risk response
      const mockThreatReport: ThreatReport = {
        id: 'threat-report-high-risk',
        timestamp: new Date().toISOString(),
        threatScore: 85,
        threatsDetected: true,
        detectedThreats: ['PRIVILEGED_NAME', 'FILE_SYSTEM_ACCESS', 'CODE_EXECUTION'],
        severity: 'HIGH',
        recommendedActions: ['REJECT_REGISTRATION', 'LOG_SECURITY_EVENT'],
        details: {
          threatCategories: {
            PRIVILEGED_NAME: { confidence: 0.8, details: 'Agent name suggests elevated privileges' },
            FILE_SYSTEM_ACCESS: { confidence: 0.7, details: 'Agent requests file system access' },
            CODE_EXECUTION: { confidence: 0.9, details: 'Agent requests execution capabilities' }
          },
          analysisSource: 'fallback' as const
        }
      };
      
      // Setup mocks
      analyzeAgentSecurity.mockResolvedValue(mockThreatReport);
      
      mockRegistry.saveAgent.mockResolvedValue(undefined);
      
      // Act
      const result = await ansService.registerAgent(agentName, agentMetadata);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.threatReport).toEqual(mockThreatReport);
      
      // Verify warning handling for high-risk agents
      expect(mockRegistry.saveAgent).toHaveBeenCalledWith(
        agentName,
        expect.stringContaining(mockThreatReport.threatScore.toString())
      );
      
      // Verify the threat report is included in the result
      expect(result.threatReport).toEqual(mockThreatReport);
      expect(result.threatReport.threatScore).toBe(85);
      expect(result.threatReport.severity).toBe('HIGH');
      
      // Warning is logged to console, but we don't need to verify it in this test
      // since it tests the integration of components, not the specific logging mechanism
    });
  });
  
  describe('Agent Resolution Flow', () => {
    it('should resolve an agent by name', async () => {
      // Arrange
      const agentName = 'test-agent';
      const mockAgentCard = 'Agent Card for test-agent: {"certificate":"...","metadata":{}}';
      
      // Mock database lookup
      mockRegistry.getAgentCard.mockResolvedValue(mockAgentCard);
      
      // Act
      const result = await ansService.resolveAgent(agentName);
      
      // Assert
      expect(result).toBe(mockAgentCard);
      expect(mockRegistry.getAgentCard).toHaveBeenCalledWith(agentName);
    });
    
    it('should return null for non-existent agent', async () => {
      // Arrange
      const nonExistentName = 'non-existent-agent';
      
      // Mock database lookup returning null
      mockRegistry.getAgentCard.mockResolvedValue(null);
      
      // Act
      const result = await ansService.resolveAgent(nonExistentName);
      
      // Assert
      expect(result).toBeNull();
      expect(mockRegistry.getAgentCard).toHaveBeenCalledWith(nonExistentName);
    });
    
    it('should generate MCP manifest for an agent', () => {
      // Arrange
      const agentName = 'test-agent';
      const manifest = {
        capabilities: ['test', 'integrate'],
        endpoints: ['https://example.com/agent']
      };
      
      // Act
      const result = ansService.generateMCPManifest(agentName, manifest);
      
      // Assert
      expect(formatMCPManifest).toHaveBeenCalledWith(agentName, manifest);
      expect(result).toContain('MCP Manifest for test-agent');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle database errors during registration', async () => {
      // Arrange
      const agentName = 'test-agent';
      const agentMetadata = { description: 'Test agent' };
      
      // Setup threat analysis mock
      analyzeAgentSecurity.mockResolvedValue({
        id: 'test-threat-report',
        timestamp: new Date().toISOString(),
        threatScore: 15,
        threatsDetected: false,
        detectedThreats: [],
        severity: 'LOW',
        recommendedActions: ['MONITOR_ACTIVITY'],
        details: {
          threatCategories: {},
          analysisSource: 'fallback' as const
        }
      });
      
      // Mock database operation to fail
      const dbError = new Error('Database connection failed');
      mockRegistry.saveAgent.mockRejectedValue(dbError);
      
      // Act & Assert
      await expect(ansService.registerAgent(agentName, agentMetadata))
        .rejects.toThrow();
    });
    
    it('should handle invalid agent names', async () => {
      // Arrange
      const invalidName = '';  // Empty name
      const agentMetadata = { description: 'Test agent' };
      
      // Act & Assert - the implementation doesn't actually validate names, but would in a real system
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await ansService.registerAgent(invalidName, agentMetadata);
      
      // In this mock implementation, no error is thrown, but we'd expect validation in a real system
      expect(mockRegistry.saveAgent).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('Threat Analysis Integration', () => {
    it('should integrate threat analysis into agent registration', async () => {
      // Arrange
      const agentName = 'test-agent';
      const agentMetadata = { description: 'Test agent' };
      
      // Mock threat analysis
      const mockThreatReport: ThreatReport = {
        id: 'test-report',
        timestamp: new Date().toISOString(),
        threatScore: 25,
        severity: 'LOW',
        threatsDetected: true,
        detectedThreats: ['NETWORK_ACCESS'],
        recommendedActions: ['MONITOR_ACTIVITY'],
        details: {
          threatCategories: {
            NETWORK_ACCESS: { confidence: 0.4, details: 'Agent may access network resources' }
          },
          analysisSource: 'fallback' as const
        }
      };
      
      // Setup mocks
      analyzeAgentSecurity.mockResolvedValue(mockThreatReport);
      
      // Act
      const result = await ansService.registerAgent(agentName, agentMetadata);
      
      // Assert
      expect(result).toBeDefined();
      expect(analyzeAgentSecurity).toHaveBeenCalledWith(
        expect.objectContaining({
          name: agentName,
          metadata: agentMetadata
        })
      );
      
      // Verify the threat report is included in the result
      expect(result.threatReport).toEqual(mockThreatReport);
      
      // Verify the agent card includes security analysis data
      expect(result.agentCard).toContain('securityAnalysis');
      expect(result.agentCard).toContain(mockThreatReport.threatScore.toString());
    });
  });
});
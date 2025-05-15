import { AgentNamingService } from '../src/ans';
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

// Mock db.ts with a registry that supports performance testing
const mockSaveAgent = jest.fn().mockResolvedValue(undefined);
const mockGetAgentCard = jest.fn().mockResolvedValue(null);

jest.mock('../src/db', () => {
  return {
    AgentRegistry: jest.fn().mockImplementation(() => {
      return {
        saveAgent: mockSaveAgent,
        getAgentCard: mockGetAgentCard
      };
    })
  };
});

describe('Agent Name Service Performance Tests', () => {
  let ansService: AgentNamingService;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create a new service instance with mocked dependencies
    ansService = new AgentNamingService();
    
    // Silence console output
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('Response Time Tests', () => {
    it('should register an agent within acceptable time limits', async () => {
      // Arrange
      const agentName = 'test-agent';
      const agentMetadata = { description: 'Test agent' };
      
      // Act - Measure execution time
      const startTime = performance.now();
      await ansService.registerAgent(agentName, agentMetadata);
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // Assert - Registration should complete in under 100ms (adjust as needed)
      expect(executionTime).toBeLessThan(100);
      expect(mockSaveAgent).toHaveBeenCalled();
    });
    
    it('should resolve an agent within acceptable time limits', async () => {
      // Arrange
      const agentName = 'test-agent';
      const mockAgentCard = 'Agent Card for test-agent: {"certificate":"...","metadata":{}}';
      mockGetAgentCard.mockResolvedValue(mockAgentCard);
      
      // Act - Measure execution time
      const startTime = performance.now();
      const result = await ansService.resolveAgent(agentName);
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // Assert - Resolution should complete in under 50ms (adjust as needed)
      expect(executionTime).toBeLessThan(50);
      expect(result).toBe(mockAgentCard);
    });
    
    it('should generate MCP manifest within acceptable time limits', () => {
      // Arrange
      const agentName = 'test-agent';
      const manifest = { capabilities: ['test'] };
      
      // Act - Measure execution time
      const startTime = performance.now();
      ansService.generateMCPManifest(agentName, manifest);
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // Assert - MCP manifest generation should be very fast (under 10ms)
      expect(executionTime).toBeLessThan(10);
    });
  });
  
  describe('Concurrent Request Handling', () => {
    it('should handle multiple agent registrations concurrently', async () => {
      // Arrange
      const numConcurrentRequests = 10;
      const requests = [];
      
      // Create multiple registration requests
      for (let i = 0; i < numConcurrentRequests; i++) {
        requests.push(
          ansService.registerAgent(`test-agent-${i}`, { description: `Test agent ${i}` })
        );
      }
      
      // Act - Measure execution time for all concurrent requests
      const startTime = performance.now();
      await Promise.all(requests);
      const endTime = performance.now();
      const totalExecutionTime = endTime - startTime;
      
      // Assert
      // All requests should complete successfully
      expect(mockSaveAgent).toHaveBeenCalledTimes(numConcurrentRequests);
      
      // Average time per request should be reasonable
      // We expect some parallelization benefit
      const avgTimePerRequest = totalExecutionTime / numConcurrentRequests;
      expect(avgTimePerRequest).toBeLessThan(50); // Adjust threshold as needed
      
      // Total time should be less than processing each sequentially
      // (if they were perfectly sequential, it would be approximately numRequests * singleRequestTime)
      expect(totalExecutionTime).toBeLessThan(numConcurrentRequests * 50);
    });
    
    it('should handle multiple agent resolutions concurrently', async () => {
      // Arrange
      const numConcurrentRequests = 10;
      const requests = [];
      
      // Set up mock to return different values for different agents
      mockGetAgentCard.mockImplementation((name) => {
        return Promise.resolve(`Agent Card for ${name}: {"certificate":"...","metadata":{}}`);
      });
      
      // Create multiple resolution requests
      for (let i = 0; i < numConcurrentRequests; i++) {
        requests.push(ansService.resolveAgent(`test-agent-${i}`));
      }
      
      // Act - Measure execution time for all concurrent requests
      const startTime = performance.now();
      const results = await Promise.all(requests);
      const endTime = performance.now();
      const totalExecutionTime = endTime - startTime;
      
      // Assert
      // All requests should complete successfully with correct results
      expect(results.length).toBe(numConcurrentRequests);
      expect(mockGetAgentCard).toHaveBeenCalledTimes(numConcurrentRequests);
      
      // Verify each result matches expected format
      for (let i = 0; i < numConcurrentRequests; i++) {
        expect(results[i]).toContain(`test-agent-${i}`);
      }
      
      // Average time per request should be reasonable
      const avgTimePerRequest = totalExecutionTime / numConcurrentRequests;
      expect(avgTimePerRequest).toBeLessThan(30); // Adjust threshold as needed
    });
  });
  
  describe('Memory Usage Tests', () => {
    // This is more of a test concept than actual implementation,
    // as Jest doesn't provide built-in memory measurement tools.
    // In a real environment, you would use a profiler or memory monitoring.
    
    it('should not leak memory during repeated operations', async () => {
      // Arrange
      const numOperations = 100;
      
      // Act
      for (let i = 0; i < numOperations; i++) {
        await ansService.registerAgent(`memory-test-agent-${i}`, {
          description: `Memory test agent ${i}`,
          // Add some substantial metadata to test memory handling
          metadata: {
            capabilities: Array(50).fill(0).map((_, idx) => `capability-${idx}`),
            endpoints: Array(10).fill(0).map((_, idx) => `endpoint-${idx}`),
            configuration: {
              settings: Array(20).fill(0).map((_, idx) => ({ 
                key: `setting-${idx}`, 
                value: `value-${idx}`
              }))
            }
          }
        });
      }
      
      // Assert
      // In a real test, you would measure memory before and after,
      // but for this demonstration we're just ensuring the operations complete
      expect(mockSaveAgent).toHaveBeenCalledTimes(numOperations);
      
      // We could also add assertions checking that no memory leaks are detected
      // if we had the right tooling integrated
    });
    
    it('should handle large agent metadata efficiently', async () => {
      // Arrange - Create agent with large metadata
      const agentName = 'large-metadata-agent';
      const largeMetadata = {
        description: 'Agent with large metadata',
        capabilities: Array(1000).fill(0).map((_, idx) => `capability-${idx}`),
        configuration: {
          settings: Array(500).fill(0).map((_, idx) => ({ 
            key: `setting-${idx}`, 
            value: `value-${idx}`.repeat(100) // Make values large
          }))
        }
      };
      
      // Act
      const startTime = performance.now();
      await ansService.registerAgent(agentName, largeMetadata);
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // Assert
      // Even with large metadata, operation should complete in reasonable time
      // This threshold may need adjustment based on implementation
      expect(executionTime).toBeLessThan(200); 
      expect(mockSaveAgent).toHaveBeenCalled();
    });
  });
  
  describe('Database Performance', () => {
    it('should handle database errors gracefully under load', async () => {
      // Arrange
      mockSaveAgent.mockImplementation((agentName) => {
        // Simulate intermittent database errors
        if (agentName.includes('error')) {
          return Promise.reject(new Error('Database connection error'));
        }
        return Promise.resolve();
      });
      
      const requests = [
        ansService.registerAgent('normal-agent-1', { description: 'Normal agent' }),
        ansService.registerAgent('error-agent-1', { description: 'Error agent' }),
        ansService.registerAgent('normal-agent-2', { description: 'Normal agent' }),
        ansService.registerAgent('error-agent-2', { description: 'Error agent' }),
        ansService.registerAgent('normal-agent-3', { description: 'Normal agent' })
      ];
      
      // Act & Assert
      const results = await Promise.allSettled(requests);
      
      // Verify correct number of fulfilled/rejected promises
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');
      
      expect(fulfilled.length).toBe(3); // Normal agents should succeed
      expect(rejected.length).toBe(2);  // Error agents should fail
      
      // Verify error agents failed for the right reason
      rejected.forEach(result => {
        if (result.status === 'rejected') {
          expect(result.reason.message).toContain('Database connection error');
        }
      });
    });
  });
});
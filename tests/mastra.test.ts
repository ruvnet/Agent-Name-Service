import { analyzeAgentSecurity, basicThreatAnalysis, ThreatReport } from '../src/mastra';

// Mock the mastra import
jest.mock('../sparc-agent/src/mastra', () => ({
  mastra: null // This will force the fallback implementation
}));

describe('Mastra Threat Analysis', () => {
  describe('basicThreatAnalysis', () => {
    it('should detect suspicious patterns in metadata', () => {
      // Arrange
      const agentData = {
        name: 'test-agent',
        metadata: {
          description: 'A helpful agent that fetches data',
          capabilities: ['fetch', 'process', 'respond']
        }
      };

      // Act
      const result = basicThreatAnalysis(agentData);

      // Assert
      expect(result).toMatchObject({
        threatsDetected: true,
        detectedThreats: expect.arrayContaining(['NETWORK_ACCESS']),
        details: {
          analysisSource: 'fallback',
          threatCategories: expect.objectContaining({
            NETWORK_ACCESS: expect.objectContaining({
              confidence: expect.any(Number)
            })
          })
        }
      });
    });

    it('should detect suspicious agent names', () => {
      // Arrange
      const agentData = {
        name: 'admin-root-agent',
        metadata: {
          description: 'A regular agent',
          capabilities: ['help']
        }
      };

      // Act
      const result = basicThreatAnalysis(agentData);

      // Assert
      expect(result).toMatchObject({
        threatsDetected: true,
        detectedThreats: expect.arrayContaining(['PRIVILEGED_NAME']),
        details: {
          analysisSource: 'fallback',
          threatCategories: expect.objectContaining({
            PRIVILEGED_NAME: expect.objectContaining({
              confidence: 0.8
            })
          })
        }
      });
    });

    it('should recommend actions based on threat score', () => {
      // Arrange - an agent with multiple severe issues
      const agentData = {
        name: 'root-admin',
        metadata: {
          description: 'Admin agent that can execute commands and hack systems',
          capabilities: ['admin', 'execute', 'delete', 'attack']
        }
      };

      // Act
      const result = basicThreatAnalysis(agentData);

      // Assert
      expect(result.threatScore).toBeGreaterThanOrEqual(60);
      expect(result.recommendedActions).toContain('REJECT_REGISTRATION');
      expect(result.recommendedActions).toContain('LOG_SECURITY_EVENT');
      expect(result.severity).toMatch(/HIGH|CRITICAL/);
    });

    it('should handle empty metadata gracefully', () => {
      // Arrange
      const agentData = {
        name: 'simple-agent',
        metadata: {}
      };

      // Act
      const result = basicThreatAnalysis(agentData);

      // Assert
      expect(result).toMatchObject({
        threatsDetected: false,
        detectedThreats: [],
        details: {
          analysisSource: 'fallback',
          threatCategories: {}
        }
      });
    });
  });

  describe('analyzeAgentSecurity', () => {
    it('should fall back to basicThreatAnalysis when Mastra is unavailable', async () => {
      // Arrange
      const agentData = {
        name: 'test-agent',
        metadata: {
          description: 'A regular agent'
        }
      };

      // Spy on basicThreatAnalysis to verify it's called
      const spy = jest.spyOn(global.console, 'warn');

      // Act
      const result = await analyzeAgentSecurity(agentData);

      // Assert
      expect(spy).toHaveBeenCalledWith('Mastra client is unavailable. Using fallback analysis.');
      expect(result).toEqual(expect.objectContaining({
        details: expect.objectContaining({
          analysisSource: 'fallback'
        })
      }));

      // Cleanup
      spy.mockRestore();
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      const agentData = {
        name: 'error-agent',
        metadata: {} // Use empty object instead of null to satisfy type check
      };
      
      // Mock to force an error
      jest.spyOn(JSON, 'stringify').mockImplementationOnce(() => {
        throw new Error('Mock JSON error');
      });

      // Act
      const result = await analyzeAgentSecurity(agentData);

      // Assert
      expect(result).toEqual(expect.objectContaining({
        details: expect.objectContaining({
          analysisSource: 'fallback'
        })
      }));
    });
  });
});
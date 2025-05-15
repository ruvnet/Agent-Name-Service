import { 
  SecurityEvent, 
  SecurityEventType, 
  SecuritySeverity
} from '../../src/types';
import { createMockSecurityEvent } from '../test-utils';

// Mock the database service
const mockRecordSecurityEvent = jest.fn();
const mockQuerySecurityEvents = jest.fn();
const mockDatabaseService = {
  recordSecurityEvent: mockRecordSecurityEvent,
  querySecurityEvents: mockQuerySecurityEvents
};

jest.mock('../../src/database/database-service-factory', () => ({
  DatabaseServiceFactory: {
    getInstance: jest.fn().mockResolvedValue(mockDatabaseService)
  }
}));

// Mock the Mastra API client
const mockReportThreat = jest.fn();
const mockGetThreatIntelligence = jest.fn();
const mockAnalyzeActivity = jest.fn();
const mockMastraClient = {
  reportThreat: mockReportThreat,
  getThreatIntelligence: mockGetThreatIntelligence,
  analyzeActivity: mockAnalyzeActivity
};

jest.mock('../../src/threat/mastra-client', () => ({
  MastraClient: {
    getInstance: jest.fn().mockResolvedValue(mockMastraClient)
  }
}));

// Import after mocking
import { ThreatModelingService } from '../../src/threat/threat-modeling-service';

describe('ThreatModelingService', () => {
  let threatModelingService: ThreatModelingService;
  
  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create a new service instance
    threatModelingService = new ThreatModelingService();
    // Set initialized directly
    (threatModelingService as any).initialized = true;
    (threatModelingService as any).databaseService = mockDatabaseService;
    (threatModelingService as any).mastraClient = mockMastraClient;
  });
  
  describe('initialize', () => {
    beforeEach(() => {
      // Reset initialized state for these tests
      (threatModelingService as any).initialized = false;
    });
    
    it('should connect to database and Mastra services on initialization', async () => {
      // Arrange
      const { DatabaseServiceFactory } = require('../../src/database/database-service-factory');
      const { MastraClient } = require('../../src/threat/mastra-client');
      
      // Act
      await threatModelingService.initialize();
      
      // Assert
      expect(DatabaseServiceFactory.getInstance).toHaveBeenCalledTimes(1);
      expect(MastraClient.getInstance).toHaveBeenCalledTimes(1);
      expect(threatModelingService.initialized).toBe(true);
    });
    
    it('should not reinitialize when already initialized', async () => {
      // Arrange
      (threatModelingService as any).initialized = true;
      const { DatabaseServiceFactory } = require('../../src/database/database-service-factory');
      
      // Act
      await threatModelingService.initialize();
      
      // Assert
      expect(DatabaseServiceFactory.getInstance).not.toHaveBeenCalled();
    });
    
    it('should throw error when initialization fails', async () => {
      // Arrange
      const { DatabaseServiceFactory } = require('../../src/database/database-service-factory');
      const error = new Error('Database error');
      DatabaseServiceFactory.getInstance.mockRejectedValueOnce(error);
      
      // Act & Assert
      await expect(threatModelingService.initialize()).rejects.toThrow('Failed to initialize threat modeling service');
    });
  });
  
  describe('reportSecurityEvent', () => {
    it('should record security event and report to Mastra', async () => {
      // Arrange
      const event = createMockSecurityEvent();
      mockRecordSecurityEvent.mockResolvedValue(event.id);
      mockReportThreat.mockResolvedValue({ threatId: 'mastra-threat-1', mitigationRecommended: false });
      
      // Act
      const result = await threatModelingService.reportSecurityEvent(event);
      
      // Assert
      expect(result).toBe(event.id);
      expect(mockRecordSecurityEvent).toHaveBeenCalledWith(event);
      expect(mockReportThreat).toHaveBeenCalledWith({
        source: event.source,
        target: event.target,
        eventType: event.eventType,
        severity: event.severity,
        description: event.description,
        metadata: event.metadata,
        timestamp: event.timestamp
      });
    });
    
    it('should apply mitigations when recommended by Mastra', async () => {
      // Arrange
      const event = createMockSecurityEvent();
      mockRecordSecurityEvent.mockResolvedValue(event.id);
      mockReportThreat.mockResolvedValue({ 
        threatId: 'mastra-threat-1', 
        mitigationRecommended: true,
        mitigationAction: 'BLOCK_SOURCE',
        mitigationDetails: 'Block suspicious IP temporarily'
      });
      
      // Mock the applyMitigation method
      (threatModelingService as any).applyMitigation = jest.fn().mockResolvedValue(true);
      
      // Act
      const result = await threatModelingService.reportSecurityEvent(event);
      
      // Assert
      expect(result).toBe(event.id);
      expect((threatModelingService as any).applyMitigation).toHaveBeenCalledWith(
        'BLOCK_SOURCE',
        event.source,
        'Block suspicious IP temporarily'
      );
      expect(mockRecordSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({
        mitigationApplied: true,
        mitigationDetails: expect.stringContaining('Block suspicious IP temporarily')
      }));
    });
    
    it('should handle mitigation application failure', async () => {
      // Arrange
      const event = createMockSecurityEvent();
      mockRecordSecurityEvent.mockResolvedValue(event.id);
      mockReportThreat.mockResolvedValue({ 
        threatId: 'mastra-threat-1', 
        mitigationRecommended: true,
        mitigationAction: 'BLOCK_SOURCE',
        mitigationDetails: 'Block suspicious IP temporarily'
      });
      
      // Mock the applyMitigation method failure
      (threatModelingService as any).applyMitigation = jest.fn().mockResolvedValue(false);
      
      // Act
      const result = await threatModelingService.reportSecurityEvent(event);
      
      // Assert
      expect(result).toBe(event.id);
      expect((threatModelingService as any).applyMitigation).toHaveBeenCalled();
      expect(mockRecordSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({
        mitigationApplied: false,
        mitigationDetails: expect.stringContaining('Failed to apply mitigation')
      }));
    });
    
    it('should throw error when database operation fails', async () => {
      // Arrange
      const event = createMockSecurityEvent();
      const error = new Error('Database error');
      mockRecordSecurityEvent.mockRejectedValue(error);
      
      // Act & Assert
      await expect(threatModelingService.reportSecurityEvent(event)).rejects.toThrow('Failed to report security event');
    });
    
    it('should throw error when Mastra reporting fails', async () => {
      // Arrange
      const event = createMockSecurityEvent();
      const error = new Error('Mastra API error');
      mockReportThreat.mockRejectedValue(error);
      
      // Act & Assert
      await expect(threatModelingService.reportSecurityEvent(event)).rejects.toThrow('Failed to report threat to Mastra');
    });
  });
  
  describe('analyzeActivity', () => {
    it('should detect threats in activity data', async () => {
      // Arrange
      const activityData = {
        agentId: 'test-agent',
        activityType: 'RESOLUTION_REQUEST',
        frequency: 120,
        timeWindow: 60,
        pattern: 'BURST',
        source: '192.168.1.100'
      };
      
      const threatAnalysis = {
        threatDetected: true,
        confidence: 0.85,
        threatType: 'RATE_LIMIT_ABUSE',
        severity: 'MEDIUM',
        recommendation: 'Implement rate limiting for this source'
      };
      
      mockAnalyzeActivity.mockResolvedValue(threatAnalysis);
      
      // Mock reportSecurityEvent method
      threatModelingService.reportSecurityEvent = jest.fn().mockResolvedValue('event-id');
      
      // Act
      const result = await threatModelingService.analyzeActivity(activityData);
      
      // Assert
      expect(result).toEqual({
        threatDetected: true,
        threatType: 'RATE_LIMIT_ABUSE',
        severity: 'MEDIUM',
        eventId: 'event-id'
      });
      expect(mockAnalyzeActivity).toHaveBeenCalledWith(activityData);
      expect(threatModelingService.reportSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({
        eventType: SecurityEventType.RATE_LIMIT_EXCEEDED,
        severity: SecuritySeverity.MEDIUM,
        source: '192.168.1.100',
        target: 'test-agent',
        description: expect.stringContaining('RATE_LIMIT_ABUSE')
      }));
    });
    
    it('should return no threat when none detected', async () => {
      // Arrange
      const activityData = {
        agentId: 'test-agent',
        activityType: 'RESOLUTION_REQUEST',
        frequency: 5,
        timeWindow: 60,
        pattern: 'REGULAR',
        source: '192.168.1.100'
      };
      
      const threatAnalysis = {
        threatDetected: false,
        confidence: 0.95,
        recommendation: 'No action needed'
      };
      
      mockAnalyzeActivity.mockResolvedValue(threatAnalysis);
      
      // Act
      const result = await threatModelingService.analyzeActivity(activityData);
      
      // Assert
      expect(result).toEqual({
        threatDetected: false
      });
      expect(mockAnalyzeActivity).toHaveBeenCalledWith(activityData);
    });
    
    it('should throw error when Mastra analysis fails', async () => {
      // Arrange
      const activityData = {
        agentId: 'test-agent',
        activityType: 'RESOLUTION_REQUEST',
        frequency: 120,
        timeWindow: 60,
        pattern: 'BURST',
        source: '192.168.1.100'
      };
      
      const error = new Error('Mastra API error');
      mockAnalyzeActivity.mockRejectedValue(error);
      
      // Act & Assert
      await expect(threatModelingService.analyzeActivity(activityData)).rejects.toThrow('Failed to analyze activity');
    });
  });
  
  describe('getSecurityEvents', () => {
    it('should return security events matching the query', async () => {
      // Arrange
      const event1 = createMockSecurityEvent({
        eventType: SecurityEventType.AUTHENTICATION_FAILURE,
        severity: SecuritySeverity.HIGH
      });
      
      const event2 = createMockSecurityEvent({
        eventType: SecurityEventType.RATE_LIMIT_EXCEEDED,
        severity: SecuritySeverity.MEDIUM
      });
      
      mockQuerySecurityEvents.mockResolvedValue([event1, event2]);
      
      const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      const endTime = new Date();
      const eventTypes = [SecurityEventType.AUTHENTICATION_FAILURE, SecurityEventType.RATE_LIMIT_EXCEEDED];
      const severities = [SecuritySeverity.HIGH, SecuritySeverity.MEDIUM];
      
      // Act
      const results = await threatModelingService.getSecurityEvents(
        startTime,
        endTime,
        eventTypes,
        severities
      );
      
      // Assert
      expect(results).toEqual([event1, event2]);
      expect(mockQuerySecurityEvents).toHaveBeenCalledWith(
        startTime,
        endTime,
        eventTypes,
        severities,
        undefined,
        undefined,
        undefined,
        undefined
      );
    });
    
    it('should return empty array when no events match query', async () => {
      // Arrange
      mockQuerySecurityEvents.mockResolvedValue([]);
      
      // Act
      const results = await threatModelingService.getSecurityEvents();
      
      // Assert
      expect(results).toEqual([]);
      expect(mockQuerySecurityEvents).toHaveBeenCalled();
    });
    
    it('should throw error when database operation fails', async () => {
      // Arrange
      const error = new Error('Database error');
      mockQuerySecurityEvents.mockRejectedValue(error);
      
      // Act & Assert
      await expect(threatModelingService.getSecurityEvents()).rejects.toThrow('Failed to query security events');
    });
  });
  
  describe('getThreatIntelligence', () => {
    it('should return threat intelligence data from Mastra', async () => {
      // Arrange
      const threatIntelligence = {
        knownThreats: [
          {
            type: 'CREDENTIAL_STUFFING',
            sources: ['192.168.1.100', '192.168.1.101'],
            lastSeen: new Date(),
            confidence: 0.9
          },
          {
            type: 'API_ABUSE',
            sources: ['192.168.1.200'],
            lastSeen: new Date(),
            confidence: 0.85
          }
        ],
        recommendations: [
          'Implement rate limiting',
          'Use CAPTCHA for authentication'
        ],
        threatLevel: 'MEDIUM'
      };
      
      mockGetThreatIntelligence.mockResolvedValue(threatIntelligence);
      
      // Act
      const result = await threatModelingService.getThreatIntelligence();
      
      // Assert
      expect(result).toEqual(threatIntelligence);
      expect(mockGetThreatIntelligence).toHaveBeenCalled();
    });
    
    it('should throw error when Mastra API call fails', async () => {
      // Arrange
      const error = new Error('Mastra API error');
      mockGetThreatIntelligence.mockRejectedValue(error);
      
      // Act & Assert
      await expect(threatModelingService.getThreatIntelligence()).rejects.toThrow('Failed to get threat intelligence');
    });
  });
  
  describe('applyMitigation', () => {
    it('should apply BLOCK_SOURCE mitigation', async () => {
      // Arrange
      const action = 'BLOCK_SOURCE';
      const target = '192.168.1.100';
      const details = 'Suspicious activity';
      
      // Mock implementation of private method
      (threatModelingService as any).blockSource = jest.fn().mockResolvedValue(true);
      
      // Act
      const result = await (threatModelingService as any).applyMitigation(action, target, details);
      
      // Assert
      expect(result).toBe(true);
      expect((threatModelingService as any).blockSource).toHaveBeenCalledWith(target, details);
    });
    
    it('should apply RATE_LIMIT mitigation', async () => {
      // Arrange
      const action = 'RATE_LIMIT';
      const target = 'agent-id';
      const details = 'Too many requests';
      
      // Mock implementation of private method
      (threatModelingService as any).applyRateLimit = jest.fn().mockResolvedValue(true);
      
      // Act
      const result = await (threatModelingService as any).applyMitigation(action, target, details);
      
      // Assert
      expect(result).toBe(true);
      expect((threatModelingService as any).applyRateLimit).toHaveBeenCalledWith(target, details);
    });
    
    it('should handle unknown mitigation action type', async () => {
      // Arrange
      const action = 'UNKNOWN_ACTION';
      const target = 'agent-id';
      const details = 'Test details';
      
      // Act
      const result = await (threatModelingService as any).applyMitigation(action, target, details);
      
      // Assert
      expect(result).toBe(false);
    });
  });
});
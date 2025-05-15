import { 
  AgentRecord, 
  Certificate, 
  SecurityEvent,
  AgentStatus,
  CertificateStatus,
  SecurityEventType,
  SecuritySeverity,
  SQLiteDatabase
} from '../../src/types';
import { 
  createMockAgent, 
  createMockCertificate, 
  createMockSecurityEvent, 
  createMockDatabase 
} from '../test-utils';

// Mock the database module
jest.mock('../../src/database/database', () => ({
  openDatabase: jest.fn().mockImplementation(() => createMockDatabase())
}));

// Import after mocking
import { DatabaseService } from '../../src/database/databaseService';

describe('DatabaseService', () => {
  let databaseService: DatabaseService;
  let mockDb: ReturnType<typeof createMockDatabase>;
  
  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create a fresh mock database
    mockDb = createMockDatabase();
    
    // Create the database service with the mock
    databaseService = new DatabaseService();
    (databaseService as any).db = mockDb;
    (databaseService as any).initialized = true;
  });
  
  describe('initialize', () => {
    beforeEach(() => {
      // Reset initialized state for these tests
      (databaseService as any).initialized = false;
    });
    
    it('should create tables when not initialized', async () => {
      // Arrange
      const { openDatabase } = require('../../src/database/database');
      openDatabase.mockResolvedValue(mockDb);
      
      // Act
      await databaseService.initialize();
      
      // Assert
      expect(openDatabase).toHaveBeenCalledWith('./ans_database.sqlite');
      expect(mockDb.execute).toHaveBeenCalled();
      expect(databaseService.initialized).toBe(true);
    });
    
    it('should not reinitialize when already initialized', async () => {
      // Arrange
      (databaseService as any).initialized = true;
      const { openDatabase } = require('../../src/database/database');
      
      // Act
      await databaseService.initialize();
      
      // Assert
      expect(openDatabase).not.toHaveBeenCalled();
      expect(mockDb.execute).not.toHaveBeenCalled();
    });
    
    it('should throw an error when database initialization fails', async () => {
      // Arrange
      const { openDatabase } = require('../../src/database/database');
      const error = new Error('Database connection failed');
      openDatabase.mockRejectedValue(error);
      
      // Act & Assert
      await expect(databaseService.initialize()).rejects.toThrow('Failed to initialize database');
    });
  });
  
  describe('createAgent', () => {
    it('should create agent with valid data', async () => {
      // Arrange
      const agent = createMockAgent();
      mockDb.run.mockResolvedValue(undefined);
      
      // Mock the private methods
      (databaseService as any).createEndpoint = jest.fn().mockResolvedValue(undefined);
      (databaseService as any).setAgentCapabilities = jest.fn().mockResolvedValue(undefined);
      (databaseService as any).setAgentMetadata = jest.fn().mockResolvedValue(undefined);
      
      // Act
      const result = await databaseService.createAgent(agent);
      
      // Assert
      expect(result).toBe(agent.id);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agents'),
        expect.arrayContaining([agent.id, agent.name, agent.publicKey])
      );
      expect((databaseService as any).createEndpoint).toHaveBeenCalled();
      expect((databaseService as any).setAgentCapabilities).toHaveBeenCalled();
      expect((databaseService as any).setAgentMetadata).toHaveBeenCalled();
    });
    
    it('should throw an error when agent creation fails', async () => {
      // Arrange
      const agent = createMockAgent();
      const error = new Error('Database error');
      mockDb.run.mockRejectedValue(error);
      
      // Act & Assert
      await expect(databaseService.createAgent(agent)).rejects.toThrow('Failed to create agent');
    });
    
    it('should throw an error when database is not initialized', async () => {
      // Arrange
      (databaseService as any).initialized = false;
      const agent = createMockAgent();
      
      // Act & Assert
      await expect(databaseService.createAgent(agent)).rejects.toThrow('Database is not initialized');
    });
  });
  
  describe('getAgent', () => {
    it('should return agent when found by ID', async () => {
      // Arrange
      const agent = createMockAgent();
      const mockAgentRow = {
        id: agent.id,
        name: agent.name,
        public_key: agent.publicKey,
        certificate_id: agent.certificateId,
        default_endpoint_id: agent.endpoints?.[0].id,
        version: agent.version,
        description: agent.description,
        created_at: agent.createdAt?.getTime(),
        updated_at: agent.updatedAt?.getTime(),
        expires_at: agent.expiresAt?.getTime(),
        status: agent.status,
        owner: agent.owner
      };
      
      mockDb.get.mockResolvedValue(mockAgentRow);
      
      // Mock the private methods
      (databaseService as any).getEndpointsByAgentId = jest.fn().mockResolvedValue(agent.endpoints);
      (databaseService as any).getAgentCapabilities = jest.fn().mockResolvedValue(agent.capabilities);
      (databaseService as any).getAgentMetadata = jest.fn().mockResolvedValue(agent.metadata);
      (databaseService as any).buildAgentRecord = jest.fn().mockReturnValue(agent);
      
      // Act
      const result = await databaseService.getAgent(agent.id);
      
      // Assert
      expect(result).toEqual(agent);
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM agents WHERE id = ?'),
        [agent.id]
      );
      expect((databaseService as any).getEndpointsByAgentId).toHaveBeenCalledWith(agent.id);
      expect((databaseService as any).getAgentCapabilities).toHaveBeenCalledWith(agent.id);
      expect((databaseService as any).getAgentMetadata).toHaveBeenCalledWith(agent.id);
      expect((databaseService as any).buildAgentRecord).toHaveBeenCalledWith(
        mockAgentRow,
        agent.endpoints,
        agent.capabilities,
        agent.metadata
      );
    });
    
    it('should return null when agent not found', async () => {
      // Arrange
      mockDb.get.mockResolvedValue(null);
      
      // Act
      const result = await databaseService.getAgent('non-existent-id');
      
      // Assert
      expect(result).toBeNull();
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM agents WHERE id = ?'),
        ['non-existent-id']
      );
    });
    
    it('should throw error when database operation fails', async () => {
      // Arrange
      const error = new Error('Database error');
      mockDb.get.mockRejectedValue(error);
      
      // Act & Assert
      await expect(databaseService.getAgent('agent-id')).rejects.toThrow('Failed to get agent');
    });
  });
  
  describe('updateAgent', () => {
    it('should update agent when it exists', async () => {
      // Arrange
      const agent = createMockAgent();
      
      // Mock getAgent to return the agent
      databaseService.getAgent = jest.fn().mockResolvedValue(agent);
      
      // Mock the private methods
      (databaseService as any).deleteEndpointsByAgentId = jest.fn().mockResolvedValue(undefined);
      (databaseService as any).createEndpoint = jest.fn().mockResolvedValue(undefined);
      (databaseService as any).setAgentCapabilities = jest.fn().mockResolvedValue(undefined);
      (databaseService as any).setAgentMetadata = jest.fn().mockResolvedValue(undefined);
      
      // Act
      const result = await databaseService.updateAgent(agent);
      
      // Assert
      expect(result).toBe(true);
      expect(databaseService.getAgent).toHaveBeenCalledWith(agent.id);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE agents'),
        expect.arrayContaining([
          agent.name,
          agent.publicKey,
          agent.certificateId,
          agent.id
        ])
      );
    });
    
    it('should return false when agent does not exist', async () => {
      // Arrange
      const agent = createMockAgent();
      
      // Mock getAgent to return null (agent not found)
      databaseService.getAgent = jest.fn().mockResolvedValue(null);
      
      // Act
      const result = await databaseService.updateAgent(agent);
      
      // Assert
      expect(result).toBe(false);
      expect(databaseService.getAgent).toHaveBeenCalledWith(agent.id);
      expect(mockDb.run).not.toHaveBeenCalled();
    });
    
    it('should throw error when database operation fails', async () => {
      // Arrange
      const agent = createMockAgent();
      const error = new Error('Database error');
      
      // Mock getAgent to throw an error
      databaseService.getAgent = jest.fn().mockRejectedValue(error);
      
      // Act & Assert
      await expect(databaseService.updateAgent(agent)).rejects.toThrow('Failed to update agent');
    });
  });
  
  describe('deleteAgent', () => {
    it('should delete agent when it exists', async () => {
      // Arrange
      const agent = createMockAgent();
      
      // Mock getAgent to return the agent
      databaseService.getAgent = jest.fn().mockResolvedValue(agent);
      
      // Act
      const result = await databaseService.deleteAgent(agent.id);
      
      // Assert
      expect(result).toBe(true);
      expect(databaseService.getAgent).toHaveBeenCalledWith(agent.id);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM agents WHERE id = ?'),
        [agent.id]
      );
    });
    
    it('should return false when agent does not exist', async () => {
      // Arrange
      // Mock getAgent to return null (agent not found)
      databaseService.getAgent = jest.fn().mockResolvedValue(null);
      
      // Act
      const result = await databaseService.deleteAgent('non-existent-id');
      
      // Assert
      expect(result).toBe(false);
      expect(databaseService.getAgent).toHaveBeenCalledWith('non-existent-id');
      expect(mockDb.run).not.toHaveBeenCalled();
    });
    
    it('should throw error when database operation fails', async () => {
      // Arrange
      const agent = createMockAgent();
      const error = new Error('Database error');
      
      // Mock getAgent to throw an error
      databaseService.getAgent = jest.fn().mockRejectedValue(error);
      
      // Act & Assert
      await expect(databaseService.deleteAgent(agent.id)).rejects.toThrow('Failed to delete agent');
    });
  });
  
  describe('queryAgents', () => {
    it('should return matching agents for query', async () => {
      // Arrange
      const agent1 = createMockAgent({ name: 'Test Agent 1' });
      const agent2 = createMockAgent({ name: 'Test Agent 2' });
      
      const mockAgentRows = [
        {
          id: agent1.id,
          name: agent1.name,
          // Other agent properties...
        },
        {
          id: agent2.id,
          name: agent2.name,
          // Other agent properties...
        }
      ];
      
      mockDb.all.mockResolvedValue(mockAgentRows);
      
      // Mock the private methods
      (databaseService as any).getEndpointsByAgentId = jest.fn()
        .mockResolvedValueOnce(agent1.endpoints)
        .mockResolvedValueOnce(agent2.endpoints);
      (databaseService as any).getAgentCapabilities = jest.fn()
        .mockResolvedValueOnce(agent1.capabilities)
        .mockResolvedValueOnce(agent2.capabilities);
      (databaseService as any).getAgentMetadata = jest.fn()
        .mockResolvedValueOnce(agent1.metadata)
        .mockResolvedValueOnce(agent2.metadata);
      (databaseService as any).buildAgentRecord = jest.fn()
        .mockReturnValueOnce(agent1)
        .mockReturnValueOnce(agent2);
      
      const query = { name: 'Test' };
      
      // Act
      const results = await databaseService.queryAgents(query);
      
      // Assert
      expect(results).toEqual([agent1, agent2]);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT DISTINCT a.*'),
        expect.arrayContaining(['%Test%'])
      );
      expect((databaseService as any).getEndpointsByAgentId).toHaveBeenCalledTimes(2);
      expect((databaseService as any).getAgentCapabilities).toHaveBeenCalledTimes(2);
      expect((databaseService as any).getAgentMetadata).toHaveBeenCalledTimes(2);
      expect((databaseService as any).buildAgentRecord).toHaveBeenCalledTimes(2);
    });
    
    it('should return empty array when no agents match query', async () => {
      // Arrange
      mockDb.all.mockResolvedValue([]);
      
      const query = { name: 'NonExistent' };
      
      // Act
      const results = await databaseService.queryAgents(query);
      
      // Assert
      expect(results).toEqual([]);
      expect(mockDb.all).toHaveBeenCalled();
    });
    
    it('should include capability filters in query when specified', async () => {
      // Arrange
      mockDb.all.mockResolvedValue([]);
      
      const query = {
        capabilities: ['compute', 'storage'],
        allCapabilities: true
      };
      
      // Act
      await databaseService.queryAgents(query);
      
      // Assert
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('JOIN agent_capabilities ac ON a.id = ac.agent_id'),
        expect.arrayContaining(['compute', 'storage', 2])
      );
    });
    
    it('should throw error when database operation fails', async () => {
      // Arrange
      const error = new Error('Database error');
      mockDb.all.mockRejectedValue(error);
      
      // Act & Assert
      await expect(databaseService.queryAgents({})).rejects.toThrow('Failed to query agents');
    });
  });
  
  describe('createCertificate', () => {
    it('should create certificate with valid data', async () => {
      // Arrange
      const certificate = createMockCertificate();
      mockDb.run.mockResolvedValue(undefined);
      
      // Mock the private method
      (databaseService as any).setCertificateMetadata = jest.fn().mockResolvedValue(undefined);
      
      // Act
      const result = await databaseService.createCertificate(certificate);
      
      // Assert
      expect(result).toBe(certificate.id);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO certificates'),
        expect.arrayContaining([
          certificate.id,
          certificate.subject,
          certificate.issuer,
          certificate.notBefore.getTime(),
          certificate.notAfter.getTime(),
          certificate.publicKey,
          certificate.certificate,
          certificate.fingerprint
        ])
      );
      expect((databaseService as any).setCertificateMetadata).toHaveBeenCalledWith(
        certificate.id,
        certificate.metadata
      );
    });
    
    it('should throw error when certificate creation fails', async () => {
      // Arrange
      const certificate = createMockCertificate();
      const error = new Error('Database error');
      mockDb.run.mockRejectedValue(error);
      
      // Act & Assert
      await expect(databaseService.createCertificate(certificate)).rejects.toThrow('Failed to create certificate');
    });
  });
  
  describe('getCertificate', () => {
    it('should return certificate when found by ID', async () => {
      // Arrange
      const certificate = createMockCertificate();
      const mockCertRow = {
        id: certificate.id,
        subject: certificate.subject,
        issuer: certificate.issuer,
        not_before: certificate.notBefore.getTime(),
        not_after: certificate.notAfter.getTime(),
        public_key: certificate.publicKey,
        certificate: certificate.certificate,
        fingerprint: certificate.fingerprint,
        status: certificate.status,
        created_at: Date.now()
      };
      
      mockDb.get.mockResolvedValue(mockCertRow);
      
      // Mock the private methods
      (databaseService as any).getCertificateMetadata = jest.fn().mockResolvedValue(certificate.metadata);
      (databaseService as any).buildCertificate = jest.fn().mockReturnValue(certificate);
      
      // Act
      const result = await databaseService.getCertificate(certificate.id);
      
      // Assert
      expect(result).toEqual(certificate);
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM certificates WHERE id = ?'),
        [certificate.id]
      );
      expect((databaseService as any).getCertificateMetadata).toHaveBeenCalledWith(certificate.id);
      expect((databaseService as any).buildCertificate).toHaveBeenCalledWith(
        mockCertRow,
        certificate.metadata
      );
    });
    
    it('should return null when certificate not found', async () => {
      // Arrange
      mockDb.get.mockResolvedValue(null);
      
      // Act
      const result = await databaseService.getCertificate('non-existent-id');
      
      // Assert
      expect(result).toBeNull();
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM certificates WHERE id = ?'),
        ['non-existent-id']
      );
    });
  });
  
  describe('getCertificateByFingerprint', () => {
    it('should return certificate when found by fingerprint', async () => {
      // Arrange
      const certificate = createMockCertificate();
      const mockCertRow = {
        id: certificate.id,
        subject: certificate.subject,
        issuer: certificate.issuer,
        not_before: certificate.notBefore.getTime(),
        not_after: certificate.notAfter.getTime(),
        public_key: certificate.publicKey,
        certificate: certificate.certificate,
        fingerprint: certificate.fingerprint,
        status: certificate.status,
        created_at: Date.now()
      };
      
      mockDb.get.mockResolvedValue(mockCertRow);
      
      // Mock the private methods
      (databaseService as any).getCertificateMetadata = jest.fn().mockResolvedValue(certificate.metadata);
      (databaseService as any).buildCertificate = jest.fn().mockReturnValue(certificate);
      
      // Act
      const result = await databaseService.getCertificateByFingerprint(certificate.fingerprint);
      
      // Assert
      expect(result).toEqual(certificate);
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM certificates WHERE fingerprint = ?'),
        [certificate.fingerprint]
      );
    });
    
    it('should return null when certificate not found by fingerprint', async () => {
      // Arrange
      mockDb.get.mockResolvedValue(null);
      
      // Act
      const result = await databaseService.getCertificateByFingerprint('non-existent-fingerprint');
      
      // Assert
      expect(result).toBeNull();
    });
  });
  
  describe('updateCertificateStatus', () => {
    it('should update certificate status when certificate exists', async () => {
      // Arrange
      const certificate = createMockCertificate();
      
      // Mock getCertificate to return the certificate
      databaseService.getCertificate = jest.fn().mockResolvedValue(certificate);
      
      // Act
      const result = await databaseService.updateCertificateStatus(
        certificate.id,
        CertificateStatus.REVOKED
      );
      
      // Assert
      expect(result).toBe(true);
      expect(databaseService.getCertificate).toHaveBeenCalledWith(certificate.id);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE certificates SET status = ? WHERE id = ?'),
        [CertificateStatus.REVOKED, certificate.id]
      );
    });
    
    it('should return false when certificate does not exist', async () => {
      // Arrange
      // Mock getCertificate to return null (certificate not found)
      databaseService.getCertificate = jest.fn().mockResolvedValue(null);
      
      // Act
      const result = await databaseService.updateCertificateStatus(
        'non-existent-id',
        CertificateStatus.REVOKED
      );
      
      // Assert
      expect(result).toBe(false);
      expect(databaseService.getCertificate).toHaveBeenCalledWith('non-existent-id');
      expect(mockDb.run).not.toHaveBeenCalled();
    });
  });
  
  describe('recordSecurityEvent', () => {
    it('should record security event with valid data', async () => {
      // Arrange
      const event = createMockSecurityEvent();
      mockDb.run.mockResolvedValue(undefined);
      
      // Mock the private method
      (databaseService as any).setSecurityEventMetadata = jest.fn().mockResolvedValue(undefined);
      
      // Act
      const result = await databaseService.recordSecurityEvent(event);
      
      // Assert
      expect(result).toBe(event.id);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO security_events'),
        expect.arrayContaining([
          event.id,
          event.timestamp.getTime(),
          event.eventType,
          event.severity,
          event.source,
          event.target,
          event.description,
          event.mitigationApplied ? 1 : 0,
          event.mitigationDetails
        ])
      );
      expect((databaseService as any).setSecurityEventMetadata).toHaveBeenCalledWith(
        event.id,
        event.metadata
      );
    });
    
    it('should throw error when security event recording fails', async () => {
      // Arrange
      const event = createMockSecurityEvent();
      const error = new Error('Database error');
      mockDb.run.mockRejectedValue(error);
      
      // Act & Assert
      await expect(databaseService.recordSecurityEvent(event)).rejects.toThrow('Failed to record security event');
    });
  });
  
  describe('querySecurityEvents', () => {
    it('should return matching security events for query', async () => {
      // Arrange
      const event1 = createMockSecurityEvent({ 
        eventType: SecurityEventType.AUTHENTICATION_FAILURE,
        severity: SecuritySeverity.HIGH
      });
      const event2 = createMockSecurityEvent({ 
        eventType: SecurityEventType.RATE_LIMIT_EXCEEDED,
        severity: SecuritySeverity.MEDIUM
      });
      
      const mockEventRows = [
        {
          id: event1.id,
          timestamp: event1.timestamp.getTime(),
          event_type: event1.eventType,
          severity: event1.severity,
          source: event1.source,
          target: event1.target,
          description: event1.description,
          mitigation_applied: event1.mitigationApplied ? 1 : 0,
          mitigation_details: event1.mitigationDetails
        },
        {
          id: event2.id,
          timestamp: event2.timestamp.getTime(),
          event_type: event2.eventType,
          severity: event2.severity,
          source: event2.source,
          target: event2.target,
          description: event2.description,
          mitigation_applied: event2.mitigationApplied ? 1 : 0,
          mitigation_details: event2.mitigationDetails
        }
      ];
      
      mockDb.all.mockResolvedValue(mockEventRows);
      
      // Mock the private methods
      (databaseService as any).getSecurityEventMetadata = jest.fn()
        .mockResolvedValueOnce(event1.metadata)
        .mockResolvedValueOnce(event2.metadata);
      (databaseService as any).buildSecurityEvent = jest.fn()
        .mockReturnValueOnce(event1)
        .mockReturnValueOnce(event2);
      
      const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      const endTime = new Date();
      const eventTypes = [SecurityEventType.AUTHENTICATION_FAILURE, SecurityEventType.RATE_LIMIT_EXCEEDED];
      const severities = [SecuritySeverity.HIGH, SecuritySeverity.MEDIUM];
      
      // Act
      const results = await databaseService.querySecurityEvents(
        startTime,
        endTime,
        eventTypes,
        severities
      );
      
      // Assert
      expect(results).toEqual([event1, event2]);
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM security_events'),
        expect.arrayContaining([
          startTime.getTime(),
          endTime.getTime(),
          SecurityEventType.AUTHENTICATION_FAILURE,
          SecurityEventType.RATE_LIMIT_EXCEEDED,
          SecuritySeverity.HIGH,
          SecuritySeverity.MEDIUM
        ])
      );
      expect((databaseService as any).getSecurityEventMetadata).toHaveBeenCalledTimes(2);
      expect((databaseService as any).buildSecurityEvent).toHaveBeenCalledTimes(2);
    });
    
    it('should return empty array when no security events match query', async () => {
      // Arrange
      mockDb.all.mockResolvedValue([]);
      
      // Act
      const results = await databaseService.querySecurityEvents();
      
      // Assert
      expect(results).toEqual([]);
      expect(mockDb.all).toHaveBeenCalled();
    });
    
    it('should throw error when database operation fails', async () => {
      // Arrange
      const error = new Error('Database error');
      mockDb.all.mockRejectedValue(error);
      
      // Act & Assert
      await expect(databaseService.querySecurityEvents()).rejects.toThrow('Failed to query security events');
    });
  });
  
  describe('close', () => {
    it('should close the database connection when initialized', async () => {
      // Arrange
      (databaseService as any).initialized = true;
      
      // Act
      await databaseService.close();
      
      // Assert
      expect(mockDb.close).toHaveBeenCalled();
      expect(databaseService.initialized).toBe(false);
    });
    
    it('should not attempt to close when not initialized', async () => {
      // Arrange
      (databaseService as any).initialized = false;
      
      // Act
      await databaseService.close();
      
      // Assert
      expect(mockDb.close).not.toHaveBeenCalled();
    });
  });
});
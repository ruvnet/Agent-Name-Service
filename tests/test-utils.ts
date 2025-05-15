import { v4 as uuidv4 } from 'uuid';
import {
  AgentRecord,
  Certificate,
  SecurityEvent,
  AgentStatus,
  CertificateStatus,
  SecurityEventType,
  SecuritySeverity,
  Endpoint,
  HealthStatus
} from '../src/types';

/**
 * Creates a mock agent record for testing
 */
export function createMockAgent(partial: Partial<AgentRecord> = {}): AgentRecord {
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
  
  return {
    id: partial.id || uuidv4(),
    name: partial.name || 'Test Agent',
    publicKey: partial.publicKey || '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkq...\n-----END PUBLIC KEY-----',
    certificateId: partial.certificateId || uuidv4(),
    endpoints: partial.endpoints || [createMockEndpoint()],
    defaultEndpoint: partial.defaultEndpoint,
    capabilities: partial.capabilities || ['test', 'mock'],
    version: partial.version || '1.0.0',
    description: partial.description || 'A test agent',
    metadata: partial.metadata || { test: 'value' },
    createdAt: partial.createdAt || now,
    updatedAt: partial.updatedAt || now,
    expiresAt: partial.expiresAt || expires,
    status: partial.status || AgentStatus.ACTIVE,
    owner: partial.owner || 'test-owner'
  };
}

/**
 * Creates a mock endpoint for testing
 */
export function createMockEndpoint(partial: Partial<Endpoint> = {}): Endpoint {
  return {
    id: partial.id || uuidv4(),
    protocol: partial.protocol || 'https',
    address: partial.address || 'test-agent.example.com',
    port: partial.port || 443,
    health: partial.health || {
      status: HealthStatus.HEALTHY,
      lastChecked: new Date(),
      message: 'Healthy'
    },
    metadata: partial.metadata
  };
}

/**
 * Creates a mock certificate for testing
 */
export function createMockCertificate(partial: Partial<Certificate> = {}): Certificate {
  const now = new Date();
  const notBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
  const notAfter = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
  
  return {
    id: partial.id || uuidv4(),
    subject: partial.subject || 'CN=Test Agent',
    issuer: partial.issuer || 'CN=Test ANS CA',
    notBefore: partial.notBefore || notBefore,
    notAfter: partial.notAfter || notAfter,
    publicKey: partial.publicKey || '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkq...\n-----END PUBLIC KEY-----',
    certificate: partial.certificate || '-----BEGIN CERTIFICATE-----\nMIIDeTCCmGgAw...\n-----END CERTIFICATE-----',
    fingerprint: partial.fingerprint || 'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99',
    status: partial.status || CertificateStatus.VALID,
    metadata: partial.metadata || { test: 'value' }
  };
}

/**
 * Creates a mock security event for testing
 */
export function createMockSecurityEvent(partial: Partial<SecurityEvent> = {}): SecurityEvent {
  return {
    id: partial.id || uuidv4(),
    timestamp: partial.timestamp || new Date(),
    eventType: partial.eventType || SecurityEventType.AUTHENTICATION_FAILURE,
    severity: partial.severity || SecuritySeverity.MEDIUM,
    source: partial.source || '192.168.1.1',
    target: partial.target || 'agent-id',
    description: partial.description || 'Failed authentication attempt',
    metadata: partial.metadata || { attempts: 3 },
    mitigationApplied: partial.mitigationApplied !== undefined ? partial.mitigationApplied : false,
    mitigationDetails: partial.mitigationDetails
  };
}

/**
 * Creates a mock SQLite database for testing
 */
export function createMockDatabase() {
  return {
    execute: jest.fn().mockResolvedValue(undefined),
    run: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    all: jest.fn().mockResolvedValue([]),
    close: jest.fn().mockResolvedValue(undefined)
  };
}

/**
 * Creates a mock database service factory
 */
export function createMockDatabaseServiceFactory() {
  return {
    getInstance: jest.fn(),
    resetDatabase: jest.fn().mockResolvedValue(undefined)
  };
}
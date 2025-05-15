/**
 * Agent status enum
 */
export enum AgentStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  DEPRECATED = 'DEPRECATED',
  REVOKED = 'REVOKED'
}

/**
 * Endpoint health status enum
 */
export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNHEALTHY = 'UNHEALTHY',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Certificate status enum
 */
export enum CertificateStatus {
  VALID = 'VALID',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
  SUSPENDED = 'SUSPENDED'
}

/**
 * Security event type enum
 */
export enum SecurityEventType {
  AUTHENTICATION_FAILURE = 'AUTHENTICATION_FAILURE',
  CERTIFICATE_VIOLATION = 'CERTIFICATE_VIOLATION',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SUSPICIOUS_QUERY = 'SUSPICIOUS_QUERY',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  SYSTEM_ABUSE = 'SYSTEM_ABUSE',
  THREAT_DETECTED = 'THREAT_DETECTED'
}

/**
 * Security severity enum
 */
export enum SecuritySeverity {
  INFO = 'INFO',
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * Endpoint health interface
 */
export interface EndpointHealth {
  status: HealthStatus;
  lastChecked: Date;
  message?: string;
}

/**
 * Endpoint interface
 */
export interface Endpoint {
  id: string;
  protocol: string;
  address: string;
  port: number;
  health: EndpointHealth;
  metadata?: Record<string, any>;
}

/**
 * Agent record interface
 */
export interface AgentRecord {
  // Core Identity
  id: string;
  name: string;
  publicKey: string;
  certificateId: string;
  
  // Connection Information
  endpoints?: Endpoint[];
  defaultEndpoint?: Endpoint;
  
  // Capabilities and Metadata
  capabilities?: string[];
  version: string;
  description?: string;
  metadata?: Record<string, any>;
  
  // Administrative
  createdAt?: Date;
  updatedAt?: Date;
  expiresAt?: Date;
  status?: AgentStatus;
  owner: string;
}

/**
 * Certificate interface
 */
export interface Certificate {
  id: string;
  subject: string;
  issuer: string;
  notBefore: Date;
  notAfter: Date;
  publicKey: string;
  certificate: string;
  fingerprint: string;
  status: CertificateStatus;
  metadata?: Record<string, any>;
}

/**
 * Security event interface
 */
export interface SecurityEvent {
  id: string;
  timestamp: Date;
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  source: string;
  target: string;
  description: string;
  metadata?: Record<string, any>;
  mitigationApplied: boolean;
  mitigationDetails?: string;
}

/**
 * Resolution query interface
 */
export interface ResolutionQuery {
  // Identity-based Query
  id?: string;
  name?: string;
  fingerprint?: string;
  
  // Capability-based Query
  capabilities?: string[];
  allCapabilities?: boolean;
  
  // Filters
  status?: AgentStatus[];
  owner?: string;
  
  // Pagination
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

/**
 * ANS Message Types
 */
export enum ANSMessageType {
  REQUEST = "REQUEST",
  RESPONSE = "RESPONSE",
  EVENT = "EVENT",
  ERROR = "ERROR"
}

/**
 * ANS Operation Types
 */
export enum ANSOperation {
  // Registration operations
  REGISTER = "REGISTER",
  UPDATE = "UPDATE",
  DEREGISTER = "DEREGISTER",
  
  // Resolution operations
  RESOLVE = "RESOLVE",
  QUERY = "QUERY",
  
  // Certificate operations
  GET_CERTIFICATE = "GET_CERTIFICATE",
  VALIDATE_CERTIFICATE = "VALIDATE_CERTIFICATE",
  RENEW_CERTIFICATE = "RENEW_CERTIFICATE",
  REVOKE_CERTIFICATE = "REVOKE_CERTIFICATE",
  
  // Security operations
  REPORT_THREAT = "REPORT_THREAT",
  GET_THREATS = "GET_THREATS",
  
  // Administrative operations
  PING = "PING",
  HEALTH = "HEALTH",
  STATS = "STATS"
}

/**
 * ANS Status Codes
 */
export enum ANSStatus {
  // Success codes (200-299)
  SUCCESS = 200,
  CREATED = 201,
  ACCEPTED = 202,
  NO_CONTENT = 204,
  
  // Client error codes (400-499)
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  RATE_LIMITED = 429,
  
  // Server error codes (500-599)
  SERVER_ERROR = 500,
  NOT_IMPLEMENTED = 501,
  SERVICE_UNAVAILABLE = 503
}

/**
 * ANS Error Structure
 */
export interface ANSError {
  code: string;
  message: string;
  details?: any;
  requestId?: string;
}

/**
 * Base message interface for all ANS protocol messages
 */
export interface ANSMessage {
  // Protocol metadata
  protocolVersion: string;
  messageId: string;
  timestamp: string;
  
  // Message type and content
  messageType: ANSMessageType;
  operation?: ANSOperation;
  status?: ANSStatus;
  data?: any;
  
  // Security
  sender: {
    id: string;
    type: "AGENT" | "ANS" | "MCP";
    certificateFingerprint?: string;
  };
  signature?: string;
}

/**
 * Database interface
 */
export interface SQLiteDatabase {
  execute(sql: string): Promise<void>;
  run(sql: string, params?: any[]): Promise<void>;
  get(sql: string, params?: any[]): Promise<any>;
  all(sql: string, params?: any[]): Promise<any[]>;
  close(): Promise<void>;
}
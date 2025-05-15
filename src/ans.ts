// src/ans.ts

import { AgentRegistry } from './db';
import { issueCertificate, validateCertificate } from './certificate';
import { formatAgentCard, formatMCPManifest } from './protocols';
import { analyzeAgentSecurity, ThreatReport, SecurityAction } from './mastra-simple';
import { ANSStatus, CertificateStatus, SecurityEventType, SecuritySeverity } from './types';

/**
 * Configuration for the Agent Naming Service
 */
interface ANSConfig {
  /**
   * Enable rate limiting for registrations
   */
  enableRateLimiting: boolean;
  
  /**
   * Maximum registrations allowed per IP per hour
   */
  maxRegistrationsPerHour: number;
  
  /**
   * Whether to enforce strict name validation
   */
  strictNameValidation: boolean;
  
  /**
   * Reserved name prefixes that cannot be used
   */
  reservedPrefixes: string[];
  
  /**
   * Domains that are allowed to register agents
   */
  allowedDomains?: string[];
}

/**
 * Default configuration for the Agent Naming Service
 */
const DEFAULT_CONFIG: ANSConfig = {
  enableRateLimiting: true,
  maxRegistrationsPerHour: 10,
  strictNameValidation: true,
  reservedPrefixes: ['system.', 'admin.', 'security.', 'root.', 'mcp.', 'core.']
};

/**
 * Result of a validation operation
 */
interface ValidationResult {
  /**
   * Whether the validation passed
   */
  valid: boolean;
  
  /**
   * The error message if validation failed
   */
  error?: string;
  
  /**
   * The error code if validation failed
   */
  code?: number;
}

/**
 * Represents a security event in the system
 */
interface SecurityEvent {
  /**
   * Type of security event
   */
  type: SecurityEventType;
  
  /**
   * Severity of the security event
   */
  severity: SecuritySeverity;
  
  /**
   * Details about the security event
   */
  details: string;
  
  /**
   * IP address associated with the event
   */
  ipAddress?: string;
  
  /**
   * Agent name associated with the event
   */
  agentName?: string;
  
  /**
   * Timestamp of the event
   */
  timestamp: Date;
}

export class AgentNamingService {
  private registry: AgentRegistry;
  private config: ANSConfig;
  private registrationLog: Map<string, { count: number, lastReset: Date }>;
  private securityEvents: SecurityEvent[];
  
  /**
   * Creates a new instance of the Agent Naming Service
   * @param config Optional configuration for the service
   */
  constructor(config?: Partial<ANSConfig>) {
    this.registry = new AgentRegistry();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.registrationLog = new Map();
    this.securityEvents = [];
    
    // Start the rate limit reset interval if rate limiting is enabled
    if (this.config.enableRateLimiting) {
      // Reset rate limits hourly
      setInterval(() => this.resetRateLimits(), 60 * 60 * 1000);
    }
  }

  /**
   * Register an agent with the Agent Naming Service
   * @param name The unique name of the agent
   * @param metadata Additional metadata about the agent
   * @param ipAddress Optional IP address of the requester for rate limiting
   * @returns A result object containing the agent card and threat analysis
   * @throws Error if the agent name is invalid or rate limit is exceeded
   */
  public async registerAgent(
    name: string, 
    metadata: object,
    ipAddress?: string
  ): Promise<{
    agentCard: string;
    threatReport: ThreatReport;
  }> {
    try {
      // Validate the agent name
      const nameValidation = this.validateAgentName(name);
      if (!nameValidation.valid) {
        this.logSecurityEvent({
          type: SecurityEventType.SUSPICIOUS_QUERY,
          severity: SecuritySeverity.MEDIUM,
          details: `Invalid agent name: ${nameValidation.error}`,
          ipAddress,
          agentName: name,
          timestamp: new Date()
        });
        
        throw new Error(nameValidation.error || 'Invalid agent name');
      }
      
      // Check rate limits if enabled and IP address is provided
      if (this.config.enableRateLimiting && ipAddress) {
        const rateCheckResult = this.checkRateLimit(ipAddress);
        if (!rateCheckResult.valid) {
          this.logSecurityEvent({
            type: SecurityEventType.RATE_LIMIT_EXCEEDED,
            severity: SecuritySeverity.MEDIUM,
            details: `Rate limit exceeded for IP: ${ipAddress}`,
            ipAddress,
            timestamp: new Date()
          });
          
          throw new Error(rateCheckResult.error || 'Rate limit exceeded');
        }
      }
      
      // Validate metadata
      const metadataValidation = this.validateMetadata(metadata);
      if (!metadataValidation.valid) {
        this.logSecurityEvent({
          type: SecurityEventType.SUSPICIOUS_QUERY,
          severity: SecuritySeverity.MEDIUM,
          details: `Invalid metadata: ${metadataValidation.error}`,
          ipAddress,
          agentName: name,
          timestamp: new Date()
        });
        
        throw new Error(metadataValidation.error || 'Invalid metadata');
      }
      
      // Issue a certificate for the agent
      const certificate = issueCertificate(name);
      
      // Validate the certificate
      const certValidation = validateCertificate(certificate);
      if (!certValidation.valid) {
        this.logSecurityEvent({
          type: SecurityEventType.CERTIFICATE_VIOLATION,
          severity: SecuritySeverity.HIGH,
          details: `Certificate validation failed: ${certValidation.details}`,
          ipAddress,
          agentName: name,
          timestamp: new Date()
        });
        
        throw new Error(`Certificate validation failed: ${certValidation.details}`);
      }
      
      // Get registration history if available
      const registrationHistory = await this.getRegistrationHistory(name);
      
      // Perform threat analysis on the agent with enhanced data
      const threatReport = await analyzeAgentSecurity({
        name,
        metadata,
        certificate,
        ipAddress,
        registrationHistory
      });
      
      // Check if registration should be blocked based on threat analysis
      if (threatReport.recommendedActions.includes(SecurityAction.REJECT_REGISTRATION)) {
        this.logSecurityEvent({
          type: SecurityEventType.THREAT_DETECTED,
          severity: mapThreatSeverityToSecuritySeverity(threatReport.severity),
          details: `Agent registration rejected due to security threat: ${threatReport.threatScore}`,
          ipAddress,
          agentName: name,
          timestamp: new Date()
        });
        
        throw new Error(`Registration rejected due to security concerns. Threat score: ${threatReport.threatScore}`);
      }
      
      // Log security event if monitoring is recommended
      if (threatReport.recommendedActions.includes(SecurityAction.MONITOR_ACTIVITY) || 
          threatReport.recommendedActions.includes(SecurityAction.INCREASE_MONITORING)) {
        this.logSecurityEvent({
          type: SecurityEventType.THREAT_DETECTED,
          severity: mapThreatSeverityToSecuritySeverity(threatReport.severity),
          details: `Suspicious agent detected: ${threatReport.detectedThreats.join(', ')}`,
          ipAddress,
          agentName: name,
          timestamp: new Date()
        });
      }
      
      // Format the agent card with the certificate, metadata, and security analysis
      const agentCard = formatAgentCard(name, JSON.stringify({
        certificate,
        metadata,
        registeredAt: new Date().toISOString(),
        securityAnalysis: {
          threatScore: threatReport.threatScore,
          severity: threatReport.severity,
          analysisTime: threatReport.timestamp
        }
      }));
      
      // Save the agent card to the registry
      await this.registry.saveAgent(name, agentCard);
      
      // Return both the agent card and the threat report
      return {
        agentCard,
        threatReport
      };
    } catch (error) {
      // Sanitize error message to avoid leaking sensitive information
      const sanitizedError = this.sanitizeErrorMessage(error);
      throw new Error(`Agent registration failed: ${sanitizedError}`);
    }
  }

  /**
   * Resolve an agent by name
   * @param name The unique name of the agent to resolve
   * @returns The agent card, or null if not found
   */
  public async resolveAgent(name: string): Promise<string | null> {
    try {
      // Validate the agent name
      const nameValidation = this.validateAgentName(name);
      if (!nameValidation.valid) {
        return null;
      }
      
      return this.registry.getAgentCard(name);
    } catch (error) {
      // Log error but return null instead of throwing
      console.error('Error resolving agent:', this.sanitizeErrorMessage(error));
      return null;
    }
  }

  /**
   * Generate an MCP manifest for the agent
   * @param name The unique name of the agent
   * @param manifest The manifest data
   * @returns A formatted MCP manifest
   */
  public generateMCPManifest(name: string, manifest: object): string {
    try {
      // Validate the agent name
      const nameValidation = this.validateAgentName(name);
      if (!nameValidation.valid) {
        throw new Error(nameValidation.error || 'Invalid agent name');
      }
      
      // Validate the manifest data
      if (!manifest || typeof manifest !== 'object') {
        throw new Error('Invalid manifest data');
      }
      
      return formatMCPManifest(name, manifest);
    } catch (error) {
      throw new Error(`Failed to generate MCP manifest: ${this.sanitizeErrorMessage(error)}`);
    }
  }
  
  /**
   * Validate an agent name
   * @param name The agent name to validate
   * @returns Validation result
   */
  private validateAgentName(name: string): ValidationResult {
    // Check if name is provided
    if (!name) {
      return { valid: false, error: 'Agent name is required', code: ANSStatus.BAD_REQUEST };
    }
    
    // Check if name is a string
    if (typeof name !== 'string') {
      return { valid: false, error: 'Agent name must be a string', code: ANSStatus.BAD_REQUEST };
    }
    
    // Check if name is too short or too long
    if (name.length < 3 || name.length > 64) {
      return { 
        valid: false, 
        error: 'Agent name must be between 3 and 64 characters', 
        code: ANSStatus.BAD_REQUEST 
      };
    }
    
    // Check for reserved prefixes
    if (this.config.strictNameValidation) {
      const nameLower = name.toLowerCase();
      
      for (const prefix of this.config.reservedPrefixes) {
        if (nameLower.startsWith(prefix)) {
          return { 
            valid: false, 
            error: `Agent name cannot start with reserved prefix: ${prefix}`, 
            code: ANSStatus.FORBIDDEN 
          };
        }
      }
    }
    
    // Check for valid characters (alphanumeric, hyphens, underscores, dots)
    if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
      return { 
        valid: false, 
        error: 'Agent name can only contain letters, numbers, dots, hyphens, and underscores', 
        code: ANSStatus.BAD_REQUEST 
      };
    }
    
    // Check for potential XSS or injection attacks
    if (/[<>{}[\]/\\()'";]/.test(name)) {
      return { 
        valid: false, 
        error: 'Agent name contains forbidden characters', 
        code: ANSStatus.FORBIDDEN 
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Validate agent metadata
   * @param metadata The metadata to validate
   * @returns Validation result
   */
  private validateMetadata(metadata: any): ValidationResult {
    // Check if metadata is provided
    if (!metadata) {
      return { valid: false, error: 'Agent metadata is required', code: ANSStatus.BAD_REQUEST };
    }
    
    // Check if metadata is an object
    if (typeof metadata !== 'object' || Array.isArray(metadata)) {
      return { valid: false, error: 'Agent metadata must be an object', code: ANSStatus.BAD_REQUEST };
    }
    
    // Check for maximum metadata size (prevent DoS)
    const metadataSize = JSON.stringify(metadata).length;
    if (metadataSize > 10000) { // 10KB limit
      return { 
        valid: false, 
        error: 'Agent metadata exceeds maximum size (10KB)', 
        code: ANSStatus.BAD_REQUEST 
      };
    }
    
    // Validate specific metadata fields if needed
    if (metadata.description && typeof metadata.description !== 'string') {
      return { valid: false, error: 'Description must be a string', code: ANSStatus.BAD_REQUEST };
    }
    
    if (metadata.capabilities) {
      if (!Array.isArray(metadata.capabilities)) {
        return { valid: false, error: 'Capabilities must be an array', code: ANSStatus.BAD_REQUEST };
      }
      
      // Validate each capability
      for (const capability of metadata.capabilities) {
        if (typeof capability !== 'string') {
          return { valid: false, error: 'Each capability must be a string', code: ANSStatus.BAD_REQUEST };
        }
        
        // Check for potential XSS or injection attacks
        if (/[<>{}[\]/\\()'";]/.test(capability)) {
          return { 
            valid: false, 
            error: 'Capability contains forbidden characters', 
            code: ANSStatus.FORBIDDEN 
          };
        }
      }
    }
    
    return { valid: true };
  }
  
  /**
   * Check if an IP address has exceeded the rate limit
   * @param ipAddress The IP address to check
   * @returns Validation result
   */
  private checkRateLimit(ipAddress: string): ValidationResult {
    if (!this.config.enableRateLimiting) {
      return { valid: true };
    }
    
    if (!ipAddress) {
      return { valid: true }; // No IP address provided, can't rate limit
    }
    
    const now = new Date();
    let record = this.registrationLog.get(ipAddress);
    
    // If no record exists or it's been over an hour since the last reset, create a new record
    if (!record || now.getTime() - record.lastReset.getTime() > 60 * 60 * 1000) {
      record = { count: 0, lastReset: now };
      this.registrationLog.set(ipAddress, record);
    }
    
    // Increment the count
    record.count++;
    
    // Check if the count exceeds the limit
    if (record.count > this.config.maxRegistrationsPerHour) {
      return { 
        valid: false, 
        error: 'Rate limit exceeded. Try again later.', 
        code: ANSStatus.RATE_LIMITED 
      };
    }
    
    return { valid: true };
  }
  
  /**
   * Reset rate limits for all IP addresses
   */
  private resetRateLimits(): void {
    const now = new Date();
    this.registrationLog.forEach((record, ip) => {
      if (now.getTime() - record.lastReset.getTime() > 60 * 60 * 1000) {
        record.count = 0;
        record.lastReset = now;
      }
    });
  }
  
  /**
   * Get registration history for an agent name
   * @param name The agent name
   * @returns Array of registration attempts or undefined if none
   */
  private async getRegistrationHistory(name: string): Promise<any[] | undefined> {
    try {
      // In a production environment, this would query a persistent store
      // of registration attempts. For this implementation, we'll return undefined.
      return undefined;
    } catch (error) {
      console.error('Error getting registration history:', this.sanitizeErrorMessage(error));
      return undefined;
    }
  }
  
  /**
   * Log a security event
   * @param event The security event to log
   */
  private logSecurityEvent(event: SecurityEvent): void {
    try {
      // Add the event to the in-memory log
      this.securityEvents.push(event);
      
      // In a production system, this would also:
      // 1. Write to a secure audit log
      // 2. Send alerts for high-severity events
      // 3. Potentially update security controls
      
      // For now, just log to console
      console.warn(`[SECURITY EVENT] ${event.severity} - ${event.type}: ${event.details}`);
      
      // Prune old events to prevent memory leaks
      // Keep only the last 1000 events
      if (this.securityEvents.length > 1000) {
        this.securityEvents = this.securityEvents.slice(-1000);
      }
    } catch (error) {
      console.error('Failed to log security event:', this.sanitizeErrorMessage(error));
    }
  }
  
  /**
   * Sanitize an error message to prevent information leakage
   * @param error The error to sanitize
   * @returns A sanitized error message
   */
  private sanitizeErrorMessage(error: any): string {
    try {
      // Convert to string if not already
      const message = error?.message || String(error);
      
      // Remove any potentially sensitive information
      return message
        .replace(/(?:\/[\w.-]+)+/g, '[PATH]')
        .replace(/at\s+[\w\s./<>]+\s+\(.*\)/g, '[STACK_TRACE]')
        .replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi, '[EMAIL]')
        .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP_ADDRESS]')
        .replace(/key|secret|password|token|credential|auth/gi, '[SENSITIVE]');
    } catch (e) {
      return 'Unknown error';
    }
  }
}

/**
 * Maps a threat severity to a security severity
 * @param threatSeverity The threat severity to map
 * @returns The corresponding security severity
 */
function mapThreatSeverityToSecuritySeverity(
  threatSeverity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
): SecuritySeverity {
  switch (threatSeverity) {
    case 'INFO':
      return SecuritySeverity.INFO;
    case 'LOW':
      return SecuritySeverity.LOW;
    case 'MEDIUM':
      return SecuritySeverity.MEDIUM;
    case 'HIGH':
      return SecuritySeverity.HIGH;
    case 'CRITICAL':
      return SecuritySeverity.CRITICAL;
    default:
      return SecuritySeverity.MEDIUM;
  }
}
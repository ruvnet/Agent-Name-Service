// tests/mock-ans.ts

import { AgentRegistry } from '../src/db';
import { issueCertificate, validateCertificate } from '../src/certificate';
import { formatAgentCard, formatMCPManifest } from '../src/protocols';
import { analyzeAgentSecurity, ThreatReport, SecurityAction } from '../src/mastra';
import { ANSStatus, CertificateStatus, SecurityEventType, SecuritySeverity } from '../src/types';

// Mock version of the ANS service for testing
export class MockAgentNamingService {
  private mockSaveAgent: jest.Mock;
  private mockGetAgentCard: jest.Mock;
  private registrationLog: Map<string, { count: number, lastReset: Date }>;
  private config: any;

  constructor(config?: any, mockSaveAgent?: jest.Mock, mockGetAgentCard?: jest.Mock) {
    this.mockSaveAgent = mockSaveAgent || jest.fn();
    this.mockGetAgentCard = mockGetAgentCard || jest.fn();
    this.registrationLog = new Map();
    
    // Initialize with default config and merge with provided config
    this.config = {
      enableRateLimiting: false,
      maxRegistrationsPerHour: 10,
      strictNameValidation: true,
      reservedPrefixes: ['system.', 'admin.', 'security.', 'root.', 'mcp.', 'core.']
    };
    
    // Merge with provided config
    if (config) {
      this.config = { ...this.config, ...config };
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
        throw new Error(nameValidation.error || 'Invalid agent name');
      }
      
      // Check rate limits if enabled and IP address is provided
      if (this.config.enableRateLimiting && ipAddress) {
        const rateCheckResult = this.checkRateLimit(ipAddress);
        if (!rateCheckResult.valid) {
          throw new Error(rateCheckResult.error || 'Rate limit exceeded');
        }
      }
      
      // Validate metadata
      const metadataValidation = this.validateMetadata(metadata);
      if (!metadataValidation.valid) {
        throw new Error(metadataValidation.error || 'Invalid metadata');
      }
      
      // Issue a certificate for the agent
      const certificate = issueCertificate(name);
      
      // Get registration history if available
      const registrationHistory = undefined; // No history tracking in mock
      
      // Perform threat analysis on the agent with enhanced data
      const threatReport = await analyzeAgentSecurity({
        name,
        metadata,
        certificate,
        ipAddress,
        registrationHistory
      });
      
      // Check if registration should be blocked based on threat analysis
      if (threatReport.recommendedActions.includes('REJECT_REGISTRATION')) {
        throw new Error(`Registration rejected due to security concerns. Threat score: ${threatReport.threatScore}`);
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
      
      // Save the agent card (mock)
      this.mockSaveAgent(name, agentCard);
      
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
      
      return this.mockGetAgentCard(name);
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
  private validateAgentName(name: string): { valid: boolean; error?: string; code?: number } {
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
  private validateMetadata(metadata: any): { valid: boolean; error?: string; code?: number } {
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
  private checkRateLimit(ipAddress: string): { valid: boolean; error?: string; code?: number } {
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
import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';

// Define schema for agent resolution
const agentResolutionSchema = z.object({
  identifier: z.string().describe('The identifier to resolve (name, fingerprint, etc.)'),
  resolution_type: z.enum(['NAME', 'FINGERPRINT', 'ALIAS', 'FUZZY']).default('NAME').describe('The type of resolution to perform'),
  include_metadata: z.boolean().default(true).describe('Whether to include metadata in the resolution'),
  verify_certificate: z.boolean().default(true).describe('Whether to verify the certificate during resolution'),
  max_results: z.number().optional().describe('Maximum number of results to return for fuzzy matching'),
});

// Define output schemas for steps
const agentLookupSchema = z.object({
  identifier: z.string(),
  resolution_type: z.string(),
  agent_found: z.boolean(),
  similar_agents: z.array(z.string()).optional(),
  lookup_status: z.string(),
  issues: z.array(z.string()),
});

const agentDataFetchSchema = z.object({
  identifier: z.string(),
  resolution_type: z.string(),
  agent_found: z.boolean(),
  agent_name: z.string().nullable(),
  agent_card: z.any().nullable(),
  certificate: z.any().nullable(),
  metadata: z.record(z.any()).nullable(),
  fetch_status: z.string(),
  issues: z.array(z.string()),
});

const agentVerificationSchema = z.object({
  identifier: z.string(),
  agent_name: z.string(),
  certificate_status: z.string(),
  certificate_verified: z.boolean(),
  validation_details: z.record(z.any()),
  verification_status: z.string(),
  issues: z.array(z.string()),
});

const resolutionResultSchema = z.object({
  identifier: z.string(),
  resolution_type: z.string(),
  agent_found: z.boolean(),
  agent_name: z.string().nullable(),
  agent_card: z.any().nullable(),
  certificate: z.any().nullable(),
  certificate_status: z.string().nullable(),
  metadata: z.record(z.any()).nullable(),
  similar_agents: z.array(z.string()).optional(),
  resolution_status: z.string(),
  verified: z.boolean(),
  issues: z.array(z.string()),
});

// Step 1: Lookup Agent
const lookupAgent = new Step({
  id: 'lookup-agent',
  description: 'Looks up an agent by identifier',
  inputSchema: agentResolutionSchema,
  outputSchema: agentLookupSchema,
  execute: async ({ context }) => {
    // Get trigger data
    const resolutionData = context.getStepResult('trigger');
    
    if (!resolutionData) {
      throw new Error('Resolution data not found in trigger');
    }
    
    // Extract data
    const { identifier, resolution_type, max_results } = resolutionData;
    
    // Initialize lookup result
    const lookupResult = {
      identifier,
      resolution_type,
      agent_found: false,
      lookup_status: 'PENDING',
      issues: [] as string[],
    };
    
    try {
      // In a real implementation, this would query the agent database
      // This is a simplified mock implementation
      
      // Simulate different lookup strategies based on resolution_type
      if (resolution_type === 'NAME') {
        // Exact name match
        if (identifier.length >= 3 && /^[a-zA-Z0-9._-]+$/.test(identifier)) {
          // Simulate finding agent (in real implementation, this would be a database query)
          lookupResult.agent_found = true;
        } else {
          lookupResult.issues.push('Invalid agent name format');
        }
      } else if (resolution_type === 'FINGERPRINT') {
        // Fingerprint lookup
        if (/^[a-fA-F0-9]{32,64}$/.test(identifier)) {
          // Simulate finding agent by fingerprint
          lookupResult.agent_found = true;
        } else {
          lookupResult.issues.push('Invalid certificate fingerprint format');
        }
      } else if (resolution_type === 'ALIAS') {
        // Alias lookup
        // Simulate finding agent by alias
        lookupResult.agent_found = identifier.length >= 3;
      } else if (resolution_type === 'FUZZY') {
        // Fuzzy matching
        if (identifier.length < 3) {
          lookupResult.issues.push('Search term too short for fuzzy matching (minimum 3 characters)');
        } else {
          // Simulate fuzzy matching results
          lookupResult.similar_agents = [
            `${identifier}-similar1`,
            `${identifier}-similar2`,
            `similar-${identifier}`,
          ].slice(0, max_results || 5);
          
          // If exact match found in similar results, mark as found
          if (lookupResult.similar_agents.includes(identifier)) {
            lookupResult.agent_found = true;
          }
        }
      }
      
      lookupResult.lookup_status = 'COMPLETED';
      return lookupResult;
    } catch (error) {
      lookupResult.lookup_status = 'FAILED';
      lookupResult.issues.push(`Lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return lookupResult;
    }
  },
});

// Step 2: Fetch Agent Data
const fetchAgentData = new Step({
  id: 'fetch-agent-data',
  description: 'Fetches agent data for the resolved agent',
  execute: async ({ context }) => {
    // Get lookup result
    const lookupResult = context.getStepResult(lookupAgent);
    
    if (!lookupResult) {
      throw new Error('Lookup result not found');
    }
    
    // Get original trigger data for additional settings
    const triggerData = context.getStepResult('trigger') as {
      include_metadata: boolean;
      verify_certificate: boolean;
    };
    
    // Extract key information
    const { identifier, resolution_type, agent_found, similar_agents, issues } = lookupResult as {
      identifier: string;
      resolution_type: string;
      agent_found: boolean;
      similar_agents?: string[];
      issues: string[];
    };
    const includeMetadata = triggerData?.include_metadata !== false; // Default to true if not specified
    
    // Initialize fetch result
    const fetchResult = {
      identifier,
      resolution_type,
      agent_found,
      agent_name: null as string | null,
      agent_card: null as any,
      certificate: null as any,
      metadata: null as Record<string, any> | null,
      fetch_status: 'PENDING',
      issues: [...issues],
    };
    
    // Skip fetch if agent not found
    if (!agent_found && (!similar_agents || similar_agents.length === 0)) {
      fetchResult.fetch_status = 'SKIPPED';
      fetchResult.issues.push('Agent not found, skipping data fetch');
      return fetchResult;
    }
    
    try {
      // For fuzzy results without exact match, return the similar agents but skip fetching
      if (!agent_found && similar_agents && similar_agents.length > 0) {
        fetchResult.fetch_status = 'PARTIAL';
        fetchResult.issues.push('No exact match found, returning similar agents only');
        return fetchResult;
      }
      
      // In a real implementation, this would fetch the agent data from the database
      // This is a simplified mock implementation
      
      // Set agent name (in real implementation, this would be from the database)
      fetchResult.agent_name = identifier;
      
      // Simulate fetching agent card
      fetchResult.agent_card = {
        name: identifier,
        registeredAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days ago
      };
      
      // Simulate fetching certificate
      const now = new Date();
      const expirationDate = new Date(now);
      expirationDate.setFullYear(expirationDate.getFullYear() + 1); // 1 year validity
      
      fetchResult.certificate = {
        serialNumber: 'abc123def456',
        subject: `/CN=${identifier}/O=Agent Naming Service`,
        issuer: '/CN=ANS Root CA/O=Agent Naming Service',
        validFrom: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(), // 180 days ago
        validTo: expirationDate.toISOString(),
        fingerprint: 'aabbccddeeff00112233445566778899',
        status: 'VALID',
      };
      
      // Fetch metadata if requested
      if (includeMetadata) {
        fetchResult.metadata = {
          description: `Agent ${identifier} for testing`,
          capabilities: ['capability1', 'capability2'],
          version: '1.0.0',
          provider: 'Test Provider',
        };
      }
      
      fetchResult.fetch_status = 'COMPLETED';
      return fetchResult;
    } catch (error) {
      fetchResult.fetch_status = 'FAILED';
      fetchResult.issues.push(`Data fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return fetchResult;
    }
  },
});

// Step 3: Verify Agent Certificate
const verifyAgentCertificate = new Step({
  id: 'verify-agent-certificate',
  description: 'Verifies the agent certificate if requested',
  execute: async ({ context }) => {
    // Get fetch result
    const fetchResult = context.getStepResult(fetchAgentData);
    
    if (!fetchResult) {
      throw new Error('Fetch result not found');
    }
    
    // Get original trigger data for verification setting
    const triggerData = context.getStepResult('trigger') as {
      verify_certificate: boolean;
    };
    
    // Extract key information
    const { identifier, agent_name, certificate, issues } = fetchResult as {
      identifier: string;
      agent_name: string;
      certificate: any;
      issues: string[];
    };
    const verifyRequired = triggerData?.verify_certificate !== false; // Default to true if not specified
    
    // Initialize verification result
    const verificationResult = {
      identifier,
      agent_name: agent_name || identifier,
      certificate_status: 'UNKNOWN',
      certificate_verified: false,
      validation_details: {},
      verification_status: 'PENDING',
      issues: [...issues],
    };
    
    // Skip verification if not requested or if certificate not found
    if (!verifyRequired) {
      verificationResult.verification_status = 'SKIPPED';
      verificationResult.issues.push('Certificate verification not requested');
      return verificationResult;
    }
    
    if (!certificate) {
      verificationResult.verification_status = 'FAILED';
      verificationResult.issues.push('No certificate found to verify');
      return verificationResult;
    }
    
    try {
      // In a real implementation, this would verify the certificate against a CA
      // This is a simplified mock implementation
      
      // Basic certificate validation
      const validationDetails: Record<string, any> = {};
      let isValid = true;
      
      // Check certificate status
      if (certificate.status !== 'VALID') {
        validationDetails.status = `Invalid certificate status: ${certificate.status}`;
        isValid = false;
      }
      
      // Check certificate expiration
      const expiryDate = new Date(certificate.validTo);
      const now = new Date();
      if (expiryDate < now) {
        validationDetails.expired = `Certificate expired on ${expiryDate.toISOString()}`;
        isValid = false;
      } else {
        const daysUntilExpiry = Math.round((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        validationDetails.expiresIn = `${daysUntilExpiry} days`;
        
        // Warn if expiring soon
        if (daysUntilExpiry < 30) {
          validationDetails.expiryWarning = `Certificate expires in ${daysUntilExpiry} days`;
        }
      }
      
      // Check certificate subject matches agent name
      const expectedSubject = `/CN=${agent_name}/O=Agent Naming Service`;
      if (certificate.subject !== expectedSubject) {
        validationDetails.subjectMismatch = `Certificate subject "${certificate.subject}" does not match expected "${expectedSubject}"`;
        isValid = false;
      }
      
      // Set verification result
      verificationResult.certificate_status = isValid ? 'VALID' : 'INVALID';
      verificationResult.certificate_verified = isValid;
      verificationResult.validation_details = validationDetails;
      
      if (!isValid) {
        verificationResult.issues.push('Certificate validation failed');
      }
      
      verificationResult.verification_status = 'COMPLETED';
      return verificationResult;
    } catch (error) {
      verificationResult.verification_status = 'FAILED';
      verificationResult.issues.push(`Certificate verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return verificationResult;
    }
  },
});

// Step 4: Prepare Resolution Result
const prepareResolutionResult = new Step({
  id: 'prepare-resolution-result',
  description: 'Prepares the final resolution result combining all previous steps',
  outputSchema: resolutionResultSchema,
  execute: async ({ context }) => {
    // Get results from all previous steps
    const lookupResult = context.getStepResult(lookupAgent) as {
      identifier: string;
      resolution_type: string;
      agent_found: boolean;
      similar_agents?: string[];
      issues: string[];
    };
    
    const fetchResult = context.getStepResult(fetchAgentData) as {
      agent_name: string | null;
      agent_card: any;
      certificate: any;
      metadata: Record<string, any> | null;
      fetch_status: string;
      issues: string[];
    };
    
    const verificationResult = context.getStepResult(verifyAgentCertificate) as {
      certificate_status: string;
      certificate_verified: boolean;
      verification_status: string;
      issues: string[];
    };
    
    if (!lookupResult) {
      throw new Error('Lookup result not found');
    }
    
    // Initialize the resolution result
    const resolutionResult = {
      identifier: lookupResult.identifier,
      resolution_type: lookupResult.resolution_type,
      agent_found: lookupResult.agent_found,
      agent_name: fetchResult?.agent_name || null,
      agent_card: fetchResult?.agent_card || null,
      certificate: fetchResult?.certificate || null,
      certificate_status: verificationResult?.certificate_status || null,
      metadata: fetchResult?.metadata || null,
      similar_agents: lookupResult.similar_agents,
      resolution_status: 'PENDING',
      verified: verificationResult?.certificate_verified || false,
      issues: [
        ...lookupResult.issues,
        ...(fetchResult?.issues || []),
        ...(verificationResult?.issues || []),
      ],
    };
    
    // Determine overall resolution status
    if (!lookupResult.agent_found && (!lookupResult.similar_agents || lookupResult.similar_agents.length === 0)) {
      resolutionResult.resolution_status = 'NOT_FOUND';
    } else if (!lookupResult.agent_found && lookupResult.similar_agents && lookupResult.similar_agents.length > 0) {
      resolutionResult.resolution_status = 'SIMILAR_FOUND';
    } else if (fetchResult?.fetch_status === 'FAILED') {
      resolutionResult.resolution_status = 'DATA_FETCH_FAILED';
    } else if (verificationResult?.verification_status === 'FAILED' || 
              (verificationResult?.verification_status === 'COMPLETED' && !verificationResult.certificate_verified)) {
      resolutionResult.resolution_status = 'VERIFICATION_FAILED';
    } else {
      resolutionResult.resolution_status = 'RESOLVED';
    }
    
    return resolutionResult;
  },
});

// Create the agent resolution workflow
const agentResolutionWorkflow = new Workflow({
  name: 'agent-resolution-workflow',
  triggerSchema: agentResolutionSchema,
})
  .step(lookupAgent)
  .then(fetchAgentData)
  .then(verifyAgentCertificate)
  .then(prepareResolutionResult);

// Commit the workflow to make it active
agentResolutionWorkflow.commit();

// Export the workflow
export { agentResolutionWorkflow };
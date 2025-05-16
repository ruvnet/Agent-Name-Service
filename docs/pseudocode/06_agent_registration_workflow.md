# Agent Registration Workflow

## Overview

The Agent Registration Workflow handles the process of registering new agents with the Agent Naming Service (ANS). This workflow validates agent details, issues certificates, performs security analysis, and creates agent cards.

## Workflow Components

### Input Schema

```typescript
// Define the schema for agent registration data
const agentRegistrationSchema = z.object({
  name: z.string().describe('The unique name of the agent'),
  metadata: z.record(z.any()).describe('Agent metadata including capabilities'),
  ipAddress: z.string().optional().describe('IP address the agent is registering from'),
  domain: z.string().optional().describe('Domain the agent belongs to'),
});
```

### Steps

#### 1. Validate Agent Details

```typescript
const validateAgentDetails = new Step({
  id: 'validate-agent-details',
  description: 'Validates agent name, metadata, and other registration details',
  inputSchema: agentRegistrationSchema,
  outputSchema: z.object({
    name: z.string(),
    metadata: z.record(z.any()),
    ipAddress: z.string().optional(),
    domain: z.string().optional(),
    validationResults: z.object({
      nameValid: z.boolean(),
      metadataValid: z.boolean(),
      rateCheckPassed: z.boolean(),
      issues: z.array(z.string()).optional(),
    }),
  }),
  execute: async ({ context }) => {
    // Get the trigger data for registration
    const triggerData = context.getStepResult('trigger');
    
    if (!triggerData) {
      throw new Error('Agent registration data not found in trigger');
    }
    
    // Extract registration details
    const { name, metadata, ipAddress, domain } = triggerData;
    
    // Initialize validation results
    const validationResults = {
      nameValid: true,
      metadataValid: true,
      rateCheckPassed: true,
      issues: [],
    };
    
    // Validate agent name (alphanumeric, hyphens, underscores, dots)
    if (!name || typeof name !== 'string') {
      validationResults.nameValid = false;
      validationResults.issues.push('Agent name is required and must be a string');
    } else if (name.length < 3 || name.length > 64) {
      validationResults.nameValid = false;
      validationResults.issues.push('Agent name must be between 3 and 64 characters');
    } else if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
      validationResults.nameValid = false;
      validationResults.issues.push('Agent name can only contain letters, numbers, dots, hyphens, and underscores');
    }
    
    // Check for reserved prefixes
    const reservedPrefixes = ['system.', 'admin.', 'security.', 'root.', 'mcp.', 'core.'];
    if (validationResults.nameValid) {
      const nameLower = name.toLowerCase();
      for (const prefix of reservedPrefixes) {
        if (nameLower.startsWith(prefix)) {
          validationResults.nameValid = false;
          validationResults.issues.push(`Agent name cannot start with reserved prefix: ${prefix}`);
          break;
        }
      }
    }
    
    // Validate metadata
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      validationResults.metadataValid = false;
      validationResults.issues.push('Agent metadata must be a non-array object');
    } else {
      // Check metadata size to prevent DoS
      const metadataSize = JSON.stringify(metadata).length;
      if (metadataSize > 10000) { // 10KB limit
        validationResults.metadataValid = false;
        validationResults.issues.push('Agent metadata exceeds maximum size (10KB)');
      }
      
      // Validate specific fields if present
      if (metadata.capabilities && !Array.isArray(metadata.capabilities)) {
        validationResults.metadataValid = false;
        validationResults.issues.push('Capabilities must be an array');
      }
    }
    
    // Example rate-limit check (simplified)
    // In a real implementation, this would use persistent storage
    if (ipAddress) {
      // Mock implementation - would check against rate limit service
      const rateLimited = false; // Placeholder
      if (rateLimited) {
        validationResults.rateCheckPassed = false;
        validationResults.issues.push('Rate limit exceeded for this IP address');
      }
    }
    
    // Return validated data with results
    return {
      name,
      metadata,
      ipAddress,
      domain,
      validationResults,
    };
  },
});

// TEST: Should validate a valid agent name
// TEST: Should reject agent names with invalid characters
// TEST: Should reject agent names shorter than 3 characters
// TEST: Should reject agent names longer than 64 characters
// TEST: Should reject agent names with reserved prefixes
// TEST: Should validate metadata format and size
// TEST: Should enforce rate limits when enabled
```

#### 2. Issue Certificate

```typescript
const issueCertificate = new Step({
  id: 'issue-certificate',
  description: 'Issues a certificate for the agent',
  execute: async ({ context }) => {
    // Get validated agent data from previous step
    const validatedData = context.getStepResult(validateAgentDetails);
    
    if (!validatedData) {
      throw new Error('Validated agent data not found');
    }
    
    // Check if validation passed
    const { validationResults } = validatedData;
    if (!validationResults.nameValid || !validationResults.metadataValid || !validationResults.rateCheckPassed) {
      // Return with validation errors
      return {
        name: validatedData.name,
        status: 'FAILED',
        errors: validationResults.issues,
        certificate: null,
      };
    }
    
    try {
      // Generate a certificate for the agent
      // In a real implementation, this would use proper crypto libraries
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setFullYear(now.getFullYear() + 1); // 1 year validity
      
      const serialNumber = Math.floor(Math.random() * 10000000000).toString(16);
      
      const certificate = {
        serialNumber,
        subject: `CN=${validatedData.name},O=Agent Name Service`,
        issuer: 'CN=ANS Root CA,O=Agent Name Service',
        validFrom: now.toISOString(),
        validTo: expiresAt.toISOString(),
        publicKey: `MOCK_PUBLIC_KEY_${Date.now()}`, // Mock public key
        fingerprint: `MOCK_FINGERPRINT_${Date.now()}`, // Mock fingerprint
        status: 'VALID',
      };
      
      // Return the certificate
      return {
        name: validatedData.name,
        status: 'SUCCESS',
        certificate,
        metadata: validatedData.metadata,
        ipAddress: validatedData.ipAddress,
      };
    } catch (error) {
      // Handle certificate issuance errors
      return {
        name: validatedData.name,
        status: 'FAILED',
        errors: [`Certificate issuance failed: ${error.message || 'Unknown error'}`],
        certificate: null,
      };
    }
  },
});

// TEST: Should issue a valid certificate when validation passes
// TEST: Should include appropriate validity period (1 year)
// TEST: Should generate unique serial numbers for each certificate
// TEST: Should return error status when validation fails
// TEST: Should handle certificate generation errors gracefully
```

#### 3. Perform Security Analysis

```typescript
const performSecurityAnalysis = new Step({
  id: 'perform-security-analysis',
  description: 'Analyzes agent data for security threats',
  execute: async ({ context, mastra }) => {
    // Get data with certificate from previous step
    const certificateData = context.getStepResult(issueCertificate);
    
    if (!certificateData) {
      throw new Error('Certificate data not found');
    }
    
    // If certificate issuance failed, skip security analysis
    if (certificateData.status === 'FAILED') {
      return {
        name: certificateData.name,
        status: certificateData.status,
        errors: certificateData.errors,
        certificate: null,
        threatAnalysis: null,
      };
    }
    
    // Prepare data for security analysis
    const analysisInput = {
      name: certificateData.name,
      metadata: certificateData.metadata,
      certificate: certificateData.certificate,
      ipAddress: certificateData.ipAddress,
      analysisTime: new Date().toISOString(),
    };
    
    try {
      // Get the security agent for analysis
      // For this example, we'll use a mock response
      // In a real implementation, this would use a security agent
      
      // Mock security analysis result (actual implementation would perform real analysis)
      const threatAnalysis = {
        id: `threat-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        threatScore: 25, // Example score
        severity: 'LOW', // Example severity
        threatsDetected: true,
        detectedThreats: ['NETWORK_ACCESS'],
        recommendedActions: ['MONITOR_ACTIVITY'],
        details: {
          threatCategories: {
            NETWORK_ACCESS: {
              confidence: 0.7,
              evidence: 'Agent requests network capabilities',
              impact: 'Potential for unauthorized data access',
            }
          },
          analysisSource: 'mastra',
          metadata: {
            analysisVersion: '1.0.0',
          }
        }
      };
      
      // Determine if registration should proceed based on threat score
      const registerAgent = threatAnalysis.threatScore < 65; // Below HIGH severity
      
      return {
        name: certificateData.name,
        status: registerAgent ? 'SUCCESS' : 'REJECTED',
        certificate: certificateData.certificate,
        threatAnalysis,
        errors: registerAgent ? [] : ['Registration rejected due to security concerns'],
      };
    } catch (error) {
      // Handle security analysis errors
      return {
        name: certificateData.name,
        status: 'WARNING',
        certificate: certificateData.certificate,
        threatAnalysis: {
          id: `error-${Date.now()}`,
          timestamp: new Date().toISOString(),
          threatScore: 10, // Low default score
          severity: 'INFO',
          threatsDetected: false,
          detectedThreats: [],
          recommendedActions: ['MONITOR_ACTIVITY'],
          details: {
            threatCategories: {},
            analysisSource: 'fallback',
            metadata: {
              error: true,
              message: `Analysis failed: ${error.message || 'Unknown error'}`,
            }
          }
        },
        errors: [`Security analysis failed: ${error.message || 'Unknown error'}`],
      };
    }
  },
});

// TEST: Should perform security analysis on valid agents 
// TEST: Should detect network access capabilities in metadata
// TEST: Should reject registration for high-threat agents (score >= 65)
// TEST: Should allow registration with monitoring for medium-threat agents
// TEST: Should handle analysis failures gracefully
```

#### 4. Create Agent Card

```typescript
const createAgentCard = new Step({
  id: 'create-agent-card',
  description: 'Creates an agent card and registers the agent',
  execute: async ({ context }) => {
    // Get security analysis result from previous step
    const securityResult = context.getStepResult(performSecurityAnalysis);
    
    if (!securityResult) {
      throw new Error('Security analysis result not found');
    }
    
    // If security analysis failed or agent was rejected, return the result
    if (securityResult.status === 'FAILED' || securityResult.status === 'REJECTED') {
      return {
        name: securityResult.name,
        status: securityResult.status,
        errors: securityResult.errors,
        agentCard: null,
      };
    }
    
    try {
      // Create agent card
      const cardData = {
        name: securityResult.name,
        certificate: securityResult.certificate,
        securityAnalysis: {
          threatScore: securityResult.threatAnalysis.threatScore,
          severity: securityResult.threatAnalysis.severity,
          analysisTime: securityResult.threatAnalysis.timestamp,
        },
        registrationTime: new Date().toISOString(),
        status: 'ACTIVE',
      };
      
      // Format the agent card
      const agentCard = `Agent Card for ${securityResult.name}: ${JSON.stringify(cardData, null, 2)}`;
      
      // In a real implementation, this would save to a database
      
      return {
        name: securityResult.name,
        status: 'REGISTERED',
        agentCard,
        threatAnalysis: securityResult.threatAnalysis,
      };
    } catch (error) {
      return {
        name: securityResult.name,
        status: 'FAILED',
        errors: [`Failed to create agent card: ${error.message || 'Unknown error'}`],
        agentCard: null,
      };
    }
  },
});

// TEST: Should create a valid agent card for approved agents
// TEST: Should format agent card with proper JSON structure
// TEST: Should include certificate and security analysis in the card
// TEST: Should not create cards for rejected agents
// TEST: Should handle card creation errors gracefully
```

### Complete Workflow

```typescript
// Create the agent registration workflow
export const agentRegistrationWorkflow = new Workflow({
  name: 'agent-registration-workflow',
  triggerSchema: agentRegistrationSchema,
})
  .step(validateAgentDetails)
  .then(issueCertificate)
  .then(performSecurityAnalysis)
  .then(createAgentCard);

// Commit the workflow
agentRegistrationWorkflow.commit();
```

## Sequence Diagram

```
┌──────────────┐       ┌───────────────────┐      ┌───────────────┐      ┌───────────────┐      ┌────────────┐
│    Client    │       │ validateAgentData │      │issueCertificate│      │securityAnalysis│      │ agentCard  │
└──────┬───────┘       └─────────┬─────────┘      └───────┬───────┘      └───────┬───────┘      └─────┬──────┘
       │                         │                        │                      │                    │
       │ Register Agent          │                        │                      │                    │
       │────────────────────────>│                        │                      │                    │
       │                         │                        │                      │                    │
       │                         │ Validate name,         │                      │                    │
       │                         │ metadata, rate limits  │                      │                    │
       │                         │────────────────────────│                      │                    │
       │                         │                        │                      │                    │
       │                         │                        │ Issue X.509          │                    │
       │                         │                        │ Certificate          │                    │
       │                         │                        │──────────────────────│                    │
       │                         │                        │                      │                    │
       │                         │                        │                      │ Perform            │
       │                         │                        │                      │ Security Analysis  │
       │                         │                        │                      │────────────────────│
       │                         │                        │                      │                    │
       │                         │                        │                      │                    │ Create
       │                         │                        │                      │                    │ Agent Card
       │                         │                        │                      │                    │──────────┐
       │                         │                        │                      │                    │          │
       │                         │                        │                      │                    │<─────────┘
       │                         │                        │                      │                    │
       │ Return Registration     │                        │                      │                    │
       │ Result with Agent Card  │                        │                      │                    │
       │<────────────────────────────────────────────────────────────────────────────────────────────│
       │                         │                        │                      │                    │
```

## Error Handling

The workflow includes comprehensive error handling at each step:

1. **Validation Errors**: Invalid agent names, metadata, or rate limit violations are detected in the validation step and returned with specific error messages.

2. **Certificate Errors**: Issues with certificate generation are caught and propagated through the workflow.

3. **Security Analysis Errors**: If security analysis fails, the workflow can continue with a fallback analysis or default low-risk score.

4. **Registration Rejection**: If security analysis determines the agent is high-risk, registration is rejected with appropriate error messages.

5. **Database Errors**: Errors saving agent cards are caught and reported.

## Security Considerations

1. **Name Validation**: Strict validation prevents injection attacks through agent names.

2. **Certificate Security**: Certificates should use strong cryptographic algorithms and be stored securely.

3. **Threat Analysis**: Security analysis identifies potentially malicious agents before registration.

4. **Rate Limiting**: Prevents abuse of the registration service.

5. **Audit Logging**: All registration attempts should be logged for security auditing.
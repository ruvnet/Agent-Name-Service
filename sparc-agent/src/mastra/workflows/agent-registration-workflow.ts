import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

// Define schema for agent registration
const agentRegistrationSchema = z.object({
  name: z.string().describe('The unique name for the agent'),
  metadata: z.object({
    description: z.string().optional().describe('Description of the agent'),
    capabilities: z.array(z.string()).optional().describe('List of agent capabilities'),
    version: z.string().optional().describe('Agent version'),
    provider: z.string().optional().describe('Agent provider'),
    contact: z.string().email().optional().describe('Contact email'),
    tags: z.array(z.string()).optional().describe('Tags for categorizing the agent'),
  }).describe('Metadata about the agent'),
  ipAddress: z.string().optional().describe('IP address of the agent'),
  domainName: z.string().optional().describe('Domain name associated with the agent'),
});

// Agent for registration validation
const registrationValidationAgent = new Agent({
  name: 'Registration Validation Agent',
  model: openai('gpt-4o'),
  instructions: `
    You are a registration validation agent for the Agent Naming Service.
    Your role is to analyze agent registration requests and validate them for:
    
    1. Security issues - Look for suspicious names, descriptions, or capabilities
    2. Name collisions - Check if the name might conflict with existing agents
    3. Policy compliance - Ensure the registration meets platform policies
    4. Quality standards - Verify metadata is complete and descriptive
    
    Respond in JSON format with:
    - valid: boolean indicating if registration is valid
    - issues: array of specific issues found
    - recommendations: array of suggestions for improving the registration
    - risk_score: number from 0-100 representing risk level
    - notes: any additional observations
  `,
});

// Step 1: Validate Agent Registration
const validateAgentRegistration = new Step({
  id: 'validate-agent-registration',
  description: 'Validates the agent registration data',
  inputSchema: agentRegistrationSchema,
  outputSchema: z.object({
    name: z.string(),
    metadata: z.record(z.any()),
    valid: z.boolean(),
    validationStatus: z.string(),
    issues: z.array(z.string()),
    recommendations: z.array(z.string()),
    riskScore: z.number(),
  }),
  execute: async ({ context }) => {
    // Get trigger data
    const registrationData = context.getStepResult('trigger');
    
    if (!registrationData) {
      throw new Error('Registration data not found in trigger');
    }
    
    // Extract data
    const { name, metadata, ipAddress, domainName } = registrationData;
    
    // Initialize validation result
    const validationResult = {
      name,
      metadata,
      valid: false,
      validationStatus: 'PENDING',
      issues: [] as string[],
      recommendations: [] as string[],
      riskScore: 0,
    };
    
    try {
      // Basic validation
      // Check name format and reserved prefixes
      const reservedPrefixes = ['system.', 'admin.', 'security.', 'root.', 'mcp.', 'core.'];
      const nameLower = name.toLowerCase();
      
      for (const prefix of reservedPrefixes) {
        if (nameLower.startsWith(prefix)) {
          validationResult.issues.push(`Name uses reserved prefix: ${prefix}`);
          validationResult.riskScore += 50;
        }
      }
      
      // Check for special characters that might cause issues
      if (!/^[a-zA-Z0-9._-]+$/.test(name)) {
        validationResult.issues.push('Name contains invalid characters (only letters, numbers, dots, hyphens, and underscores are allowed)');
        validationResult.recommendations.push('Use only alphanumeric characters, dots, hyphens, and underscores in the name');
        validationResult.riskScore += 30;
      }
      
      // Check name length
      if (name.length < 3) {
        validationResult.issues.push('Name is too short (minimum 3 characters)');
        validationResult.riskScore += 20;
      }
      
      if (name.length > 64) {
        validationResult.issues.push('Name is too long (maximum 64 characters)');
        validationResult.riskScore += 10;
      }
      
      // Validate metadata
      if (!metadata.description) {
        validationResult.recommendations.push('Add a description to improve discoverability');
      } else if (metadata.description.length < 10) {
        validationResult.recommendations.push('Provide a more detailed description');
      }
      
      if (!metadata.capabilities || metadata.capabilities.length === 0) {
        validationResult.recommendations.push('List agent capabilities to help users understand what this agent can do');
      }
      
      // Enhanced validation with AI
      try {
        // Prepare data for AI validation
        const aiValidationData = {
          name,
          metadata,
          ipAddress: ipAddress || 'unknown',
          domainName: domainName || 'unknown',
        };
        
        // Call the validation agent
        const response = await registrationValidationAgent.stream([
          {
            role: 'user',
            content: `Validate this agent registration request:\n\n${JSON.stringify(aiValidationData, null, 2)}`,
          }
        ]);
        
        // Collect the streamed response
        let validationText = '';
        for await (const chunk of response.textStream) {
          validationText += chunk;
        }
        
        // Parse the validation result
        try {
          const aiValidation = JSON.parse(validationText);
          
          // Add AI validation results
          if (aiValidation.valid === false) {
            if (aiValidation.issues && Array.isArray(aiValidation.issues)) {
              for (const issue of aiValidation.issues) {
                validationResult.issues.push(issue);
              }
            }
          }
          
          if (aiValidation.recommendations && Array.isArray(aiValidation.recommendations)) {
            for (const rec of aiValidation.recommendations) {
              validationResult.recommendations.push(rec);
            }
          }
          
          if (typeof aiValidation.risk_score === 'number') {
            // We'll average our base risk score with the AI's assessment
            validationResult.riskScore = Math.round((validationResult.riskScore + aiValidation.risk_score) / 2);
          }
        } catch (parseError) {
          console.error('Failed to parse AI validation response:', parseError);
          validationResult.issues.push('Error processing AI validation');
        }
      } catch (aiError) {
        console.error('Error during AI validation:', aiError);
        // Continue with basic validation only
      }
      
      // Make final validation decision
      validationResult.valid = validationResult.issues.length === 0 && validationResult.riskScore < 50;
      validationResult.validationStatus = validationResult.valid ? 'VALID' : 'INVALID';
      
      return validationResult;
    } catch (error) {
      validationResult.validationStatus = 'ERROR';
      validationResult.issues.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      validationResult.valid = false;
      return validationResult;
    }
  },
});

// Step 2: Generate Agent Certificate
const generateAgentCertificate = new Step({
  id: 'generate-agent-certificate',
  description: 'Generates a certificate for the agent',
  execute: async ({ context }) => {
    // Get validation result
    const validationResult = context.getStepResult(validateAgentRegistration);
    
    if (!validationResult) {
      throw new Error('Validation result not found');
    }
    
    // Cast to expected type
    const typedValidationResult = validationResult as {
      name: string;
      metadata: Record<string, any>;
      valid: boolean;
      validationStatus: string;
      issues: string[];
    };
    
    // Extract key information
    const { name, metadata, valid, validationStatus, issues } = typedValidationResult;
    
    // Initialize certificate result
    const certificateResult = {
      name,
      metadata,
      valid,
      validationStatus,
      issues: [...issues],
      certificate: null as any,
      certificateStatus: 'PENDING',
    };
    
    // Skip certificate generation if validation failed
    if (!valid) {
      certificateResult.certificateStatus = 'SKIPPED';
      certificateResult.issues.push('Certificate generation skipped due to failed validation');
      return certificateResult;
    }
    
    try {
      // In a real implementation, this would generate a proper X.509 certificate
      // This is a simplified mock implementation
      
      // Generate certificate properties
      const now = new Date();
      const expirationDate = new Date(now);
      expirationDate.setFullYear(expirationDate.getFullYear() + 1); // 1 year validity
      
      const serialNumber = generateRandomHex(16);
      const fingerprint = generateRandomHex(32);
      
      // Create the certificate object
      const certificate = {
        serialNumber,
        subject: `/CN=${name}/O=Agent Naming Service`,
        issuer: '/CN=ANS Root CA/O=Agent Naming Service',
        validFrom: now.toISOString(),
        validTo: expirationDate.toISOString(),
        fingerprint,
        publicKey: `-----BEGIN PUBLIC KEY-----\nMC4CAQACBQDnGQc3AgMBAAECBQCcvBa5AgMA/icCAwDX3QIDANu/AgIHYQIDAJ8l\n-----END PUBLIC KEY-----`,
        status: 'VALID',
      };
      
      certificateResult.certificate = certificate;
      certificateResult.certificateStatus = 'GENERATED';
      
      return certificateResult;
    } catch (error) {
      certificateResult.certificateStatus = 'FAILED';
      certificateResult.issues.push(`Certificate generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return certificateResult;
    }
  },
});

// Step 3: Register Agent
const registerAgent = new Step({
  id: 'register-agent',
  description: 'Registers the agent in the database',
  execute: async ({ context }) => {
    // Get certificate result
    const certificateResult = context.getStepResult(generateAgentCertificate);
    
    if (!certificateResult) {
      throw new Error('Certificate result not found');
    }
    
    // Cast to expected type
    const typedCertificateResult = certificateResult as {
      name: string;
      metadata: Record<string, any>;
      certificate: any;
      certificateStatus: string;
      issues: string[];
    };
    
    // Extract key information
    const { name, metadata, certificate, certificateStatus, issues } = typedCertificateResult;
    
    // Initialize registration result
    const registrationResult = {
      name,
      metadata,
      certificate,
      registrationStatus: 'PENDING',
      registeredAt: null as string | null,
      issues: [...issues],
      agentCard: null as string | null,
    };
    
    // Skip registration if certificate generation failed
    if (certificateStatus !== 'GENERATED') {
      registrationResult.registrationStatus = 'SKIPPED';
      registrationResult.issues.push('Registration skipped due to certificate issues');
      return registrationResult;
    }
    
    try {
      // In a real implementation, this would store the agent in a database
      // This is a simplified mock implementation
      
      // Record registration time
      const registrationTime = new Date().toISOString();
      registrationResult.registeredAt = registrationTime;
      
      // Format agent card (a serialized representation of the agent)
      registrationResult.agentCard = JSON.stringify({
        name,
        metadata,
        certificate,
        registeredAt: registrationTime,
      }, null, 2);
      
      registrationResult.registrationStatus = 'REGISTERED';
      
      return registrationResult;
    } catch (error) {
      registrationResult.registrationStatus = 'FAILED';
      registrationResult.issues.push(`Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return registrationResult;
    }
  },
});

// Helper function to generate random hex string
function generateRandomHex(length: number): string {
  const characters = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * 16));
  }
  return result;
}

// Create the agent registration workflow
const agentRegistrationWorkflow = new Workflow({
  name: 'agent-registration-workflow',
  triggerSchema: agentRegistrationSchema,
})
  .step(validateAgentRegistration)
  .then(generateAgentCertificate)
  .then(registerAgent);

// Commit the workflow to make it active
agentRegistrationWorkflow.commit();

// Export the workflow
export { agentRegistrationWorkflow };
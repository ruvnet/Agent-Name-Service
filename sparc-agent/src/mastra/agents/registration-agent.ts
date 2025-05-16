import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { z } from 'zod';

/**
 * Helper function to generate random hex string
 * Used for certificate generation
 */
function generateRandomHex(length: number): string {
  const characters = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * 16));
  }
  return result;
}

/**
 * Registration Agent
 * 
 * This agent handles the complete agent registration process including:
 * - Registration data validation
 * - Certificate generation
 * - Agent registration
 * 
 * The agent combines all steps from the agent-registration-workflow into
 * a single interaction and returns a structured JSON response.
 */
export const registrationAgent = new Agent({
  name: 'Agent Registration Service',
  model: openai('gpt-4o'),
  instructions: `
    You are the Agent Registration Service for the Agent Naming Service.
    Your responsibility is to process agent registration requests by performing validation,
    certificate generation, and registration in a single interaction.
    
    The registration process has three main steps:
    
    1. VALIDATION
       - Check agent name for reserved prefixes (system., admin., security., root., mcp., core.)
       - Validate name format (only alphanumeric chars, dots, hyphens, and underscores allowed)
       - Ensure name length is between 3-64 characters
       - Review metadata for completeness and quality
       - Assess security risk and identify potential issues
       
    2. CERTIFICATE GENERATION
       - Only generate certificates for valid agents
       - Create certificates with 1-year validity
       - Include serial number, subject, issuer, validity dates, and public key
       
    3. REGISTRATION
       - Only register agents with valid certificates
       - Create an agent card as a serialized representation
       - Record registration timestamp
       
    You must return a complete, structured JSON response containing:
    {
      "name": "agent name",
      "metadata": { agent metadata object },
      "validationStatus": "VALID" | "INVALID" | "ERROR",
      "valid": boolean,
      "issues": ["array of issues found"],
      "recommendations": ["array of suggestions to improve registration"],
      "riskScore": number from 0-100,
      "certificate": certificate object or null,
      "certificateStatus": "GENERATED" | "SKIPPED" | "FAILED",
      "registrationStatus": "REGISTERED" | "SKIPPED" | "FAILED",
      "registeredAt": timestamp or null,
      "agentCard": serialized agent card or null
    }
    
    IMPORTANT: Always perform all validation checks and include all required fields in your response.
    Your entire response must be valid, parseable JSON with no other text.
  `
});

/**
 * Processes a complete agent registration using the registration agent
 * 
 * This function handles the entire registration workflow:
 * 1. Validates the registration data
 * 2. Generates a certificate if validation passes
 * 3. Registers the agent if certificate generation succeeds
 * 
 * @param registrationData The agent registration data
 * @returns A complete registration result object
 */
export async function processAgentRegistration(registrationData: {
  name: string;
  metadata: {
    description?: string;
    capabilities?: string[];
    version?: string;
    provider?: string;
    contact?: string;
    tags?: string[];
  };
  ipAddress?: string;
  domainName?: string;
}) {
  try {
    // 1. PREPARE DATA FOR VALIDATION
    // Format data for the agent
    const registrationRequest = JSON.stringify(registrationData, null, 2);
    
    // 2. CALL THE REGISTRATION AGENT
    const response = await registrationAgent.stream([
      {
        role: 'user',
        content: `Process this agent registration request:\n\n${registrationRequest}`
      }
    ]);
    
    // 3. COLLECT THE STREAMED RESPONSE
    let resultText = '';
    for await (const chunk of response.textStream) {
      resultText += chunk;
    }
    
    // 4. PARSE AND RETURN THE RESULT
    try {
      const result = JSON.parse(resultText);
      return result;
    } catch (parseError) {
      // Handle invalid JSON response
      return {
        name: registrationData.name,
        metadata: registrationData.metadata,
        validationStatus: 'ERROR',
        valid: false,
        issues: [`Failed to parse agent response: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`],
        recommendations: ['Contact system administrator'],
        riskScore: 100,
        certificate: null,
        certificateStatus: 'FAILED',
        registrationStatus: 'FAILED',
        registeredAt: null,
        agentCard: null
      };
    }
  } catch (error) {
    // Handle any unexpected errors
    return {
      name: registrationData.name,
      metadata: registrationData.metadata,
      validationStatus: 'ERROR',
      valid: false,
      issues: [`Registration process error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      recommendations: [],
      riskScore: 100,
      certificate: null,
      certificateStatus: 'FAILED',
      registrationStatus: 'FAILED',
      registeredAt: null,
      agentCard: null
    };
  }
}
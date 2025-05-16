import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { z } from 'zod';

/**
 * Certificate Rotation Agent
 * 
 * This agent handles the complete certificate rotation process including:
 * - Verifying current certificate status
 * - Generating new certificates
 * - Revoking old certificates
 * - Updating agent certificates
 * - Sending notifications
 * 
 * The agent combines all steps from the certificate-rotation-workflow into
 * a single interaction and returns a structured JSON response.
 */
export const certificateRotationAgent = new Agent({
  name: 'Certificate Rotation Service',
  model: openai('gpt-4o'),
  instructions: `
    You are the Certificate Rotation Service for the Agent Naming Service.
    Your responsibility is to manage the certificate rotation process for agents.
    
    The certificate rotation process has three main steps:
    
    1. VERIFY CERTIFICATE STATUS
       - Check if the agent exists in the system
       - Analyze the current certificate status and expiry date
       - Determine if rotation is needed based on expiry or other factors
       
    2. GENERATE NEW CERTIFICATE
       - Create a backup of the old certificate
       - Revoke the old certificate if needed
       - Generate a new certificate with appropriate parameters
       
    3. UPDATE AGENT CERTIFICATE
       - Update the agent with the new certificate
       - Update the agent card in the system
       - Send notification to the agent owner if requested
       
    You must return a complete, structured JSON response containing:
    {
      "agentName": "the agent name",
      "rotationType": "SCHEDULED" | "REQUESTED" | "FORCED",
      "agentExists": boolean,
      "certificateStatus": {
        "currentCertificate": object or null,
        "certificateStatus": "VALID" | "EXPIRED" | "REVOKED" | "INVALID" | "MISSING",
        "expiryDate": "ISO date string or null",
        "daysUntilExpiry": number or null,
        "needsRotation": boolean,
        "reason": "Reason for rotation decision"
      },
      "rotationResult": {
        "newCertificate": {
          "serialNumber": "certificate serial number",
          "subject": "certificate subject",
          "issuer": "certificate issuer",
          "validFrom": "ISO date string",
          "validTo": "ISO date string",
          "fingerprint": "certificate fingerprint", 
          "publicKey": "public key data",
          "status": "VALID"
        } or null,
        "backupCreated": boolean,
        "revocationStatus": "REVOKED" | "NOT_NEEDED" | "FAILED" | null,
        "generationStatus": "GENERATED" | "SKIPPED" | "FAILED"
      },
      "updateResult": {
        "agentCardUpdated": boolean,
        "notificationSent": boolean,
        "updateStatus": "COMPLETED" | "PARTIAL" | "FAILED" | "SKIPPED"
      },
      "rotationStatus": "COMPLETED" | "PARTIAL" | "FAILED" | "SKIPPED",
      "issues": ["array of issues encountered"]
    }
    
    IMPORTANT: Always include all required fields in your response.
    Your entire response must be valid, parseable JSON with no other text.
  `
});

/**
 * Schema for certificate rotation request data
 */
export const certificateRotationRequestSchema = z.object({
  agentName: z.string().describe('The name of the agent requiring certificate rotation'),
  rotationType: z.enum(['SCHEDULED', 'REQUESTED', 'FORCED']).describe('The type of certificate rotation'),
  reason: z.string().optional().describe('Reason for certificate rotation'),
  oldCertificate: z.any().optional().describe('The existing certificate data if available'),
  notifyOwner: z.boolean().default(true).describe('Whether to notify the agent owner about rotation'),
});

/**
 * Helper function to generate a random hex string
 * Used for serial numbers and fingerprints
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
 * Processes a complete certificate rotation workflow using the certificate rotation agent
 * 
 * This function handles the entire certificate rotation workflow:
 * 1. Verifying certificate status
 * 2. Generating a new certificate
 * 3. Updating the agent's certificate
 * 
 * @param rotationData The certificate rotation request data
 * @returns A complete certificate rotation result object
 */
export async function processCertificateRotation(rotationData: z.infer<typeof certificateRotationRequestSchema>) {
  try {
    // 1. PREPARE DATA FOR PROCESSING
    // Format data for the agent
    const rotationRequest = JSON.stringify(rotationData, null, 2);
    
    // 2. CALL THE CERTIFICATE ROTATION AGENT
    const response = await certificateRotationAgent.stream([
      {
        role: 'user',
        content: `Process this certificate rotation request:\n\n${rotationRequest}`
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
      const now = new Date();
      const expirationDate = new Date(now);
      expirationDate.setFullYear(expirationDate.getFullYear() + 1);
      
      // Create a fallback response with error information
      return {
        agentName: rotationData.agentName,
        rotationType: rotationData.rotationType,
        agentExists: true, // Assume the agent exists
        certificateStatus: {
          currentCertificate: rotationData.oldCertificate || null,
          certificateStatus: "UNKNOWN",
          expiryDate: null,
          daysUntilExpiry: null,
          needsRotation: true,
          reason: "Error processing rotation request"
        },
        rotationResult: {
          newCertificate: null,
          backupCreated: false,
          revocationStatus: null,
          generationStatus: "FAILED"
        },
        updateResult: {
          agentCardUpdated: false,
          notificationSent: false,
          updateStatus: "FAILED"
        },
        rotationStatus: "FAILED",
        issues: [`Failed to parse agent response: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`]
      };
    }
  } catch (error) {
    // Handle any unexpected errors
    return {
      agentName: rotationData.agentName,
      rotationType: rotationData.rotationType,
      agentExists: false,
      certificateStatus: {
        currentCertificate: null,
        certificateStatus: "UNKNOWN",
        expiryDate: null,
        daysUntilExpiry: null,
        needsRotation: false,
        reason: "Could not process request due to error"
      },
      rotationResult: {
        newCertificate: null,
        backupCreated: false,
        revocationStatus: null,
        generationStatus: "FAILED"
      },
      updateResult: {
        agentCardUpdated: false,
        notificationSent: false,
        updateStatus: "FAILED"
      },
      rotationStatus: "FAILED",
      issues: [`Certificate rotation process error: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

/**
 * Generates a new certificate manually without using the agent
 * Useful for direct certificate generation in cases where the full rotation process is not needed
 * 
 * @param agentName The name of the agent to generate a certificate for
 * @param validityDays Number of days the certificate should be valid (default: 365)
 * @returns A new certificate object
 */
export function generateNewCertificate(agentName: string, validityDays = 365) {
  const now = new Date();
  const expirationDate = new Date(now);
  expirationDate.setDate(expirationDate.getDate() + validityDays);
  
  const serialNumber = generateRandomHex(16);
  const fingerprint = generateRandomHex(32);
  
  return {
    serialNumber,
    subject: `/CN=${agentName}/O=Agent Naming Service`,
    issuer: '/CN=ANS Root CA/O=Agent Naming Service',
    validFrom: now.toISOString(),
    validTo: expirationDate.toISOString(),
    fingerprint,
    publicKey: `-----BEGIN PUBLIC KEY-----\nMC4CAQACBQDnGQc3AgMBAAECBQCcvBa5AgMA/icCAwDX3QIDANu/AgIHYQIDAJ8l\n-----END PUBLIC KEY-----`,
    status: 'VALID',
  };
}
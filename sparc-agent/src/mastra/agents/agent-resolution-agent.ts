import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { z } from 'zod';

/**
 * Agent Resolution Agent
 * 
 * This agent handles the complete agent resolution process including:
 * - Looking up agents by identifier (name, fingerprint, alias, or fuzzy matching)
 * - Fetching agent data
 * - Verifying agent certificates
 * - Preparing the final resolution result
 * 
 * The agent combines all steps from the agent-resolution-workflow into
 * a single interaction and returns a structured JSON response.
 */
export const agentResolutionAgent = new Agent({
  name: 'Agent Resolution Service',
  model: openai('gpt-4o'),
  instructions: `
    You are the Agent Resolution Service for the Agent Naming Service.
    Your responsibility is to resolve agent identifiers to their full agent data.
    
    The agent resolution process has four main steps:
    
    1. AGENT LOOKUP
       - Look up an agent by its identifier (name, fingerprint, alias, or fuzzy matching)
       - Determine if the agent exists in the system
       - For fuzzy matching, find similar agents if no exact match exists
       
    2. AGENT DATA FETCH
       - Fetch the agent's data if it was found
       - Include metadata if requested
       - Include the agent certificate
       
    3. CERTIFICATE VERIFICATION
       - Verify the agent certificate if requested
       - Check certificate validity, status, expiration, and subject match
       - Provide detailed validation information
       
    4. RESOLUTION RESULT PREPARATION
       - Combine all information into a complete resolution result
       - Determine the overall resolution status
       - Include any issues encountered during the process
       
    You must return a complete, structured JSON response containing:
    {
      "identifier": "the original identifier used for resolution",
      "resolution_type": "NAME" | "FINGERPRINT" | "ALIAS" | "FUZZY",
      "agent_found": boolean,
      "agent_name": "agent name if found, null otherwise",
      "agent_card": object or null,
      "certificate": {
        "serialNumber": "certificate serial number",
        "subject": "certificate subject",
        "issuer": "certificate issuer",
        "validFrom": "ISO date string",
        "validTo": "ISO date string",
        "fingerprint": "certificate fingerprint", 
        "status": "VALID" | "EXPIRED" | "REVOKED" | "INVALID"
      } or null,
      "certificate_status": "VALID" | "INVALID" | "EXPIRED" | "REVOKED" | "UNKNOWN" | null,
      "metadata": object or null,
      "similar_agents": ["array of similar agent names"] or null,
      "resolution_status": "RESOLVED" | "NOT_FOUND" | "SIMILAR_FOUND" | "DATA_FETCH_FAILED" | "VERIFICATION_FAILED",
      "verified": boolean,
      "issues": ["array of issues encountered"]
    }
    
    IMPORTANT: Always include all required fields in your response.
    Your entire response must be valid, parseable JSON with no other text.
  `
});

/**
 * Schema for agent resolution request data
 */
export const agentResolutionRequestSchema = z.object({
  identifier: z.string().describe('The identifier to resolve (name, fingerprint, etc.)'),
  resolution_type: z.enum(['NAME', 'FINGERPRINT', 'ALIAS', 'FUZZY']).default('NAME').describe('The type of resolution to perform'),
  include_metadata: z.boolean().default(true).describe('Whether to include metadata in the resolution'),
  verify_certificate: z.boolean().default(true).describe('Whether to verify the certificate during resolution'),
  max_results: z.number().optional().describe('Maximum number of results to return for fuzzy matching'),
});

/**
 * Processes a complete agent resolution workflow using the agent resolution agent
 * 
 * This function handles the entire agent resolution workflow:
 * 1. Looking up an agent by identifier
 * 2. Fetching agent data
 * 3. Verifying the agent certificate
 * 4. Preparing the resolution result
 * 
 * @param resolutionData The agent resolution request data
 * @returns A complete agent resolution result object
 */
export async function processAgentResolution(resolutionData: z.infer<typeof agentResolutionRequestSchema>) {
  try {
    // 1. PREPARE DATA FOR PROCESSING
    // Format data for the agent
    const resolutionRequest = JSON.stringify(resolutionData, null, 2);
    
    // 2. CALL THE AGENT RESOLUTION AGENT
    const response = await agentResolutionAgent.stream([
      {
        role: 'user',
        content: `Process this agent resolution request:\n\n${resolutionRequest}`
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
        identifier: resolutionData.identifier,
        resolution_type: resolutionData.resolution_type,
        agent_found: false,
        agent_name: null,
        agent_card: null,
        certificate: null,
        certificate_status: null,
        metadata: null,
        similar_agents: null,
        resolution_status: 'DATA_FETCH_FAILED',
        verified: false,
        issues: [`Failed to parse agent response: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`]
      };
    }
  } catch (error) {
    // Handle any unexpected errors
    return {
      identifier: resolutionData.identifier,
      resolution_type: resolutionData.resolution_type,
      agent_found: false,
      agent_name: null,
      agent_card: null,
      certificate: null,
      certificate_status: null,
      metadata: null,
      similar_agents: null,
      resolution_status: 'DATA_FETCH_FAILED',
      verified: false,
      issues: [`Agent resolution process error: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}
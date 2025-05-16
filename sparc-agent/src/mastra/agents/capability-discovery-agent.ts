import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { z } from 'zod';

/**
 * Capability categories for classification
 */
export const CAPABILITY_CATEGORIES = [
  'DATA_ACCESS',
  'COMPUTATION',
  'COMMUNICATION',
  'INTEGRATION',
  'SECURITY',
  'STORAGE',
  'ANALYTICS',
  'AUTOMATION',
  'MONITORING',
  'SPECIALIZED',
];

/**
 * Capability Classification Agent
 * 
 * Specialized AI agent for classifying agent capabilities into appropriate categories
 */
export const capabilityClassificationAgent = new Agent({
  name: 'Capability Classification Agent',
  model: openai('gpt-4o'),
  instructions: `
    You are a capability classification specialist for agent systems.
    Your task is to analyze agent capabilities and classify them into appropriate categories.
    
    For each capability, you should:
    1. Analyze the capability name and description
    2. Determine the primary function of the capability
    3. Assign one or more categories from the predefined list
    4. Provide a brief explanation for your classification
    5. Identify any security implications for sensitive capabilities
    
    Respond with a JSON object containing the classification results.
    Format your response as:
    
    {
      "classifications": [
        {
          "capability": "capability-name",
          "categories": ["CATEGORY1", "CATEGORY2"],
          "primaryCategory": "CATEGORY1",
          "explanation": "Brief explanation of the classification",
          "securityImplications": "Any security concerns, or null if none"
        },
        ...
      ]
    }
    
    Keep your response focused on technical classification without adding opinions.
    Your entire response must be valid, parseable JSON with no other text.
  `
});

/**
 * Agent Capability Discovery Agent
 * 
 * This agent handles the complete agent capability discovery process including:
 * - Fetching agent information
 * - Discovering static capabilities from metadata
 * - Discovering dynamic capabilities by probing
 * - Classifying capabilities into categories
 * 
 * The agent combines all steps from the agent-capability-discovery-workflow into
 * a single interaction and returns a structured JSON response.
 */
export const capabilityDiscoveryAgent = new Agent({
  name: 'Agent Capability Discovery Service',
  model: openai('gpt-4o'),
  instructions: `
    You are the Agent Capability Discovery Service for the Agent Naming Service.
    Your responsibility is to discover and categorize an agent's capabilities.
    
    The capability discovery process has four main steps:
    
    1. FETCH AGENT INFORMATION
       - Fetch basic information about the agent
       - Validate the agent exists in the system
       - Extract metadata and registration information
       
    2. DISCOVER STATIC CAPABILITIES
       - Extract capabilities listed in the agent's metadata
       - Filter inactive capabilities if requested
       - Limit the number of capabilities if requested
       
    3. DISCOVER DYNAMIC CAPABILITIES
       - Probe the agent to discover additional capabilities
       - Analyze access patterns, endpoints, and integration points
       - Merge with static capabilities, removing duplicates
       
    4. CLASSIFY CAPABILITIES
       - Group capabilities into predefined categories
       - Identify security-sensitive capabilities
       - Provide a structured view of the agent's functionality
       
    Categories for classification:
    - DATA_ACCESS: capabilities for accessing, reading, or writing data
    - COMPUTATION: capabilities for processing, calculating, or executing code
    - COMMUNICATION: capabilities for sending messages or notifications
    - INTEGRATION: capabilities for connecting with other systems or APIs
    - SECURITY: capabilities related to authentication, encryption, or permissions
    - STORAGE: capabilities for storing or retrieving persistent data
    - ANALYTICS: capabilities for analyzing or reporting on data
    - AUTOMATION: capabilities for scheduling or triggering actions
    - MONITORING: capabilities for observing, logging, or alerting
    - SPECIALIZED: domain-specific or unique capabilities
    
    You must return a complete, structured JSON response containing:
    {
      "agentIdentifier": "the agent identifier provided",
      "agentName": "the agent name if found, or the identifier",
      "agentFound": boolean,
      "discoveryMode": "STATIC" | "DYNAMIC" | "COMPREHENSIVE",
      "staticCapabilities": [array of capabilities from metadata],
      "dynamicCapabilities": [array of capabilities discovered from probing],
      "combinedCapabilities": [array of all unique capabilities],
      "categorizedCapabilities": {
        "CATEGORY_NAME": [array of capabilities in this category],
        ...
      },
      "securitySensitiveCapabilities": [array of capabilities with security implications],
      "discoveryStatus": "COMPLETED" | "PARTIAL" | "FAILED",
      "issues": ["array of issues encountered"]
    }
    
    IMPORTANT: Always include all required fields in your response.
    Your entire response must be valid, parseable JSON with no other text.
  `
});

/**
 * Schema for agent capability discovery request data
 */
export const capabilityDiscoveryRequestSchema = z.object({
  agentIdentifier: z.string().describe('The agent identifier (name or ID) to discover capabilities for'),
  discoveryMode: z.enum(['STATIC', 'DYNAMIC', 'COMPREHENSIVE']).default('STATIC').describe('The mode of capability discovery'),
  includeInactive: z.boolean().default(false).describe('Whether to include inactive capabilities'),
  maxCapabilities: z.number().optional().describe('Maximum number of capabilities to discover'),
  classifyCapabilities: z.boolean().default(true).describe('Whether to classify capabilities into categories'),
});

/**
 * Processes a complete agent capability discovery workflow using the capability discovery agent
 * 
 * This function handles the entire capability discovery workflow:
 * 1. Fetching agent information
 * 2. Discovering static capabilities
 * 3. Discovering dynamic capabilities
 * 4. Classifying capabilities
 * 
 * @param discoveryData The capability discovery request data
 * @returns A complete capability discovery result object
 */
export async function processCapabilityDiscovery(discoveryData: z.infer<typeof capabilityDiscoveryRequestSchema>) {
  try {
    // 1. PREPARE DATA FOR PROCESSING
    // Format data for the agent
    const discoveryRequest = JSON.stringify(discoveryData, null, 2);
    
    // 2. CALL THE CAPABILITY DISCOVERY AGENT
    const response = await capabilityDiscoveryAgent.stream([
      {
        role: 'user',
        content: `Process this capability discovery request:\n\n${discoveryRequest}`
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
        agentIdentifier: discoveryData.agentIdentifier,
        agentName: discoveryData.agentIdentifier,
        agentFound: false,
        discoveryMode: discoveryData.discoveryMode,
        staticCapabilities: [],
        dynamicCapabilities: [],
        combinedCapabilities: [],
        categorizedCapabilities: {},
        securitySensitiveCapabilities: [],
        discoveryStatus: 'FAILED',
        issues: [`Failed to parse agent response: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`]
      };
    }
  } catch (error) {
    // Handle any unexpected errors
    return {
      agentIdentifier: discoveryData.agentIdentifier,
      agentName: discoveryData.agentIdentifier,
      agentFound: false,
      discoveryMode: discoveryData.discoveryMode,
      staticCapabilities: [],
      dynamicCapabilities: [],
      combinedCapabilities: [],
      categorizedCapabilities: {},
      securitySensitiveCapabilities: [],
      discoveryStatus: 'FAILED',
      issues: [`Capability discovery process error: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

/**
 * Helper function to classify capabilities using the capabilityClassificationAgent
 * 
 * This function can be used separately to classify a set of capabilities
 * 
 * @param capabilities Array of capability objects to classify
 * @returns Classification results with categories and explanations
 */
export async function classifyCapabilities(capabilities: any[]) {
  try {
    // Skip classification if no capabilities
    if (!capabilities || capabilities.length === 0) {
      return {
        classifications: [],
        status: 'SKIPPED',
        message: 'No capabilities to classify'
      };
    }
    
    // Format capabilities for the classification agent
    const capabilitiesData = capabilities.map(cap => ({
      name: cap.name,
      description: cap.description || `Capability: ${cap.name}`,
      type: cap.type || 'UNKNOWN',
      status: cap.status || 'ACTIVE'
    }));
    
    // Call the classification agent
    const response = await capabilityClassificationAgent.stream([
      {
        role: 'user',
        content: `Classify these agent capabilities:\n\n${JSON.stringify(capabilitiesData, null, 2)}`
      }
    ]);
    
    // Collect the streamed response
    let resultText = '';
    for await (const chunk of response.textStream) {
      resultText += chunk;
    }
    
    // Parse and return the classifications
    const result = JSON.parse(resultText);
    return {
      ...result,
      status: 'COMPLETED'
    };
  } catch (error) {
    return {
      classifications: [],
      status: 'FAILED',
      message: `Classification failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}
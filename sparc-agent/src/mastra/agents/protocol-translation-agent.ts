
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { z } from 'zod';

/**
 * Protocol formats supported by the translation service
 */
export const SUPPORTED_PROTOCOLS = [
  'ANS', // Agent Name Service format
  'MASTRA', // Mastra.ai internal format
  'MCP', // Management Control Panel format
  'JSON-LD', // JSON-LD standard format
  'OCI', // Open Container Initiative format
  'W3C-AGENT', // W3C Agent format
  'RAG', // Retrieval-Augmented Generation format
  'CUSTOM', // Custom format (requires template)
];

/**
 * Protocol Translation Agent
 * 
 * This agent handles protocol translation between different agent data formats.
 * It analyzes the source protocol, maps between protocols, validates the translated data,
 * and enhances translations with AI for complex cases.
 */
export const protocolTranslationAgent = new Agent({
  name: 'Protocol Translation Agent',
  model: openai('gpt-4o'),
  instructions: `
    You are a protocol translation specialist for agent data formats.
    Your task is to analyze agent data formats and translate between different protocol formats.
    
    For each translation, you should:
    1. Analyze the source protocol structure and identify all key elements
    2. Map these elements to the target protocol's schema
    3. Preserve semantic meaning during translation
    4. Maintain metadata integrity as requested
    5. Validate the output against the target schema
    
    Supported protocols:
    - ANS: Agent Name Service format
    - MASTRA: Mastra.ai internal format
    - MCP: Management Control Panel format
    - JSON-LD: JSON-LD standard format
    - OCI: Open Container Initiative format
    - W3C-AGENT: W3C Agent format
    - RAG: Retrieval-Augmented Generation format
    - CUSTOM: Custom format (requires template)
    
    You must return a valid JSON object with these fields:
    {
      "sourceProtocol": "the original protocol format",
      "targetProtocol": "the target protocol format",
      "sourceData": "the original data object",
      "translatedData": "the translated data in target format",
      "translationStatus": "SUCCESSFUL" | "PARTIAL" | "FAILED",
      "preservedMetadata": boolean,
      "validationResult": {
        "valid": boolean,
        "issues": ["array of validation issues if any"]
      },
      "warnings": ["array of warnings about data loss or incomplete mappings if any"],
      "ai_enhanced": boolean
    }
    
    Your entire response must be valid, parseable JSON with no other text.
  `
});

/**
 * Schema for protocol translation request data
 */
export const protocolTranslationRequestSchema = z.object({
  sourceProtocol: z.string().describe('The source protocol format'),
  targetProtocol: z.string().describe('The target protocol format'),
  agentData: z.any().describe('The agent data to translate'),
  preserveMetadata: z.boolean().default(true).describe('Whether to preserve metadata during translation'),
  validationLevel: z.enum(['NONE', 'BASIC', 'STRICT']).default('BASIC').describe('Validation level for the translated data'),
});

/**
 * Sample protocol schemas for common formats
 * These represent the key fields and structure of each protocol
 */
const protocolSchemas = {
  ANS: {
    name: { type: 'string', required: true },
    certificate: { type: 'object', required: true },
    metadata: { type: 'object', required: true },
    registeredAt: { type: 'string', required: true },
  },
  MASTRA: {
    agentId: { type: 'string', required: true },
    name: { type: 'string', required: true },
    capabilities: { type: 'array', required: true },
    securityProfile: { type: 'object', required: false },
    version: { type: 'string', required: false },
  },
  MCP: {
    id: { type: 'string', required: true },
    name: { type: 'string', required: true },
    endpoints: { type: 'array', required: true },
    permissions: { type: 'object', required: true },
    version: { type: 'string', required: false },
  },
  'JSON-LD': {
    '@context': { type: 'string', required: true },
    '@id': { type: 'string', required: true },
    '@type': { type: 'string', required: true },
    name: { type: 'string', required: true },
  },
  OCI: {
    schemaVersion: { type: 'number', required: true },
    name: { type: 'string', required: true },
    annotations: { type: 'object', required: false },
    version: { type: 'string', required: false },
  },
  'W3C-AGENT': {
    id: { type: 'string', required: true },
    name: { type: 'string', required: true },
    type: { type: 'string', required: true },
    capabilities: { type: 'array', required: false },
  },
  RAG: {
    id: { type: 'string', required: true },
    name: { type: 'string', required: true },
    context: { type: 'array', required: true },
    metadata: { type: 'object', required: false },
  },
  CUSTOM: {
    template: { type: 'object', required: true },
    data: { type: 'object', required: true },
  },
};

/**
 * Processes a complete protocol translation workflow
 * 
 * This function handles the entire protocol translation workflow:
 * 1. Analyzing the source protocol
 * 2. Mapping between protocols
 * 3. Validating translated data
 * 4. Enhancing translation with AI when needed
 * 
 * @param translationData The protocol translation request data
 * @returns A complete translation result object
 */
export async function processProtocolTranslation(translationData: z.infer<typeof protocolTranslationRequestSchema>) {
  try {
    // Validate protocols are supported
    if (!SUPPORTED_PROTOCOLS.includes(translationData.sourceProtocol)) {
      return {
        sourceProtocol: translationData.sourceProtocol,
        targetProtocol: translationData.targetProtocol,
        sourceData: translationData.agentData,
        translatedData: null,
        translationStatus: 'FAILED',
        preservedMetadata: translationData.preserveMetadata,
        validationResult: {
          valid: false,
          issues: [`Source protocol '${translationData.sourceProtocol}' not supported`]
        },
        warnings: [],
        ai_enhanced: false
      };
    }

    if (!SUPPORTED_PROTOCOLS.includes(translationData.targetProtocol)) {
      return {
        sourceProtocol: translationData.sourceProtocol,
        targetProtocol: translationData.targetProtocol,
        sourceData: translationData.agentData,
        translatedData: null,
        translationStatus: 'FAILED',
        preservedMetadata: translationData.preserveMetadata,
        validationResult: {
          valid: false,
          issues: [`Target protocol '${translationData.targetProtocol}' not supported`]
        },
        warnings: [],
        ai_enhanced: false
      };
    }

    // Call the translation agent
    const response = await protocolTranslationAgent.stream([
      {
        role: 'user',
        content: `
          Translate this agent data from ${translationData.sourceProtocol} format to ${translationData.targetProtocol} format.
          Preserve metadata: ${translationData.preserveMetadata ? 'yes' : 'no'}
          Validation level: ${translationData.validationLevel}
          
          Source data (${translationData.sourceProtocol}):
          ${JSON.stringify(translationData.agentData, null, 2)}
          
          Please provide a valid JSON response with the translation result.
        `
      }
    ]);
    
    // Collect the streamed response
    let resultText = '';
    for await (const chunk of response.textStream) {
      resultText += chunk;
    }
    
    // Parse and return the result
    try {
      const result = JSON.parse(resultText);
      return result;
    } catch (parseError) {
      // Handle parsing errors
      return {
        sourceProtocol: translationData.sourceProtocol,
        targetProtocol: translationData.targetProtocol,
        sourceData: translationData.agentData,
        translatedData: null,
        translationStatus: 'FAILED',
        preservedMetadata: translationData.preserveMetadata,
        validationResult: {
          valid: false,
          issues: [`Failed to parse translation result: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`]
        },
        warnings: [],
        ai_enhanced: false
      };
    }
  } catch (error) {
    // Handle unexpected errors
    return {
      sourceProtocol: translationData.sourceProtocol,
      targetProtocol: translationData.targetProtocol,
      sourceData: translationData.agentData,
      translatedData: null,
      translationStatus: 'FAILED',
      preservedMetadata: translationData.preserveMetadata,
      validationResult: {
        valid: false,
        issues: [`Translation process error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      },
      warnings: [],
      ai_enhanced: false
    };
  }
}

/**
 * Validates data against a protocol schema
 * 
 * @param data The data to validate
 * @param protocol The protocol to validate against
 * @param level The validation level (NONE, BASIC, or STRICT)
 * @returns Validation result with validity status and issues
 */
export function validateProtocolData(data: any, protocol: string, level: 'NONE' | 'BASIC' | 'STRICT' = 'BASIC') {
  // Skip validation if level is NONE
  if (level === 'NONE') {
    return { valid: true, issues: [] };
  }
  
  // Get the schema for the protocol
  const schema = protocolSchemas[protocol as keyof typeof protocolSchemas];
  if (!schema) {
    return { 
      valid: false, 
      issues: [`No schema available for protocol: ${protocol}`] 
    };
  }
  
  const issues: string[] = [];
  
  // For BASIC and STRICT validation, check required fields
  for (const [field, spec] of Object.entries(schema)) {
    if (spec.required && (!data || data[field] === undefined)) {
      issues.push(`Required field '${field}' is missing`);
    }
  }
  
  // For STRICT validation, also check types
  if (level === 'STRICT' && data) {
    for (const [field, spec] of Object.entries(schema)) {
      if (data[field] !== undefined) {
        const fieldType = (spec as any).type;
        
        if (fieldType === 'string' && typeof data[field] !== 'string') {
          issues.push(`Field '${field}' should be a string`);
        } else if (fieldType === 'number' && typeof data[field] !== 'number') {
          issues.push(`Field '${field}' should be a number`);
        } else if (fieldType === 'object' && (typeof data[field] !== 'object' || Array.isArray(data[field]))) {
          issues.push(`Field '${field}' should be an object`);
        } else if (fieldType === 'array' && !Array.isArray(data[field])) {
          issues.push(`Field '${field}' should be an array`);
        }
      }
    }
  }
  
  return { valid: issues.length === 0, issues };
}
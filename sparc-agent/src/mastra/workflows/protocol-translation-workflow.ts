import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

// Define the schema for protocol translation
const protocolTranslationSchema = z.object({
  sourceProtocol: z.string().describe('The source protocol format'),
  targetProtocol: z.string().describe('The target protocol format'),
  agentData: z.any().describe('The agent data to translate'),
  preserveMetadata: z.boolean().default(true).describe('Whether to preserve metadata during translation'),
  validationLevel: z.enum(['NONE', 'BASIC', 'STRICT']).default('BASIC').describe('Validation level for the translated data'),
});

// Protocol formats supported
const SUPPORTED_PROTOCOLS = [
  'ANS', // Agent Name Service format
  'MASTRA', // Mastra.ai internal format
  'MCP', // Management Control Panel format
  'JSON-LD', // JSON-LD standard format
  'OCI', // Open Container Initiative format
  'W3C-AGENT', // W3C Agent format
  'RAG', // Retrieval-Augmented Generation format
  'CUSTOM', // Custom format (requires template)
];

// Create an AI agent for protocol translation assistance
const translationAgent = new Agent({
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
    
    Respond with:
    - A complete, valid representation in the target format
    - Any warnings about data loss or field mappings that aren't one-to-one
    - Validation information including any schema or constraint violations
    
    Keep your response focused on the technical translation without adding opinions.
  `,
});

// Step 1: Analyze Source Protocol
const analyzeSourceProtocol = new Step({
  id: 'analyze-source-protocol',
  description: 'Analyzes the source protocol format and validates the input data',
  inputSchema: protocolTranslationSchema,
  outputSchema: z.object({
    sourceProtocol: z.string(),
    targetProtocol: z.string(),
    agentData: z.any(),
    sourceSchema: z.record(z.any()),
    sourceValid: z.boolean(),
    preserveMetadata: z.boolean(),
    validationLevel: z.string(),
    analysisStatus: z.string(),
    issues: z.array(z.string()),
  }),
  execute: async ({ context }) => {
    // Get trigger data
    const translationData = context.getStepResult('trigger');
    
    if (!translationData) {
      throw new Error('Translation data not found in trigger');
    }
    
    // Extract data
    const { sourceProtocol, targetProtocol, agentData, preserveMetadata, validationLevel } = translationData;
    
    // Initialize analysis result
    const analysisResult = {
      sourceProtocol,
      targetProtocol,
      agentData,
      sourceSchema: {} as Record<string, any>,
      sourceValid: false,
      preserveMetadata,
      validationLevel,
      analysisStatus: 'PENDING',
      issues: [] as string[],
    };
    
    try {
      // Validate that protocols are supported
      if (!SUPPORTED_PROTOCOLS.includes(sourceProtocol)) {
        analysisResult.issues.push(`Source protocol '${sourceProtocol}' not supported`);
        analysisResult.analysisStatus = 'FAILED';
        return analysisResult;
      }
      
      if (!SUPPORTED_PROTOCOLS.includes(targetProtocol)) {
        analysisResult.issues.push(`Target protocol '${targetProtocol}' not supported`);
        analysisResult.analysisStatus = 'FAILED';
        return analysisResult;
      }
      
      if (sourceProtocol === targetProtocol) {
        analysisResult.issues.push('Source and target protocols are the same, no translation needed');
        // We'll still continue with the process as it could be a format validation
      }
      
      // Basic validation of agent data
      if (!agentData) {
        analysisResult.issues.push('Agent data is empty or null');
        analysisResult.analysisStatus = 'FAILED';
        return analysisResult;
      }
      
      // Get the schema for the source protocol
      analysisResult.sourceSchema = getProtocolSchema(sourceProtocol);
      
      // Validate the agent data against the source schema
      const validationResult = validateAgainstSchema(agentData, analysisResult.sourceSchema, validationLevel);
      analysisResult.sourceValid = validationResult.valid;
      
      if (!validationResult.valid) {
        analysisResult.issues.push(...validationResult.issues);
        
        // For strict validation, fail if source is invalid
        if (validationLevel === 'STRICT') {
          analysisResult.analysisStatus = 'FAILED';
          return analysisResult;
        }
        // For other validation levels, continue with warnings
      }
      
      analysisResult.analysisStatus = 'COMPLETED';
      return analysisResult;
    } catch (error) {
      analysisResult.analysisStatus = 'FAILED';
      analysisResult.issues.push(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return analysisResult;
    }
  },
});

// Step 2: Map Between Protocols
const mapBetweenProtocols = new Step({
  id: 'map-between-protocols',
  description: 'Maps data between source and target protocol formats',
  execute: async ({ context }) => {
    // Get analysis result
    const analysisResult = context.getStepResult(analyzeSourceProtocol);
    
    if (!analysisResult) {
      throw new Error('Protocol analysis result not found');
    }
    
    // Cast to expected type
    const typedAnalysisResult = analysisResult as {
      sourceProtocol: string;
      targetProtocol: string;
      agentData: any;
      sourceSchema: Record<string, any>;
      sourceValid: boolean;
      preserveMetadata: boolean;
      validationLevel: string;
      analysisStatus: string;
      issues: string[];
    };
    
    // Extract key information
    const { 
      sourceProtocol, 
      targetProtocol, 
      agentData, 
      sourceValid, 
      preserveMetadata,
      issues 
    } = typedAnalysisResult;
    
    // Initialize mapping result
    const mappingResult = {
      sourceProtocol,
      targetProtocol,
      preserveMetadata,
      sourceData: agentData,
      targetData: null as any,
      targetSchema: {} as Record<string, any>,
      mappingStatus: 'PENDING',
      mappingWarnings: [] as string[],
      issues: [...issues],
    };
    
    // Skip mapping if analysis failed
    if (typedAnalysisResult.analysisStatus === 'FAILED') {
      mappingResult.mappingStatus = 'SKIPPED';
      mappingResult.issues.push('Mapping skipped due to failed analysis');
      return mappingResult;
    }
    
    try {
      // Get the schema for the target protocol
      mappingResult.targetSchema = getProtocolSchema(targetProtocol);
      
      // If source and target are the same, just pass through the data
      if (sourceProtocol === targetProtocol) {
        mappingResult.targetData = agentData;
        mappingResult.mappingStatus = 'COMPLETED';
        mappingResult.mappingWarnings.push('Source and target protocols are identical, data passed through with no changes');
        return mappingResult;
      }
      
      // Use the appropriate mapping function based on source and target
      mappingResult.targetData = translateProtocol(
        agentData,
        sourceProtocol,
        targetProtocol,
        preserveMetadata
      );
      
      // If mapping failed, throw an error
      if (!mappingResult.targetData) {
        throw new Error(`Failed to map from ${sourceProtocol} to ${targetProtocol}`);
      }
      
      mappingResult.mappingStatus = 'COMPLETED';
      return mappingResult;
    } catch (error) {
      mappingResult.mappingStatus = 'FAILED';
      mappingResult.issues.push(`Mapping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return mappingResult;
    }
  },
});

// Step 3: Validate Translated Data
const validateTranslatedData = new Step({
  id: 'validate-translated-data',
  description: 'Validates the translated data against the target protocol schema',
  execute: async ({ context }) => {
    // Get mapping result
    const mappingResult = context.getStepResult(mapBetweenProtocols);
    
    if (!mappingResult) {
      throw new Error('Protocol mapping result not found');
    }
    
    // Get original trigger data for validation level
    const triggerData = context.getStepResult('trigger') as {
      validationLevel: 'NONE' | 'BASIC' | 'STRICT';
    };
    
    // Cast to expected type
    const typedMappingResult = mappingResult as {
      sourceProtocol: string;
      targetProtocol: string;
      targetData: any;
      targetSchema: Record<string, any>;
      mappingStatus: string;
      mappingWarnings: string[];
      issues: string[];
    };
    
    // Extract key information
    const { 
      sourceProtocol, 
      targetProtocol, 
      targetData, 
      targetSchema, 
      mappingStatus, 
      mappingWarnings, 
      issues 
    } = typedMappingResult;
    const validationLevel = triggerData?.validationLevel || 'BASIC';
    
    // Initialize validation result
    const validationResult = {
      sourceProtocol,
      targetProtocol,
      targetData,
      validationLevel,
      validationPassed: false,
      validationWarnings: [...mappingWarnings],
      validationStatus: 'PENDING',
      issues: [...issues],
    };
    
    // Skip validation if mapping failed or validation is set to NONE
    if (mappingStatus !== 'COMPLETED') {
      validationResult.validationStatus = 'SKIPPED';
      validationResult.issues.push('Validation skipped due to failed mapping');
      return validationResult;
    }
    
    if (validationLevel === 'NONE') {
      validationResult.validationStatus = 'SKIPPED';
      validationResult.validationPassed = true; // Assume passed since we're skipping validation
      validationResult.validationWarnings.push('Validation skipped as requested (validationLevel=NONE)');
      return validationResult;
    }
    
    try {
      // Validate against the target schema
      const schemaValidation = validateAgainstSchema(targetData, targetSchema, validationLevel);
      validationResult.validationPassed = schemaValidation.valid;
      
      if (!schemaValidation.valid) {
        validationResult.issues.push(...schemaValidation.issues);
      }
      
      // For STRICT validation, also verify data integrity
      if (validationLevel === 'STRICT') {
        const integrityCheck = verifyDataIntegrity(targetData, targetProtocol);
        if (!integrityCheck.valid) {
          validationResult.validationPassed = false;
          validationResult.issues.push(...integrityCheck.issues);
        }
      }
      
      validationResult.validationStatus = 'COMPLETED';
      return validationResult;
    } catch (error) {
      validationResult.validationStatus = 'FAILED';
      validationResult.issues.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return validationResult;
    }
  },
});

// Step 4: Enhance Translation with AI (for complex cases)
const enhanceTranslation = new Step({
  id: 'enhance-translation',
  description: 'Uses AI to enhance translation for complex cases or when validation fails',
  execute: async ({ context }) => {
    // Get validation result
    const validationResult = context.getStepResult(validateTranslatedData);
    
    if (!validationResult) {
      throw new Error('Validation result not found');
    }
    
    // Cast to expected type
    const typedValidationResult = validationResult as {
      sourceProtocol: string;
      targetProtocol: string;
      targetData: any;
      validationPassed: boolean;
      validationStatus: string;
      issues: string[];
    };
    
    // Get original trigger data
    const triggerData = context.getStepResult('trigger') as {
      agentData: any;
      sourceProtocol: string;
      targetProtocol: string;
    };
    
    // Extract key information
    const { 
      sourceProtocol, 
      targetProtocol, 
      targetData, 
      validationPassed, 
      validationStatus, 
      issues 
    } = typedValidationResult;
    
    // Initialize enhancement result
    const enhancementResult = {
      sourceProtocol,
      targetProtocol,
      originalTranslation: targetData,
      enhancedTranslation: targetData, // Default to original if no enhancement needed
      aiAssisted: false,
      enhancementStatus: 'PENDING',
      issues: [...issues],
    };
    
    // Skip enhancement if validation passed or failed for reasons other than schema validation
    if (validationPassed || validationStatus !== 'COMPLETED') {
      enhancementResult.enhancementStatus = 'SKIPPED';
      return enhancementResult;
    }
    
    try {
      // Only try AI enhancement if validation failed but result exists
      if (!validationPassed && targetData) {
        // Prepare data for AI enhancement
        const sourceData = triggerData?.agentData || {};
        
        // Call the AI agent to enhance the translation
        const response = await translationAgent.stream([
          {
            role: 'user',
            content: `
              Translate the following agent data from ${sourceProtocol} format to ${targetProtocol} format.
              
              Source data (${sourceProtocol}):
              ${JSON.stringify(sourceData, null, 2)}
              
              Initial translation attempt (${targetProtocol}) that failed validation:
              ${JSON.stringify(targetData, null, 2)}
              
              Validation issues:
              ${issues.join('\n')}
              
              Please provide a corrected translation that will pass validation.
            `,
          }
        ]);
        
        // Collect the streamed response
        let enhancementText = '';
        for await (const chunk of response.textStream) {
          enhancementText += chunk;
        }
        
        // Extract the translated data from the response
        try {
          // Look for JSON code block in the response
          const jsonMatch = enhancementText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (jsonMatch && jsonMatch[1]) {
            const extractedJson = jsonMatch[1].trim();
            enhancementResult.enhancedTranslation = JSON.parse(extractedJson);
            enhancementResult.aiAssisted = true;
          } else {
            // Try to parse the whole response as JSON
            enhancementResult.enhancedTranslation = JSON.parse(enhancementText);
            enhancementResult.aiAssisted = true;
          }
        } catch (parseError) {
          // If parsing fails, keep the original translation and add a warning
          enhancementResult.issues.push(`Failed to parse AI-enhanced translation: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }
      }
      
      enhancementResult.enhancementStatus = 'COMPLETED';
      return enhancementResult;
    } catch (error) {
      enhancementResult.enhancementStatus = 'FAILED';
      enhancementResult.issues.push(`Enhancement failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return enhancementResult;
    }
  },
});

// Helper function to get the schema for a protocol
function getProtocolSchema(protocol: string): Record<string, any> {
  // In a real implementation, this would return the actual schema for each protocol
  // This is a simplified mock implementation
  
  const commonFields = {
    name: { type: 'string', required: true },
    version: { type: 'string', required: false },
  };
  
  switch (protocol) {
    case 'ANS':
      return {
        ...commonFields,
        certificate: { type: 'object', required: true },
        metadata: { type: 'object', required: true },
        registeredAt: { type: 'string', required: true },
      };
    case 'MASTRA':
      return {
        ...commonFields,
        agentId: { type: 'string', required: true },
        capabilities: { type: 'array', required: true },
        securityProfile: { type: 'object', required: false },
      };
    case 'MCP':
      return {
        ...commonFields,
        id: { type: 'string', required: true },
        endpoints: { type: 'array', required: true },
        permissions: { type: 'object', required: true },
      };
    case 'JSON-LD':
      return {
        ...commonFields,
        '@context': { type: 'string', required: true },
        '@id': { type: 'string', required: true },
        '@type': { type: 'string', required: true },
      };
    default:
      return commonFields;
  }
}

// Helper function to validate data against a schema
function validateAgainstSchema(
  data: any, 
  schema: Record<string, any>, 
  validationLevel: string
): { valid: boolean; issues: string[] } {
  // In a real implementation, this would perform proper schema validation
  // This is a simplified mock implementation
  
  const issues: string[] = [];
  
  // For NONE validation, always return valid
  if (validationLevel === 'NONE') {
    return { valid: true, issues: [] };
  }
  
  // Basic validation checks if required fields are present
  for (const [field, specs] of Object.entries(schema)) {
    if ((specs as any).required && (!data || data[field] === undefined)) {
      issues.push(`Required field '${field}' is missing`);
    }
  }
  
  // For STRICT validation, also check types and constraints
  if (validationLevel === 'STRICT') {
    for (const [field, specs] of Object.entries(schema)) {
      if (data && data[field] !== undefined) {
        const fieldType = (specs as any).type;
        
        // Check type
        if (fieldType === 'string' && typeof data[field] !== 'string') {
          issues.push(`Field '${field}' should be a string`);
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

// Helper function to verify data integrity
function verifyDataIntegrity(
  data: any, 
  protocol: string
): { valid: boolean; issues: string[] } {
  // In a real implementation, this would perform more advanced integrity checks
  // This is a simplified mock implementation
  
  const issues: string[] = [];
  
  // Check for null or undefined data
  if (!data) {
    issues.push('Data is null or undefined');
    return { valid: false, issues };
  }
  
  // Basic sanity checks based on protocol
  switch (protocol) {
    case 'ANS':
      // Check certificate validity
      if (!data.certificate || !data.certificate.validTo) {
        issues.push('Missing or invalid certificate');
      }
      break;
    case 'MASTRA':
      // Check capabilities
      if (!Array.isArray(data.capabilities) || data.capabilities.length === 0) {
        issues.push('Agent must have at least one capability defined');
      }
      break;
    case 'MCP':
      // Check endpoints
      if (!Array.isArray(data.endpoints) || data.endpoints.length === 0) {
        issues.push('Agent must have at least one endpoint defined');
      }
      break;
    case 'JSON-LD':
      // Check context
      if (!data['@context']) {
        issues.push('JSON-LD data must have a @context');
      }
      break;
  }
  
  return { valid: issues.length === 0, issues };
}

// Helper function to translate between protocols
function translateProtocol(
  data: any, 
  sourceProtocol: string, 
  targetProtocol: string,
  preserveMetadata: boolean
): any {
  // In a real implementation, this would perform proper translation logic
  // This is a simplified mock implementation
  
  // Simple case: if source and target are the same, just return the data
  if (sourceProtocol === targetProtocol) {
    return data;
  }
  
  // Create a new object for the translated data
  const translated: Record<string, any> = {};
  
  // Copy common fields
  if (data.name) translated.name = data.name;
  if (data.version) translated.version = data.version;
  if (preserveMetadata && data.metadata) translated.metadata = { ...data.metadata };
  
  // Perform protocol-specific translations
  if (sourceProtocol === 'ANS' && targetProtocol === 'MASTRA') {
    translated.agentId = data.name;
    translated.capabilities = (data.metadata && data.metadata.capabilities) || [];
    translated.securityProfile = {
      certificateInfo: data.certificate ? {
        issuer: data.certificate.issuer,
        validFrom: data.certificate.validFrom,
        validTo: data.certificate.validTo,
      } : undefined,
    };
  } else if (sourceProtocol === 'ANS' && targetProtocol === 'MCP') {
    translated.id = data.name;
    translated.endpoints = [];
    translated.permissions = { level: 'standard' };
    if (data.certificate) {
      translated.authentication = {
        type: 'certificate',
        details: {
          fingerprint: data.certificate.fingerprint,
          expiry: data.certificate.validTo,
        },
      };
    }
  } else if (sourceProtocol === 'ANS' && targetProtocol === 'JSON-LD') {
    translated['@context'] = 'https://schema.org/';
    translated['@id'] = `urn:agent:${data.name}`;
    translated['@type'] = 'Service';
    translated.name = data.name;
    translated.description = data.metadata?.description || '';
  } else if (sourceProtocol === 'MASTRA' && targetProtocol === 'ANS') {
    translated.name = data.agentId || data.name;
    translated.certificate = {
      status: 'VALID',
      validFrom: new Date().toISOString(),
      validTo: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    };
    translated.metadata = {
      capabilities: data.capabilities || [],
    };
    translated.registeredAt = new Date().toISOString();
  } else {
    // For other combinations, implement a basic mapping
    // In a real system, this would be more sophisticated
    translated.name = data.name || data.agentId || data.id || data['@id'] || 'unknown';
    translated.translated = true;
    translated.sourceProtocol = sourceProtocol;
    translated.conversionNote = `Converted from ${sourceProtocol} to ${targetProtocol}`;
  }
  
  return translated;
}

// Create the protocol translation workflow
const protocolTranslationWorkflow = new Workflow({
  name: 'protocol-translation-workflow',
  triggerSchema: protocolTranslationSchema,
})
  .step(analyzeSourceProtocol)
  .then(mapBetweenProtocols)
  .then(validateTranslatedData)
  .then(enhanceTranslation);

// Commit the workflow to make it active
protocolTranslationWorkflow.commit();

// Export the workflow
export { protocolTranslationWorkflow };
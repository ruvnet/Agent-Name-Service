import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

// Define the schema for agent capability discovery
const capabilityDiscoverySchema = z.object({
  agentIdentifier: z.string().describe('The agent identifier (name or ID) to discover capabilities for'),
  discoveryMode: z.enum(['STATIC', 'DYNAMIC', 'COMPREHENSIVE']).default('STATIC').describe('The mode of capability discovery'),
  includeInactive: z.boolean().default(false).describe('Whether to include inactive capabilities'),
  maxCapabilities: z.number().optional().describe('Maximum number of capabilities to discover'),
  classifyCapabilities: z.boolean().default(true).describe('Whether to classify capabilities into categories'),
});

// Define capability categories
const CAPABILITY_CATEGORIES = [
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

// Create an AI agent for capability classification
const classificationAgent = new Agent({
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
  `,
});

// Step 1: Fetch Agent Information
const fetchAgentInformation = new Step({
  id: 'fetch-agent-information',
  description: 'Fetches basic information about the agent',
  inputSchema: capabilityDiscoverySchema,
  outputSchema: z.object({
    agentIdentifier: z.string(),
    agentName: z.string().nullable(),
    agentFound: z.boolean(),
    metadata: z.record(z.any()).nullable(),
    registrationInfo: z.record(z.any()).nullable(),
    discoveryMode: z.string(),
    fetchStatus: z.string(),
    issues: z.array(z.string()),
  }),
  execute: async ({ context }) => {
    // Get trigger data
    const discoveryData = context.getStepResult('trigger');
    
    if (!discoveryData) {
      throw new Error('Discovery data not found in trigger');
    }
    
    // Extract data
    const { agentIdentifier, discoveryMode, includeInactive } = discoveryData;
    
    // Initialize fetch result
    const fetchResult = {
      agentIdentifier,
      agentName: null as string | null,
      agentFound: false,
      metadata: null as Record<string, any> | null,
      registrationInfo: null as Record<string, any> | null,
      discoveryMode,
      fetchStatus: 'PENDING',
      issues: [] as string[],
    };
    
    try {
      // Validate agent identifier
      if (!agentIdentifier || typeof agentIdentifier !== 'string' || agentIdentifier.length < 3) {
        fetchResult.issues.push('Invalid agent identifier: must be a string with at least 3 characters');
        fetchResult.fetchStatus = 'FAILED';
        return fetchResult;
      }
      
      // In a real implementation, this would query the agent database
      // This is a simplified mock implementation
      
      // Simulate looking up the agent
      // For this example, we'll assume we found an agent if the identifier has a valid format
      if (/^[a-zA-Z0-9._-]+$/.test(agentIdentifier)) {
        fetchResult.agentFound = true;
        fetchResult.agentName = agentIdentifier;
        
        // Mock metadata and registration info
        fetchResult.metadata = {
          description: `Agent ${agentIdentifier} for capability discovery`,
          version: '1.0.0',
          capabilities: ['data-access', 'file-read', 'network-fetch', 'compute'],
          provider: 'Test Provider',
        };
        
        fetchResult.registrationInfo = {
          registeredAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days ago
          lastUpdated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
          status: 'ACTIVE',
        };
      } else {
        fetchResult.issues.push(`Agent not found with identifier: ${agentIdentifier}`);
      }
      
      fetchResult.fetchStatus = 'COMPLETED';
      return fetchResult;
    } catch (error) {
      fetchResult.fetchStatus = 'FAILED';
      fetchResult.issues.push(`Agent information fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return fetchResult;
    }
  },
});

// Step 2: Discover Static Capabilities
const discoverStaticCapabilities = new Step({
  id: 'discover-static-capabilities',
  description: 'Discovers static capabilities from agent metadata',
  execute: async ({ context }) => {
    // Get fetch result
    const fetchResult = context.getStepResult(fetchAgentInformation);
    
    if (!fetchResult) {
      throw new Error('Agent information not found');
    }
    
    // Cast to expected type
    const typedFetchResult = fetchResult as {
      agentIdentifier: string;
      agentName: string | null;
      agentFound: boolean;
      metadata: Record<string, any> | null;
      discoveryMode: string;
      issues: string[];
    };
    
    // Get original trigger data for additional settings
    const triggerData = context.getStepResult('trigger') as {
      includeInactive: boolean;
      maxCapabilities: number | undefined;
    };
    
    // Extract key information
    const { 
      agentIdentifier, 
      agentName, 
      agentFound, 
      metadata, 
      discoveryMode, 
      issues 
    } = typedFetchResult;
    const includeInactive = triggerData?.includeInactive === true;
    const maxCapabilities = triggerData?.maxCapabilities;
    
    // Initialize discovery result
    const discoveryResult = {
      agentIdentifier,
      agentName: agentName || agentIdentifier,
      discoveryMode,
      staticCapabilities: [] as any[],
      capabilityCount: 0,
      discoveryStatus: 'PENDING',
      issues: [...issues],
    };
    
    // Skip discovery if agent not found
    if (!agentFound) {
      discoveryResult.discoveryStatus = 'SKIPPED';
      discoveryResult.issues.push('Static capability discovery skipped: agent not found');
      return discoveryResult;
    }
    
    try {
      // Extract capabilities from metadata
      if (metadata && metadata.capabilities && Array.isArray(metadata.capabilities)) {
        let capabilities = metadata.capabilities.map(cap => {
          if (typeof cap === 'string') {
            // Convert simple string capabilities to objects with additional information
            return {
              name: cap,
              type: 'STATIC',
              description: `Capability: ${cap}`,
              status: 'ACTIVE',
              source: 'METADATA',
            };
          } else if (typeof cap === 'object' && cap !== null) {
            // Pass through capability objects that are already well-formed
            return {
              ...cap,
              type: 'STATIC',
              source: 'METADATA',
              status: cap.status || 'ACTIVE',
            };
          }
          return null;
        }).filter(cap => cap !== null);
        
        // Filter out inactive capabilities if not requested
        if (!includeInactive) {
          capabilities = capabilities.filter(cap => cap.status === 'ACTIVE');
        }
        
        // Limit the number of capabilities if requested
        if (maxCapabilities && maxCapabilities > 0 && capabilities.length > maxCapabilities) {
          capabilities = capabilities.slice(0, maxCapabilities);
          discoveryResult.issues.push(`Limited capabilities to ${maxCapabilities} as requested`);
        }
        
        discoveryResult.staticCapabilities = capabilities;
        discoveryResult.capabilityCount = capabilities.length;
      } else {
        discoveryResult.issues.push('No capabilities found in agent metadata');
      }
      
      discoveryResult.discoveryStatus = 'COMPLETED';
      return discoveryResult;
    } catch (error) {
      discoveryResult.discoveryStatus = 'FAILED';
      discoveryResult.issues.push(`Static capability discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return discoveryResult;
    }
  },
});

// Step 3: Discover Dynamic Capabilities
const discoverDynamicCapabilities = new Step({
  id: 'discover-dynamic-capabilities',
  description: 'Discovers dynamic capabilities by probing the agent',
  execute: async ({ context }) => {
    // Get static discovery result
    const staticResult = context.getStepResult(discoverStaticCapabilities);
    
    if (!staticResult) {
      throw new Error('Static capability discovery result not found');
    }
    
    // Get fetch result for agent info
    const fetchResult = context.getStepResult(fetchAgentInformation);
    
    // Cast to expected types
    const typedStaticResult = staticResult as {
      agentIdentifier: string;
      agentName: string;
      discoveryMode: string;
      staticCapabilities: any[];
      capabilityCount: number;
      issues: string[];
    };
    
    const typedFetchResult = fetchResult as {
      agentFound: boolean;
      metadata: Record<string, any> | null;
    };
    
    // Get original trigger data for additional settings
    const triggerData = context.getStepResult('trigger') as {
      discoveryMode: string;
      maxCapabilities: number | undefined;
    };
    
    // Extract key information
    const { 
      agentIdentifier, 
      agentName, 
      staticCapabilities, 
      issues 
    } = typedStaticResult;
    const discoveryMode = triggerData?.discoveryMode || 'STATIC';
    
    // Initialize dynamic discovery result
    const dynamicResult = {
      agentIdentifier,
      agentName,
      discoveryMode,
      staticCapabilities,
      dynamicCapabilities: [] as any[],
      combinedCapabilities: [] as any[],
      capabilityCount: staticCapabilities.length,
      discoveryStatus: 'PENDING',
      issues: [...issues],
    };
    
    // Skip dynamic discovery if not requested or if agent not found
    if (discoveryMode === 'STATIC' || !typedFetchResult.agentFound) {
      dynamicResult.discoveryStatus = 'SKIPPED';
      dynamicResult.issues.push(`Dynamic capability discovery skipped: ${discoveryMode === 'STATIC' ? 'not requested' : 'agent not found'}`);
      dynamicResult.combinedCapabilities = [...staticCapabilities];
      return dynamicResult;
    }
    
    try {
      // In a real implementation, this would probe the agent for capabilities
      // This is a simplified mock implementation
      
      // Simulate discovering additional capabilities
      const additionalCapabilities = [];
      
      // Add some dynamic capabilities based on the agent metadata
      if (typedFetchResult.metadata) {
        // Check for API endpoints
        if (typedFetchResult.metadata.endpoints) {
          additionalCapabilities.push({
            name: 'api-access',
            type: 'DYNAMIC',
            description: 'API access capability',
            status: 'ACTIVE',
            source: 'PROBE',
            endpoint: typeof typedFetchResult.metadata.endpoints === 'string' ? 
              typedFetchResult.metadata.endpoints : 'default',
          });
        }
        
        // Check for database access
        if (typedFetchResult.metadata.database || typedFetchResult.metadata.storage) {
          additionalCapabilities.push({
            name: 'database-access',
            type: 'DYNAMIC',
            description: 'Database access capability',
            status: 'ACTIVE',
            source: 'PROBE',
          });
        }
        
        // Check for integration capabilities
        if (typedFetchResult.metadata.integrations) {
          additionalCapabilities.push({
            name: 'system-integration',
            type: 'DYNAMIC',
            description: 'System integration capability',
            status: 'ACTIVE',
            source: 'PROBE',
            integrations: typedFetchResult.metadata.integrations,
          });
        }
      }
      
      // Add generic capabilities based on the agent name
      additionalCapabilities.push({
        name: 'runtime-execution',
        type: 'DYNAMIC',
        description: 'Runtime code execution capability',
        status: 'ACTIVE',
        source: 'PROBE',
      });
      
      // Filter out duplicates (capabilities that are already in static capabilities)
      const staticCapabilityNames = staticCapabilities.map(cap => cap.name);
      const uniqueDynamicCapabilities = additionalCapabilities.filter(
        cap => !staticCapabilityNames.includes(cap.name)
      );
      
      dynamicResult.dynamicCapabilities = uniqueDynamicCapabilities;
      dynamicResult.combinedCapabilities = [...staticCapabilities, ...uniqueDynamicCapabilities];
      dynamicResult.capabilityCount = dynamicResult.combinedCapabilities.length;
      
      dynamicResult.discoveryStatus = 'COMPLETED';
      return dynamicResult;
    } catch (error) {
      dynamicResult.discoveryStatus = 'FAILED';
      dynamicResult.issues.push(`Dynamic capability discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      dynamicResult.combinedCapabilities = [...staticCapabilities];
      return dynamicResult;
    }
  },
});

// Step 4: Classify Capabilities
const classifyCapabilities = new Step({
  id: 'classify-capabilities',
  description: 'Classifies discovered capabilities into categories',
  execute: async ({ context }) => {
    // Get dynamic discovery result
    const dynamicResult = context.getStepResult(discoverDynamicCapabilities);
    
    if (!dynamicResult) {
      throw new Error('Dynamic capability discovery result not found');
    }
    
    // Cast to expected type
    const typedDynamicResult = dynamicResult as {
      agentIdentifier: string;
      agentName: string;
      combinedCapabilities: any[];
      capabilityCount: number;
      discoveryStatus: string;
      issues: string[];
    };
    
    // Get original trigger data for classification setting
    const triggerData = context.getStepResult('trigger') as {
      classifyCapabilities: boolean;
    };
    
    // Extract key information
    const { 
      agentIdentifier, 
      agentName, 
      combinedCapabilities, 
      capabilityCount, 
      issues 
    } = typedDynamicResult;
    const shouldClassify = triggerData?.classifyCapabilities !== false; // Default to true if not specified
    
    // Initialize classification result
    const classificationResult = {
      agentIdentifier,
      agentName,
      capabilities: combinedCapabilities,
      capabilityCount,
      categorizedCapabilities: {} as Record<string, any[]>,
      securitySensitiveCapabilities: [] as any[],
      classificationStatus: 'PENDING',
      issues: [...issues],
    };
    
    // Skip classification if not requested or no capabilities found
    if (!shouldClassify) {
      classificationResult.classificationStatus = 'SKIPPED';
      classificationResult.issues.push('Capability classification skipped as requested');
      return classificationResult;
    }
    
    if (capabilityCount === 0) {
      classificationResult.classificationStatus = 'SKIPPED';
      classificationResult.issues.push('No capabilities found to classify');
      return classificationResult;
    }
    
    try {
      // Initialize categories
      CAPABILITY_CATEGORIES.forEach(category => {
        classificationResult.categorizedCapabilities[category] = [];
      });
      
      // For simple capabilities, we'll classify based on name patterns
      // In a real implementation, this would use more sophisticated logic
      const capabilityPatterns = {
        DATA_ACCESS: /(data|access|read|write|fetch|storage|file)/i,
        COMPUTATION: /(compute|calculation|process|execute|runtime)/i,
        COMMUNICATION: /(communication|message|notify|alert|email|sms)/i,
        INTEGRATION: /(integration|connect|api|endpoint)/i,
        SECURITY: /(security|auth|permission|encrypt|decrypt|certificate)/i,
        STORAGE: /(storage|database|persistence|cache)/i,
        ANALYTICS: /(analytics|analyze|report|metrics|statistics)/i,
        AUTOMATION: /(automation|workflow|schedule|trigger|action)/i,
        MONITORING: /(monitor|log|trace|observe|alert)/i,
        SPECIALIZED: /(specialized|custom|specific)/i,
      };
      
      // For more complex cases requiring deeper analysis, we'll use AI
      // Prepare a subset of capabilities for AI classification
      const complexCapabilities = combinedCapabilities.filter(cap => {
        // Consider capabilities complex if they have detailed descriptions or metadata
        return cap.description?.length > 30 || 
               Object.keys(cap).filter(k => !['name', 'type', 'status', 'source'].includes(k)).length > 2;
      });
      
      // Simple pattern-based classification for basic capabilities
      const simpleCapabilities = combinedCapabilities.filter(cap => 
        !complexCapabilities.some(c => c.name === cap.name)
      );
      
      // Classify simple capabilities
      simpleCapabilities.forEach(capability => {
        let matched = false;
        
        // Try to match by name pattern
        for (const [category, pattern] of Object.entries(capabilityPatterns)) {
          if (pattern.test(capability.name)) {
            classificationResult.categorizedCapabilities[category].push(capability);
            matched = true;
            break;
          }
        }
        
        // If no match, put in SPECIALIZED category
        if (!matched) {
          classificationResult.categorizedCapabilities.SPECIALIZED.push(capability);
        }
        
        // Check for security-sensitive capabilities
        if (/admin|root|security|system|execute|permission|privilege/i.test(capability.name)) {
          classificationResult.securitySensitiveCapabilities.push(capability);
        }
      });
      
      // Use AI for complex capabilities if there are any
      if (complexCapabilities.length > 0) {
        // In a real implementation, we would call the AI agent here
        // For this mock, we'll use simplified logic
        
        // Simulate AI classification
        complexCapabilities.forEach(capability => {
          // Assign to most likely category based on capability properties
          let category = 'SPECIALIZED';
          
          if (capability.endpoint || capability.api) {
            category = 'INTEGRATION';
          } else if (capability.database || capability.storage) {
            category = 'STORAGE';
          } else if (capability.security || capability.permission) {
            category = 'SECURITY';
          } else if (capability.analytics || capability.metrics) {
            category = 'ANALYTICS';
          }
          
          classificationResult.categorizedCapabilities[category].push(capability);
          
          // Check for security-sensitive capabilities
          if (category === 'SECURITY' || /admin|root|security|system|execute|permission|privilege/i.test(JSON.stringify(capability))) {
            classificationResult.securitySensitiveCapabilities.push(capability);
          }
        });
      }
      
      classificationResult.classificationStatus = 'COMPLETED';
      return classificationResult;
    } catch (error) {
      classificationResult.classificationStatus = 'FAILED';
      classificationResult.issues.push(`Capability classification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return classificationResult;
    }
  },
});

// Create the agent capability discovery workflow
const agentCapabilityDiscoveryWorkflow = new Workflow({
  name: 'agent-capability-discovery-workflow',
  triggerSchema: capabilityDiscoverySchema,
})
  .step(fetchAgentInformation)
  .then(discoverStaticCapabilities)
  .then(discoverDynamicCapabilities)
  .then(classifyCapabilities);

// Commit the workflow to make it active
agentCapabilityDiscoveryWorkflow.commit();

// Export the workflow
export { agentCapabilityDiscoveryWorkflow };
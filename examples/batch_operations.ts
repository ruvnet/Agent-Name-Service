/**
 * examples/batch_operations.ts
 *
 * This example demonstrates batch operations with ANS,
 * processing multiple agents efficiently.
 * It shows how to:
 * - Register multiple agents in a batch
 * - Filter agents based on security criteria
 * - Resolve multiple agents efficiently
 * - Process agent data in parallel
 *
 * Run with --quiet flag to suppress verbose logging:
 * npx ts-node examples/batch_operations.ts --quiet
 */

import { AgentNamingService } from '../src/ans';
import { suppressVerboseLogging, restoreConsoleLogging } from './utils/quiet-logging';

// Check if quiet mode is enabled via command line argument
const quietMode = process.argv.includes('--quiet');

// Sample agent definitions for batch processing
const agentDefinitions = [
  {
    name: 'data-processor-agent',
    metadata: {
      version: '1.0.0',
      capabilities: ['data-processing', 'etl', 'analytics'],
      description: 'Processes and transforms data from various sources',
      provider: 'DataCorp',
      model: 'data-processor-v1',
      endpoints: [{ protocol: 'https', address: 'api.datacorp.com', port: 443 }]
    }
  },
  {
    name: 'image-generation-agent',
    metadata: {
      version: '2.1.0',
      capabilities: ['image-generation', 'style-transfer', 'upscaling'],
      description: 'Generates and manipulates images based on prompts',
      provider: 'ArtificialVision',
      model: 'image-gen-v2',
      endpoints: [{ protocol: 'https', address: 'api.artificialvision.ai', port: 443 }]
    }
  },
  {
    name: 'nlp-agent',
    metadata: {
      version: '3.0.0',
      capabilities: ['text-generation', 'sentiment-analysis', 'entity-recognition'],
      description: 'Natural language processing for text analysis',
      provider: 'LinguaTech',
      model: 'nlp-transformer-v3',
      endpoints: [{ protocol: 'https', address: 'api.linguatech.com', port: 443 }]
    }
  },
  {
    name: 'security-scanner-agent',
    metadata: {
      version: '1.5.0',
      capabilities: ['vulnerability-scanning', 'threat-detection', 'code-analysis'],
      description: 'Scans systems for security vulnerabilities',
      provider: 'SecureScan',
      model: 'security-scanner-v1.5',
      permissions: ['network-scanning', 'system-analysis'],
      endpoints: [{ protocol: 'https', address: 'api.securescan.io', port: 443 }]
    }
  }
];

// Define types for our results to fix TypeScript errors
interface RegistrationSuccess {
  name: string;
  success: true;
  threatScore: number;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface RegistrationFailure {
  name: string;
  success: false;
  error: string;
}

type RegistrationResult = RegistrationSuccess | RegistrationFailure;

interface ResolutionSuccess {
  name: string;
  found: true;
  dataSize: number;
}

interface ResolutionFailure {
  name: string;
  found: false;
  error?: string;
}

type ResolutionResult = ResolutionSuccess | ResolutionFailure;

async function demonstrateBatchOperations() {
  console.log('=== Batch Operations Example ===\n');
  
  // Apply quiet logging if requested
  if (quietMode) {
    suppressVerboseLogging();
    console.log("Running in quiet mode - verbose logs suppressed\n");
  }
  
  // Initialize the Agent Naming Service
  const ans = new AgentNamingService();
  console.log('Agent Name Service initialized successfully.\n');
  
  // 1. Register multiple agents in a batch
  console.log('Step 1: Registering multiple agents in batch...');
  
  const registrationResults: RegistrationResult[] = [];
  const registrationStartTime = Date.now();
  
  // Register agents sequentially (could be parallelized with Promise.all if needed)
  for (const agent of agentDefinitions) {
    console.log(`  Registering agent: ${agent.name}...`);
    try {
      const result = await ans.registerAgent(agent.name, agent.metadata);
      registrationResults.push({
        name: agent.name,
        success: true,
        threatScore: result.threatReport.threatScore,
        severity: result.threatReport.severity
      });
    } catch (error) {
      // Type guard to ensure error has a message property
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
        
      registrationResults.push({
        name: agent.name,
        success: false,
        error: errorMessage
      });
      console.error(`  Error registering ${agent.name}: ${errorMessage}`);
    }
  }
  
  const registrationTime = Date.now() - registrationStartTime;
  console.log(`Batch registration completed in ${registrationTime}ms.\n`);
  
  // 2. Filter agents based on security criteria
  console.log('Step 2: Filtering agents based on security criteria...');
  
  // Type guard to narrow down the type to RegistrationSuccess
  const isSuccessful = (agent: RegistrationResult): agent is RegistrationSuccess =>
    agent.success === true;
  
  const highRiskAgents = registrationResults
    .filter(isSuccessful)
    .filter(agent => agent.severity === 'HIGH' || agent.severity === 'CRITICAL');
  
  const mediumRiskAgents = registrationResults
    .filter(isSuccessful)
    .filter(agent => agent.severity === 'MEDIUM');
  
  const lowRiskAgents = registrationResults
    .filter(isSuccessful)
    .filter(agent => agent.severity === 'LOW' || agent.severity === 'INFO');
  
  console.log('\n=== Security Risk Assessment ===');
  console.log(`High Risk Agents: ${highRiskAgents.length}`);
  highRiskAgents.forEach(agent =>
    console.log(`  - ${agent.name} (Threat Score: ${agent.threatScore})`));
  
  console.log(`Medium Risk Agents: ${mediumRiskAgents.length}`);
  mediumRiskAgents.forEach(agent =>
    console.log(`  - ${agent.name} (Threat Score: ${agent.threatScore})`));
  
  console.log(`Low Risk Agents: ${lowRiskAgents.length}`);
  lowRiskAgents.forEach(agent =>
    console.log(`  - ${agent.name} (Threat Score: ${agent.threatScore})`));
  
  // 3. Resolve multiple agents
  console.log('\nStep 3: Resolving all registered agents...');
  
  const resolutionStartTime = Date.now();
  const resolutionResults: ResolutionResult[] = [];
  
  for (const agent of registrationResults.filter(isSuccessful)) {
    try {
      const resolvedAgent = await ans.resolveAgent(agent.name);
      if (resolvedAgent) {
        resolutionResults.push({
          name: agent.name,
          found: true,
          dataSize: resolvedAgent.length
        });
      } else {
        resolutionResults.push({
          name: agent.name,
          found: false
        });
      }
    } catch (error) {
      // Type guard to ensure error has a message property
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
        
      resolutionResults.push({
        name: agent.name,
        found: false,
        error: errorMessage
      });
    }
  }
  
  const resolutionTime = Date.now() - resolutionStartTime;
  console.log(`Batch resolution completed in ${resolutionTime}ms.`);
  
  // Type guard for resolution results
  const isFoundResult = (result: ResolutionResult): result is ResolutionSuccess =>
    result.found === true;
  
  console.log('\n=== Resolution Results ===');
  console.log(`Successfully Resolved: ${resolutionResults.filter(isFoundResult).length}`);
  console.log(`Failed to Resolve: ${resolutionResults.filter(r => !r.found).length}`);
  
  // 4. Generate MCP manifests for all low-risk agents
  console.log('\nStep 4: Generating MCP manifests for low-risk agents...');
  
  // Low risk agents are already type-checked as RegistrationSuccess
  for (const agent of lowRiskAgents) {
    try {
      // Simple manifest for example purposes
      const manifest = ans.generateMCPManifest(agent.name, {
        tools: [
          {
            name: `${agent.name}-tool`,
            description: `Standard tool for ${agent.name}`,
            parameters: {
              input: {
                type: 'string',
                description: 'Input data for processing'
              }
            }
          }
        ],
        authentication: {
          type: 'oauth2',
          scopes: ['read', 'process']
        }
      });
      
      console.log(`  Generated manifest for ${agent.name} (${manifest.length} bytes)`);
    } catch (error) {
      // Type guard to ensure error has a message property
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      console.error(`  Error generating manifest for ${agent.name}: ${errorMessage}`);
    }
  }
  
  console.log('\nBatch operations demonstration completed.');
  
  // Restore console logging if it was suppressed
  if (quietMode) {
    restoreConsoleLogging();
    console.log("Verbose logging restored");
  }
}

// Execute with proper exit handling
demonstrateBatchOperations()
  .then(() => {
    console.log('\nExample completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error in batch operations example:', error);
    process.exit(1);
  });
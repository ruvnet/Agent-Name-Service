/**
 * examples/usage.ts
 *
 * This file demonstrates the basic usage of the Agent Name Service (ANS).
 * It shows how to:
 * - Initialize the ANS service
 * - Register multiple agents with different capabilities
 * - Resolve agents in both A2A and MCP formats
 * - Review threat analysis results
 *
 * Run with --quiet flag to suppress verbose logging:
 * npx ts-node examples/usage.ts --quiet
 */

import { AgentNamingService } from '../src/ans';
import { suppressVerboseLogging, restoreConsoleLogging } from './utils/quiet-logging';

// Check if quiet mode is enabled via command line argument
const quietMode = process.argv.includes('--quiet');

// Helper function to print formatted outputs
function printSection(title: string, content: any) {
  console.log('\n' + '='.repeat(80));
  console.log(`${title}`);
  console.log('='.repeat(80));
  
  if (typeof content === 'object') {
    console.log(JSON.stringify(content, null, 2));
  } else {
    console.log(content);
  }
}

async function demonstrateANS() {
  // Apply quiet logging if requested
  if (quietMode) {
    suppressVerboseLogging();
    console.log("Running in quiet mode - verbose logs suppressed\n");
  }

  // Initialize the Agent Naming Service
  const ans = new AgentNamingService();
  printSection('Agent Name Service Initialized', 'Service ready to register and resolve agents');

  // Example 1: Register a content generation agent
  console.log('\n[Example 1] Registering a content generation agent...');
  const contentAgent = await ans.registerAgent('content-creator-agent', {
    version: '1.0.0',
    capabilities: ['text-generation', 'summarization', 'translation'],
    description: 'AI agent that creates and transforms content',
    provider: 'OpenAI',
    model: 'gpt-4',
    endpoints: [
      { 
        protocol: 'https', 
        address: 'api.contentcreator.ai', 
        port: 443 
      }
    ]
  });

  printSection('Content Generation Agent Registration Result', contentAgent.agentCard);
  printSection('Threat Analysis Report', contentAgent.threatReport);

  // Example 2: Register a data processing agent
  console.log('\n[Example 2] Registering a data processing agent...');
  const dataAgent = await ans.registerAgent('data-processor-agent', {
    version: '2.1.0',
    capabilities: ['data-extraction', 'data-transformation', 'analysis'],
    description: 'Processes and analyzes structured and unstructured data',
    provider: 'DataCorp',
    model: 'data-processor-v2',
    endpoints: [
      { 
        protocol: 'https', 
        address: 'api.datacorp.com', 
        port: 443 
      }
    ],
    rateLimit: {
      requestsPerMinute: 60,
      burstLimit: 10
    }
  });

  printSection('Data Processing Agent Registration Result', dataAgent.agentCard);
  printSection('Threat Analysis Report', dataAgent.threatReport);

  // Example 3: Register a security agent with potentially suspicious capabilities
  console.log('\n[Example 3] Registering a security agent (with suspicious capabilities)...');
  const securityAgent = await ans.registerAgent('security-admin-agent', {
    version: '1.0.0',
    capabilities: ['system-monitoring', 'threat-detection', 'exploit-research'],
    description: 'Monitors systems for security threats and vulnerabilities',
    provider: 'SecureDefense',
    model: 'security-defender-v1',
    endpoints: [
      { 
        protocol: 'https', 
        address: 'api.securedefense.com', 
        port: 443 
      }
    ],
    permissions: ['file-system-access', 'network-monitoring', 'execute-scripts']
  });

  printSection('Security Agent Registration Result', securityAgent.agentCard);
  printSection('Threat Analysis Report', securityAgent.threatReport);

  // Example 4: Resolve an agent
  console.log('\n[Example 4] Resolving an agent by name...');
  const resolvedAgent = await ans.resolveAgent('content-creator-agent');
  printSection('Resolved Agent', resolvedAgent);

  // Example 5: Generate MCP manifest
  console.log('\n[Example 5] Generating MCP manifest for data processing agent...');
  const mcpManifest = ans.generateMCPManifest('data-processor-agent', {
    tools: [
      {
        name: 'extract_data',
        description: 'Extract structured data from documents',
        parameters: {
          document_url: {
            type: 'string',
            description: 'URL of the document to process'
          },
          output_format: {
            type: 'string',
            enum: ['json', 'csv', 'xml'],
            default: 'json'
          }
        }
      },
      {
        name: 'analyze_data',
        description: 'Perform statistical analysis on datasets',
        parameters: {
          data_source: {
            type: 'string',
            description: 'Data source URL or identifier'
          },
          analysis_type: {
            type: 'string',
            enum: ['descriptive', 'predictive', 'prescriptive'],
            default: 'descriptive'
          }
        }
      }
    ],
    authentication: {
      type: 'oauth2',
      scopes: ['data:read', 'data:write']
    }
  });
  
  printSection('MCP Manifest', mcpManifest);
  
  // Restore console logging if it was suppressed
  if (quietMode) {
    restoreConsoleLogging();
    console.log("Verbose logging restored");
  }
}

// Execute the demonstration
demonstrateANS()
  .then(() => {
    console.log('\nDemonstration completed successfully!');
    // Force process to exit since there are timers in AgentNamingService
    process.exit(0);
  })
  .catch(error => {
    console.error('Error in ANS demonstration:', error);
    process.exit(1);
  });
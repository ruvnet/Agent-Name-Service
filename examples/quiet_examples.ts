/**
 * examples/quiet_examples.ts
 *
 * This example demonstrates running ANS with suppressed verbose logging
 * for cleaner output. It shows how to:
 * - Use suppressVerboseLogging to hide non-critical messages
 * - Run the same example operations with cleaner output
 * - Restore logging when needed
 */

import { AgentNamingService } from '../src/ans';
import { suppressVerboseLogging, restoreConsoleLogging } from './utils/quiet-logging';

async function runQuietExamples() {
  console.log('=== Quiet Examples With Suppressed Logging ===\n');
  
  // Suppress verbose logging before running examples
  suppressVerboseLogging();
  
  // Initialize the Agent Naming Service
  const ans = new AgentNamingService();
  console.log('Agent Name Service initialized successfully.\n');
  
  // Example 1: Register a basic agent
  console.log('Registering a basic agent...');
  const agentResult = await ans.registerAgent('quiet-utility-agent', {
    version: '1.0.0',
    capabilities: ['utility', 'format-conversion', 'data-validation'],
    description: 'A basic utility agent for common tasks',
    provider: 'ExampleCorp',
    model: 'utility-model-v1',
    endpoints: [
      { 
        protocol: 'https', 
        address: 'api.examplecorp.com/utility', 
        port: 443 
      }
    ]
  });
  
  console.log('Registration successful!');
  
  // Extract and display certificate information cleanly
  const jsonStartIndex = agentResult.agentCard.indexOf(': ') + 2;
  const jsonStr = agentResult.agentCard.substring(jsonStartIndex);
  const cardObj = JSON.parse(jsonStr);
  
  console.log('\n=== Certificate Information ===');
  console.log(`Issued To: quiet-utility-agent`);
  console.log(`Issued On: ${cardObj.registeredAt}`);
  console.log(`Valid Until: ${new Date(new Date(cardObj.registeredAt).getTime() + 365 * 24 * 60 * 60 * 1000).toISOString()}`);
  
  // Show security analysis results in a cleaner format
  console.log('\n=== Security Assessment ===');
  console.log(`Security Score: ${cardObj.securityAnalysis.threatScore}`);
  console.log(`Assessment Level: ${cardObj.securityAnalysis.severity}`);
  
  // Example 2: Resolve an agent
  console.log('\nResolving agent...');
  const resolvedAgent = await ans.resolveAgent('quiet-utility-agent');
  
  if (resolvedAgent) {
    console.log('Agent successfully resolved.');
  } else {
    console.log('Agent not found.');
  }
  
  // Example 3: Generate MCP manifest
  console.log('\nGenerating MCP manifest...');
  const manifest = ans.generateMCPManifest('quiet-utility-agent', {
    tools: [
      {
        name: 'convert_format',
        description: 'Convert data between formats',
        parameters: {
          input: {
            type: 'string',
            description: 'Input data to convert'
          },
          format: {
            type: 'string',
            enum: ['json', 'xml', 'yaml'],
            default: 'json'
          }
        }
      }
    ],
    authentication: {
      type: 'api_key',
      scopes: ['convert']
    }
  });
  
  console.log('MCP manifest generated successfully.');
  
  // Restore original logging behavior
  restoreConsoleLogging();
  
  console.log('\nQuiet examples completed successfully!');
  console.log('(Verbose logging has been restored)');
}

// Execute with proper exit handling
runQuietExamples()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('Error in quiet examples:', error);
    process.exit(1);
  });
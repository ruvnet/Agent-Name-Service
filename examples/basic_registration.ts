/**
 * examples/basic_registration.ts
 *
 * A simple example demonstrating basic agent registration with ANS.
 * This script demonstrates how to:
 * - Initialize the ANS service
 * - Register a single agent with specific capabilities
 * - Display the registration result and certificate
 *
 * Run with --quiet flag to suppress verbose logging:
 * npx ts-node examples/basic_registration.ts --quiet
 */

import { AgentNamingService } from '../src/ans';
import { suppressVerboseLogging, restoreConsoleLogging } from './utils/quiet-logging';

// Check if quiet mode is enabled via command line argument
const quietMode = process.argv.includes('--quiet');

async function registerBasicAgent() {
  // Apply quiet logging if requested
  if (quietMode) {
    suppressVerboseLogging();
    console.log("Running in quiet mode - verbose logs suppressed");
  }
  console.log('=== Basic Agent Registration Example ===\n');
  
  // Initialize the Agent Naming Service
  const ans = new AgentNamingService();
  console.log('Agent Name Service initialized successfully.\n');
  
  // Define a basic agent with minimal configuration
  console.log('Registering a basic agent...');
  const agentResult = await ans.registerAgent('basic-utility-agent', {
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
  
  // Display the registration results
  console.log('\n=== Agent Registration Result ===');
  console.log(`Agent Name: basic-utility-agent`);
  console.log(`Registration Status: Success`);
  
  // Extract the certificate information from the agent card
  // The agentCard is a string formatted as "Agent Card for {name}: {JSON data}"
  const jsonStartIndex = agentResult.agentCard.indexOf(': ') + 2;
  const jsonStr = agentResult.agentCard.substring(jsonStartIndex);
  const cardObj = JSON.parse(jsonStr);
  const certLines = cardObj.certificate.split('\n').slice(0, 10);
  
  console.log('\n=== Certificate Preview ===');
  certLines.forEach((line: string) => console.log(line));
  console.log('...');
  
  // Display threat assessment summary
  console.log('\n=== Security Assessment ===');
  console.log(`Threat Score: ${agentResult.threatReport.threatScore}`);
  console.log(`Severity: ${agentResult.threatReport.severity}`);
  console.log(`Detected Threats: ${agentResult.threatReport.detectedThreats.length > 0 ? 
    agentResult.threatReport.detectedThreats.join(', ') : 'None'}`);
  
  console.log('\nAgent registration completed successfully.');
  
  // Restore console logging if it was suppressed
  if (quietMode) {
    restoreConsoleLogging();
    console.log("Verbose logging restored");
  }
}

// Execute with proper exit handling
registerBasicAgent()
  .then(() => {
    console.log('\nExample completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error in basic registration example:', error);
    process.exit(1);
  });
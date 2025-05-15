/**
 * examples/custom_configuration.ts
 *
 * This example demonstrates using custom configuration options
 * with the Agent Name Service (ANS).
 * It shows how to:
 * - Initialize ANS with custom security and validation settings
 * - Configure custom rate limiting
 * - Set up custom certificate options
 * - Override default behavior for security checks
 *
 * Run with --quiet flag to suppress verbose logging:
 * npx ts-node examples/custom_configuration.ts --quiet
 */

import { AgentNamingService } from '../src/ans';
import { suppressVerboseLogging, restoreConsoleLogging } from './utils/quiet-logging';

// Check if quiet mode is enabled via command line argument
const quietMode = process.argv.includes('--quiet');

async function demonstrateCustomConfiguration() {
  // Apply quiet logging if requested
  if (quietMode) {
    suppressVerboseLogging();
    console.log("Running in quiet mode - verbose logs suppressed\n");
  }
  console.log('=== Custom Configuration Example ===\n');
  
  // 1. Create ANS instance with custom configuration
  console.log('Step 1: Initializing ANS with custom configuration...');
  
  // Create ANS with custom config based on the available properties in ANSConfig
  const customAns = new AgentNamingService({
    // Enable rate limiting but with higher limits than default
    enableRateLimiting: true,
    maxRegistrationsPerHour: 50,         // Increased from default of 10
    
    // Use strict name validation
    strictNameValidation: true,
    
    // Add custom reserved prefixes beyond defaults
    reservedPrefixes: [
      'system.', 'admin.', 'security.', 'root.', 'mcp.', 'core.',
      'protected.', 'trusted.', 'internal.', 'restricted.'
    ],
    
    // Only allow specific domains to register agents
    allowedDomains: [
      'example.com',
      'configtester.com',
      'trustedpartner.org'
    ]
  });
  
  console.log('Custom ANS instance initialized with the following settings:');
  console.log('- Rate limiting enabled with higher capacity (50 registrations/hour)');
  console.log('- Strict name validation enforced');
  console.log('- Extended list of reserved name prefixes');
  console.log('- Domain restriction to specific trusted domains\n');
  
  // 2. Register an agent with the custom-configured service
  console.log('Step 2: Registering an agent with custom-configured ANS...');
  
  try {
    const agentResult = await customAns.registerAgent('custom-config-agent', {
      version: '1.0.0',
      capabilities: ['data-processing', 'api-integration'],
      description: 'Agent for testing custom ANS configuration',
      provider: 'ConfigTester',
      model: 'config-test-v1',
      endpoints: [
        { 
          protocol: 'https', 
          address: 'api.configtester.com', 
          port: 443 
        }
      ]
    });
    
    console.log('\n=== Registration Result ===');
    console.log(`Registration Status: Success`);
    console.log(`Security Assessment: ${agentResult.threatReport.severity} (Score: ${agentResult.threatReport.threatScore})`);
    
    // 3. Demonstrate the custom name validation
    console.log('\nStep 3: Testing strict name validation and reserved prefixes...');
    
    // Try to register an agent with a reserved prefix
    try {
      await customAns.registerAgent('restricted.test-agent', {
        version: '1.0.0',
        capabilities: ['data-processing'],
        description: 'Agent with reserved prefix',
        provider: 'ValidationTest',
        endpoints: [
          { protocol: 'https', address: 'example.com', port: 443 }
        ]
      });
      console.log('WARNING: Agent registration succeeded even though it used a reserved prefix!');
    } catch (error: any) {
      console.log(`Reserved prefix validation failed as expected: ${error.message}`);
    }
    
    // 4. Test domain restrictions
    console.log('\nStep 4: Testing domain restrictions...');
    
    // Try to register an agent with an unauthorized domain
    try {
      await customAns.registerAgent('domain-test-agent', {
        version: '1.0.0',
        capabilities: ['data-processing'],
        description: 'Agent with unauthorized domain',
        provider: 'ValidationTest',
        endpoints: [
          { protocol: 'https', address: 'unauthorized-domain.com', port: 443 }
        ]
      });
      console.log('WARNING: Agent registration succeeded with unauthorized domain!');
    } catch (error: any) {
      console.log(`Domain restriction validation failed as expected: ${error.message}`);
    }
    
    // 5. Test rate limiting (demonstration only)
    console.log('\nStep 5: Rate limiting demonstration...');
    console.log('Note: The following demonstrates the rate limiting configuration, but may not');
    console.log('      trigger actual rate limits in this short example.');
    
    console.log(`Current rate limit: ${customAns['config'].maxRegistrationsPerHour} registrations per hour`);
    console.log('To trigger the limit, you would need to register more than that number of agents');
    console.log('from the same IP address within an hour.');
    
  } catch (error: any) {
    console.error(`Error in custom configuration example: ${error.message}`);
  }
  
  console.log('\nCustom configuration demonstration completed.');
  
  // Restore console logging if it was suppressed
  if (quietMode) {
    restoreConsoleLogging();
    console.log("Verbose logging restored");
  }
}

// Execute with proper exit handling
demonstrateCustomConfiguration()
  .then(() => {
    console.log('\nExample completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error in custom configuration example:', error);
    process.exit(1);
  });
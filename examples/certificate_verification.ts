/**
 * examples/certificate_verification.ts
 *
 * This example demonstrates certificate validation and verification in ANS.
 * It shows how to:
 * - Issue a certificate for an agent
 * - Validate a certificate against the ANS trust chain
 * - Attempt verification with both valid and invalid certificates
 *
 * Run with --quiet flag to suppress verbose logging:
 * npx ts-node examples/certificate_verification.ts --quiet
 */

import { AgentNamingService } from '../src/ans';
import { issueCertificate, validateCertificate } from '../src/certificate';
import { suppressVerboseLogging, restoreConsoleLogging } from './utils/quiet-logging';

// Check if quiet mode is enabled via command line argument
const quietMode = process.argv.includes('--quiet');

async function demonstrateCertificateVerification() {
  // Apply quiet logging if requested
  if (quietMode) {
    suppressVerboseLogging();
    console.log("Running in quiet mode - verbose logs suppressed\n");
  }
  console.log('=== Certificate Verification Example ===\n');
  
  // Initialize the Agent Naming Service
  const ans = new AgentNamingService();
  console.log('Agent Name Service initialized successfully.\n');
  
  // 1. Register an agent to get a valid certificate
  console.log('Step 1: Registering an agent to obtain a valid certificate...');
  const agentResult = await ans.registerAgent('verification-test-agent', {
    version: '1.0.0',
    capabilities: ['verification-testing'],
    description: 'An agent used for certificate verification testing',
    provider: 'TestCorp',
    endpoints: [
      { 
        protocol: 'https', 
        address: 'test.example.com', 
        port: 443 
      }
    ]
  });
  
  // Extract certificate from the agent card
  // The agentCard is a string formatted as "Agent Card for {name}: {JSON data}"
  const jsonStartIndex = agentResult.agentCard.indexOf(': ') + 2;
  const jsonStr = agentResult.agentCard.substring(jsonStartIndex);
  const cardObj = JSON.parse(jsonStr);
  const validCertificate = cardObj.certificate;
  console.log('Agent registered successfully, certificate obtained.\n');
  
  // 2. Validate the legitimate certificate
  console.log('Step 2: Validating the legitimate certificate...');
  const validationResult = validateCertificate(validCertificate);
  
  console.log('\n=== Legitimate Certificate Validation ===');
  console.log(`Valid: ${validationResult.valid}`);
  if (validationResult.valid) {
    console.log('Certificate passed validation successfully.');
  } else {
    console.log(`Validation failed: ${validationResult.details}`);
  }
  
  // 3. Create a tampered certificate and validate it
  console.log('\nStep 3: Testing with a tampered certificate...');
  
  // Issue a certificate with our own values (outside the proper issuance flow)
  const tamperedCertificate = issueCertificate('unauthorized-agent');
  
  // Modify a few characters to simulate tampering
  const tamperedLines = tamperedCertificate.split('\n');
  if (tamperedLines.length > 5) {
    // Change a character in the fingerprint line to simulate tampering
    tamperedLines[5] = tamperedLines[5].replace(/[a-f0-9]/, 'X');
  }
  const modifiedCertificate = tamperedLines.join('\n');
  
  // Attempt to validate the tampered certificate
  const invalidValidationResult = validateCertificate(modifiedCertificate);
  
  console.log('\n=== Tampered Certificate Validation ===');
  console.log(`Valid: ${invalidValidationResult.valid}`);
  if (!invalidValidationResult.valid) {
    console.log(`Validation failed as expected: ${invalidValidationResult.details}`);
  } else {
    console.log('WARNING: Tampered certificate unexpectedly passed validation!');
  }
  
  // 4. Try to resolve an agent with an invalid certificate
  console.log('\nStep 4: Attempting to resolve an agent with an invalid certificate name...');
  const resolvedAgent = await ans.resolveAgent('non-existent-agent');
  
  console.log('\n=== Agent Resolution ===');
  if (resolvedAgent) {
    console.log('Warning: Invalid agent was unexpectedly resolved!');
  } else {
    console.log('Resolution failed as expected for non-existent agent.');
  }
  
  console.log('\nCertificate verification demonstration completed.');
  
  // Restore console logging if it was suppressed
  if (quietMode) {
    restoreConsoleLogging();
    console.log("Verbose logging restored");
  }
}

// Execute with proper exit handling
demonstrateCertificateVerification()
  .then(() => {
    console.log('\nExample completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error in certificate verification example:', error);
    process.exit(1);
  });
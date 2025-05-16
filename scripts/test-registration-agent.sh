#!/bin/bash
# Test script for the registration agent

echo "Testing the Agent Registration Agent..."

# Create a test directory if it doesn't exist
TEST_DIR="./test-results"
mkdir -p "$TEST_DIR"

# Current timestamp for the output file
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="${TEST_DIR}/registration_agent_test_${TIMESTAMP}.json"

# Define a test agent registration payload
read -r -d '' TEST_PAYLOAD << EOM
{
  "name": "test.agent.$(date +%s)",
  "metadata": {
    "description": "A test agent for validating the registration process",
    "capabilities": ["text-processing", "data-analysis", "test-execution"],
    "version": "1.0.0",
    "provider": "Test Provider",
    "contact": "test@example.com",
    "tags": ["test", "demo", "registration"]
  },
  "ipAddress": "127.0.0.1",
  "domainName": "test.local"
}
EOM

# Create a temporary file for the payload
TEMP_PAYLOAD_FILE=$(mktemp)
echo "$TEST_PAYLOAD" > "$TEMP_PAYLOAD_FILE"

echo "Using test payload:"
echo "$TEST_PAYLOAD"
echo ""

# Execute the registration test
echo "Executing registration agent test..."
echo ""

# Run the registration test through Node.js
cat > test-registration-agent.js << EOF
const { processAgentRegistration } = require('./sparc-agent/src/mastra/agents');

async function runTest() {
  try {
    // Parse the test payload
    const testPayload = require('${TEMP_PAYLOAD_FILE}');
    
    console.log('Processing registration request...');
    const result = await processAgentRegistration(testPayload);
    
    console.log('Registration complete!');
    console.log(JSON.stringify(result, null, 2));
    
    // Write result to output file
    require('fs').writeFileSync('${OUTPUT_FILE}', JSON.stringify(result, null, 2));
    console.log(\`Results saved to ${OUTPUT_FILE}\`);
    
    // Simple validation check
    if (result.valid) {
      console.log('\n✅ Registration validation PASSED');
    } else {
      console.log('\n❌ Registration validation FAILED');
      console.log('Issues:');
      if (result.issues && result.issues.length > 0) {
        result.issues.forEach(issue => console.log(` - ${issue}`));
      }
    }
    
    if (result.certificateStatus === 'GENERATED') {
      console.log('✅ Certificate generation SUCCEEDED');
    } else {
      console.log('❌ Certificate generation FAILED or SKIPPED');
    }
    
    if (result.registrationStatus === 'REGISTERED') {
      console.log('✅ Agent registration SUCCEEDED');
    } else {
      console.log('❌ Agent registration FAILED or SKIPPED');
    }
    
  } catch (error) {
    console.error('Error running registration test:', error);
  }
}

runTest();
EOF

# Execute the test
node test-registration-agent.js

# Clean up temporary files
rm "$TEMP_PAYLOAD_FILE"
rm test-registration-agent.js

echo ""
echo "Test completed. Results are available in $OUTPUT_FILE"
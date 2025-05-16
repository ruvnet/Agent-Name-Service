#!/bin/bash

# Define colors for output formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API Base URL (default to localhost:3000 but allow override with environment variable)
API_BASE="${API_BASE:-http://localhost:3000}"

# Function to print section headers
print_header() {
  echo -e "\n${BLUE}=== $1 ===${NC}"
}

# Function to execute a workflow with parameters
run_workflow() {
  local workflow_name=$1
  local params=$2
  local description=$3

  print_header "Testing $description"
  echo "Running $workflow_name workflow..."
  
  # Create a run with parameters
  echo "Creating a workflow run..."
  CREATE_RESPONSE=$(curl -s -X POST "$API_BASE/workflows/$workflow_name/createRun" \
    -H "Content-Type: application/json" \
    -d "$params")
  
  echo "Create Response:"
  echo "$CREATE_RESPONSE"
  
  # Extract run ID
  RUN_ID=$(echo $CREATE_RESPONSE | grep -o '"runId":"[^"]*' | cut -d'"' -f4)
  
  if [ -z "$RUN_ID" ]; then
    echo -e "${RED}Failed to create run or extract run ID${NC}"
    return 1
  fi
  
  echo -e "${GREEN}Created run with ID: $RUN_ID${NC}"
  
  # Start the run
  echo "Starting the workflow run..."
  START_RESPONSE=$(curl -s -X POST "$API_BASE/workflows/$workflow_name/start-async" \
    -H "Content-Type: application/json" \
    -d "{\"runId\": \"$RUN_ID\"}")
  
  echo "Start Response:"
  echo "$START_RESPONSE"
  
  # Wait briefly for workflow to process
  echo "Waiting for workflow to process..."
  sleep 2
  
  # Get run status
  echo "Checking run status..."
  STATUS_RESPONSE=$(curl -s -X GET "$API_BASE/workflows/$workflow_name/runs/$RUN_ID")
  
  # Trim the response if it's too large
  if [ "${#STATUS_RESPONSE}" -gt 500 ]; then
    echo "Run Status Response (truncated):"
    echo "${STATUS_RESPONSE:0:500}..."
  else
    echo "Run Status Response:"
    echo "$STATUS_RESPONSE"
  fi
  
  return 0
}

# Main script execution
print_header "SPARC Agent Workflow Tests"
echo "Testing various workflows with appropriate parameters..."

# Test Weather Workflow
run_workflow "weatherWorkflow" '{"city": "Seattle"}' "Weather Workflow with City Parameter"

# Test Agent Registration Workflow
run_workflow "agentRegistrationWorkflow" '{
  "name": "test-agent-123",
  "metadata": {
    "description": "A test agent for registration workflow",
    "capabilities": ["data-access", "network-fetch", "compute"],
    "version": "1.0.0",
    "provider": "Test Provider",
    "contact": "test@example.com",
    "tags": ["test", "demo"]
  },
  "ipAddress": "192.168.1.100",
  "domainName": "test.example.com"
}' "Agent Registration Workflow"

# Test Agent Resolution Workflow
run_workflow "agentResolutionWorkflow" '{
  "identifier": "test-agent-123",
  "resolution_type": "NAME",
  "include_metadata": true,
  "verify_certificate": true
}' "Agent Resolution Workflow"

# Test Certificate Rotation Workflow
run_workflow "certificateRotationWorkflow" '{
  "agentName": "test-agent-123",
  "rotationType": "SCHEDULED",
  "reason": "Testing certificate rotation",
  "notifyOwner": true
}' "Certificate Rotation Workflow"

# Test Security Monitoring Workflow
run_workflow "securityMonitoringWorkflow" '{
  "monitoringType": "MANUAL",
  "alertThreshold": "MEDIUM",
  "eventData": {
    "eventType": "TEST_EVENT",
    "agentName": "test-agent-123",
    "ipAddress": "192.168.1.100",
    "severity": "MEDIUM"
  }
}' "Security Monitoring Workflow"

# Test Protocol Translation Workflow
run_workflow "protocolTranslationWorkflow" '{
  "sourceProtocol": "ANS",
  "targetProtocol": "MASTRA",
  "agentData": {
    "name": "test-agent-123",
    "certificate": {
      "status": "VALID",
      "validFrom": "2025-01-01T00:00:00Z",
      "validTo": "2026-01-01T00:00:00Z"
    },
    "metadata": {
      "capabilities": ["data-access", "network-fetch"]
    },
    "registeredAt": "2025-01-01T00:00:00Z"
  },
  "preserveMetadata": true,
  "validationLevel": "BASIC"
}' "Protocol Translation Workflow"

# Test Agent Capability Discovery Workflow
run_workflow "agentCapabilityDiscoveryWorkflow" '{
  "agentIdentifier": "test-agent-123",
  "discoveryMode": "STATIC",
  "includeInactive": false,
  "classifyCapabilities": true
}' "Agent Capability Discovery Workflow"

print_header "Test Complete"
echo "Review the outputs above to determine the state of each workflow test."
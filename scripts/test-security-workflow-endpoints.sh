#!/bin/bash

# test-security-workflow-endpoints.sh
# Script to test all securityWorkflow endpoints

# Define colors for output formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API Base URL (default to localhost:3000 but allow override with environment variable)
API_BASE="${API_BASE:-http://localhost:4111}"

# Get Mastra port from .env file or use default
DEFAULT_PORT=4111
MASTRA_PORT=$DEFAULT_PORT

# Function to print section headers
print_header() {
  echo -e "\n${BLUE}=== $1 ===${NC}"
}

# Function to print endpoint testing result
print_result() {
  local endpoint=$1
  local method=$2
  local status=$3
  local response=$4

  echo -e "${YELLOW}Testing $method $endpoint${NC}"
  
  if [ "$status" = "success" ]; then
    echo -e "${GREEN}SUCCESS: $method $endpoint${NC}"
  else
    echo -e "${RED}FAILED: $method $endpoint${NC}"
  fi
  
  # Trim the response if it's too large
  if [ "${#response}" -gt 500 ]; then
    echo "Response (truncated):"
    echo "${response:0:500}..."
  else
    echo "Response:"
    echo "$response"
  fi
  
  echo -e "${YELLOW}----------------------------------------${NC}"
}

# Prepare sample agent data for testing
read -r -d '' AGENT_DATA << EOM
{
  "name": "test-agent",
  "metadata": {
    "capabilities": ["data-processing", "file-system-access", "execute-scripts"],
    "description": "Test agent for security analysis",
    "version": "1.0.0",
    "provider": "Test Provider",
    "model": "test-model"
  },
  "certificate": null,
  "ipAddress": "192.168.1.1",
  "registrationHistory": []
}
EOM

# Print script banner
print_header "TESTING SECURITY WORKFLOW ENDPOINTS"
echo "API Base URL: $API_BASE"
echo "Testing all endpoints for the securityWorkflow"
echo

# Test 1: GET /api/workflows
print_header "1. GET /api/workflows"
RESPONSE=$(curl -s -X GET "$API_BASE/api/workflows")
STATUS="success"
if [[ "$RESPONSE" =~ "error" || "$RESPONSE" =~ "Error" || -z "$RESPONSE" ]]; then
  STATUS="failed"
fi
print_result "/api/workflows" "GET" "$STATUS" "$RESPONSE"

# Test 2: GET /api/workflows/securityWorkflow
print_header "2. GET /api/workflows/securityWorkflow"
RESPONSE=$(curl -s -X GET "$API_BASE/api/workflows/securityWorkflow")
STATUS="success"
if [[ "$RESPONSE" =~ "error" || "$RESPONSE" =~ "Error" || -z "$RESPONSE" ]]; then
  STATUS="failed"
fi
print_result "/api/workflows/securityWorkflow" "GET" "$STATUS" "$RESPONSE"

# Test 3: POST /api/workflows/securityWorkflow
print_header "3. POST /api/workflows/securityWorkflow"
RESPONSE=$(curl -s -X POST "$API_BASE/api/workflows/securityWorkflow" \
  -H "Content-Type: application/json" \
  -d "$AGENT_DATA")
STATUS="success"
if [[ "$RESPONSE" =~ "error" || "$RESPONSE" =~ "Error" || -z "$RESPONSE" ]]; then
  STATUS="failed"
fi
print_result "/api/workflows/securityWorkflow" "POST" "$STATUS" "$RESPONSE"

# Test 4: POST /api/workflows/securityWorkflow/createRun
print_header "4. POST /api/workflows/securityWorkflow/createRun"
RESPONSE=$(curl -s -X POST "$API_BASE/api/workflows/securityWorkflow/createRun" \
  -H "Content-Type: application/json" \
  -d "$AGENT_DATA")
STATUS="success"
if [[ "$RESPONSE" =~ "error" || "$RESPONSE" =~ "Error" || -z "$RESPONSE" ]]; then
  STATUS="failed"
fi
print_result "/api/workflows/securityWorkflow/createRun" "POST" "$STATUS" "$RESPONSE"

# Extract run ID if available
RUN_ID=$(echo $RESPONSE | grep -o '"runId":"[^"]*' | cut -d'"' -f4)
if [ -n "$RUN_ID" ]; then
  echo -e "${GREEN}Successfully extracted Run ID: $RUN_ID${NC}"
else
  echo -e "${RED}Failed to extract Run ID. Generating mock ID for testing.${NC}"
  RUN_ID="mock-run-id-$(date +%s)"
fi

# Test 5: POST /api/workflows/securityWorkflow/resume-async
print_header "5. POST /api/workflows/securityWorkflow/resume-async"
RESUME_DATA="{\"runId\": \"$RUN_ID\"}"
RESPONSE=$(curl -s -X POST "$API_BASE/api/workflows/securityWorkflow/resume-async" \
  -H "Content-Type: application/json" \
  -d "$RESUME_DATA")
STATUS="success"
if [[ "$RESPONSE" =~ "error" || "$RESPONSE" =~ "Error" || -z "$RESPONSE" ]]; then
  STATUS="failed"
fi
print_result "/api/workflows/securityWorkflow/resume-async" "POST" "$STATUS" "$RESPONSE"

# Test 6: POST /api/workflows/securityWorkflow/start-async
print_header "6. POST /api/workflows/securityWorkflow/start-async"
START_DATA="{\"runId\": \"$RUN_ID\"}"
RESPONSE=$(curl -s -X POST "$API_BASE/api/workflows/securityWorkflow/start-async" \
  -H "Content-Type: application/json" \
  -d "$START_DATA")
STATUS="success"
if [[ "$RESPONSE" =~ "error" || "$RESPONSE" =~ "Error" || -z "$RESPONSE" ]]; then
  STATUS="failed"
fi
print_result "/api/workflows/securityWorkflow/start-async" "POST" "$STATUS" "$RESPONSE"

# Test 7: POST /api/workflows/securityWorkflow/watch
print_header "7. POST /api/workflows/securityWorkflow/watch"
WATCH_DATA="{\"runId\": \"$RUN_ID\"}"
RESPONSE=$(curl -s -X POST "$API_BASE/api/workflows/securityWorkflow/watch" \
  -H "Content-Type: application/json" \
  -d "$WATCH_DATA")
STATUS="success"
if [[ "$RESPONSE" =~ "error" || "$RESPONSE" =~ "Error" || -z "$RESPONSE" ]]; then
  STATUS="failed"
fi
print_result "/api/workflows/securityWorkflow/watch" "POST" "$STATUS" "$RESPONSE"

# Test 8: POST /api/workflows/securityWorkflow/resume
print_header "8. POST /api/workflows/securityWorkflow/resume"
RESUME_DATA="{\"runId\": \"$RUN_ID\"}"
RESPONSE=$(curl -s -X POST "$API_BASE/api/workflows/securityWorkflow/resume" \
  -H "Content-Type: application/json" \
  -d "$RESUME_DATA")
STATUS="success"
if [[ "$RESPONSE" =~ "error" || "$RESPONSE" =~ "Error" || -z "$RESPONSE" ]]; then
  STATUS="failed"
fi
print_result "/api/workflows/securityWorkflow/resume" "POST" "$STATUS" "$RESPONSE"

# Test 9: GET /api/workflows/securityWorkflow/runs
print_header "9. GET /api/workflows/securityWorkflow/runs"
RESPONSE=$(curl -s -X GET "$API_BASE/api/workflows/securityWorkflow/runs")
STATUS="success"
if [[ "$RESPONSE" =~ "error" || "$RESPONSE" =~ "Error" || -z "$RESPONSE" ]]; then
  STATUS="failed"
fi
print_result "/api/workflows/securityWorkflow/runs" "GET" "$STATUS" "$RESPONSE"

# Additional test: GET specific run
if [ -n "$RUN_ID" ] && [ "$RUN_ID" != "mock-run-id-$(date +%s)" ]; then
  print_header "Bonus: GET /api/workflows/securityWorkflow/runs/$RUN_ID"
  RESPONSE=$(curl -s -X GET "$API_BASE/api/workflows/securityWorkflow/runs/$RUN_ID")
  STATUS="success"
  if [[ "$RESPONSE" =~ "error" || "$RESPONSE" =~ "Error" || -z "$RESPONSE" ]]; then
    STATUS="failed"
  fi
  print_result "/api/workflows/securityWorkflow/runs/$RUN_ID" "GET" "$STATUS" "$RESPONSE"
fi

# Also try with original workflow name from the code
print_header "TESTING WITH WORKFLOW NAME: agent-security-workflow"
RESPONSE=$(curl -s -X GET "$API_BASE/api/workflows/agent-security-workflow")
STATUS="success"
if [[ "$RESPONSE" =~ "error" || "$RESPONSE" =~ "Error" || -z "$RESPONSE" ]]; then
  STATUS="failed"
fi
print_result "/api/workflows/agent-security-workflow" "GET" "$STATUS" "$RESPONSE"

print_header "TEST COMPLETE"
echo "Review the outputs above to determine the status of each endpoint test."
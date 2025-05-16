#!/bin/bash

# test-fixed-security-workflow.sh
# Script to test the fixed security workflow with proper resume functionality

# Define colors for output formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# API Base URL (using port 4111)
API_BASE="http://localhost:4111"

# Function to print section headers
print_header() {
  echo -e "\n${BLUE}=== $1 ===${NC}"
}

# Function to print step results
print_result() {
  local step=$1
  local status=$2
  local response=$3

  echo -e "${YELLOW}Step: $step${NC}"
  
  if [ "$status" = "success" ]; then
    echo -e "${GREEN}SUCCESS${NC}"
  else
    echo -e "${RED}FAILED${NC}"
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
print_header "TESTING FIXED SECURITY WORKFLOW"
echo "API Base URL: $API_BASE"
echo "Testing the fixed security workflow with proper resume functionality"
echo

# Step 1: Create a run
print_header "Step 1: Create a run"
CREATE_RESPONSE=$(curl -s -X POST "$API_BASE/api/workflows/securityWorkflow/createRun" \
  -H "Content-Type: application/json" \
  -d "$AGENT_DATA")

STATUS="success"
if [[ "$CREATE_RESPONSE" =~ "error" || -z "$CREATE_RESPONSE" ]]; then
  STATUS="failed"
fi

print_result "Create Run" "$STATUS" "$CREATE_RESPONSE"

# Extract run ID
RUN_ID=$(echo $CREATE_RESPONSE | grep -o '"runId":"[^"]*' | cut -d'"' -f4)

if [ -z "$RUN_ID" ]; then
  echo -e "${RED}Failed to extract run ID. Exiting.${NC}"
  exit 1
else
  echo -e "${GREEN}Extracted Run ID: $RUN_ID${NC}"
fi

# Step 2: Start the workflow asynchronously
print_header "Step 2: Start the workflow asynchronously"
START_DATA="{\"runId\": \"$RUN_ID\"}"
START_RESPONSE=$(curl -s -X POST "$API_BASE/api/workflows/securityWorkflow/start-async" \
  -H "Content-Type: application/json" \
  -d "$START_DATA")

STATUS="success"
if [[ "$START_RESPONSE" =~ "error" || -z "$START_RESPONSE" ]]; then
  STATUS="failed"
fi

print_result "Start Workflow" "$STATUS" "$START_RESPONSE"

# Wait for workflow to process
echo "Waiting 5 seconds for workflow to process..."
sleep 5

# Step 3: Get all runs to verify workflow status
print_header "Step 3: Get all runs"
RUNS_RESPONSE=$(curl -s -X GET "$API_BASE/api/workflows/securityWorkflow/runs")

STATUS="success"
if [[ "$RUNS_RESPONSE" =~ "error" || -z "$RUNS_RESPONSE" ]]; then
  STATUS="failed"
fi

print_result "Get All Runs" "$STATUS" "$RUNS_RESPONSE"

# Alternative testing for resume functionality
print_header "Testing Resume with Different Request Format"

# Test resume with different request formats
echo "Testing resume with proper format..."
RESUME_DATA=$(cat <<EOF
{
  "runId": "$RUN_ID",
  "stepId": "analyze-agent-security"
}
EOF
)

echo "Request data:"
echo "$RESUME_DATA"
echo

RESUME_RESPONSE=$(curl -s -X POST "$API_BASE/api/workflows/securityWorkflow/resume" \
  -H "Content-Type: application/json" \
  -d "$RESUME_DATA")

STATUS="success"
if [[ "$RESUME_RESPONSE" =~ "error" || -z "$RESUME_RESPONSE" ]]; then
  STATUS="failed"
fi

print_result "Resume with stepId" "$STATUS" "$RESUME_RESPONSE"

# Try resume-async with proper format
echo "Testing resume-async with proper format..."
RESUME_ASYNC_RESPONSE=$(curl -s -X POST "$API_BASE/api/workflows/securityWorkflow/resume-async" \
  -H "Content-Type: application/json" \
  -d "$RESUME_DATA")

STATUS="success"
if [[ "$RESUME_ASYNC_RESPONSE" =~ "error" || -z "$RESUME_ASYNC_RESPONSE" ]]; then
  STATUS="failed"
fi

print_result "Resume Async with stepId" "$STATUS" "$RESUME_ASYNC_RESPONSE"

# Test with agent-security-workflow as well
print_header "Testing with agent-security-workflow name"
CREATE_RESPONSE2=$(curl -s -X POST "$API_BASE/api/workflows/agent-security-workflow/createRun" \
  -H "Content-Type: application/json" \
  -d "$AGENT_DATA")

STATUS="success"
if [[ "$CREATE_RESPONSE2" =~ "error" || -z "$CREATE_RESPONSE2" ]]; then
  STATUS="failed"
fi

print_result "Create Run with agent-security-workflow" "$STATUS" "$CREATE_RESPONSE2"

echo -e "${GREEN}Test completed!${NC}"
echo "Review the outputs above to determine if the fix was successful."
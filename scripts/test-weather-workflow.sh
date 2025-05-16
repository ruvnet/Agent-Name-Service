#!/bin/bash

# Test script for the weather workflow
# This script tries different API approaches to run the workflow

# Set the API base URL
API_BASE="http://localhost:4111/api"

# Colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Weather Workflow API Test ====${NC}"
echo "Testing various methods to trigger the weather workflow..."

# 1. Get workflow info
echo -e "\n${BLUE}1. Getting workflow information${NC}"
WORKFLOW_INFO=$(curl -s -X GET "$API_BASE/workflows/weatherWorkflow")
echo "Workflow schema:"
echo "$WORKFLOW_INFO" | grep -o '"triggerSchema":"[^"]*"' | sed 's/"triggerSchema":"//;s/"//'
echo

# 2. Approach 1: Create and start a run
echo -e "${BLUE}2. APPROACH 1: Create and start a run${NC}"
echo "Creating a workflow run..."
CREATE_RESPONSE=$(curl -s -X POST "$API_BASE/workflows/weatherWorkflow/createRun" \
  -H "Content-Type: application/json" \
  -d '{
    "city": "Seattle"
  }')

echo "Create Response:"
echo "$CREATE_RESPONSE"

# Extract the run ID
RUN_ID=$(echo $CREATE_RESPONSE | grep -o '"runId":"[^"]*"' | sed 's/"runId":"//;s/"//')

if [ -z "$RUN_ID" ]; then
  echo -e "${RED}Failed to create run${NC}"
else
  echo -e "${GREEN}Created run with ID: $RUN_ID${NC}"

  # Start the workflow run
  echo "Starting the workflow run..."
  START_RESPONSE=$(curl -s -X POST "$API_BASE/workflows/weatherWorkflow/start-async" \
    -H "Content-Type: application/json" \
    -d "{
      \"runId\": \"$RUN_ID\",
      \"city\": \"Seattle\"
    }")

  echo "Start Response:"
  echo "$START_RESPONSE"
  
  # Wait a moment for processing
  echo "Waiting for workflow to process..."
  sleep 3
  
  # Check the status of the run
  echo "Checking run status..."
  STATUS_RESPONSE=$(curl -s -X GET "$API_BASE/workflows/weatherWorkflow/run/$RUN_ID")
  
  echo "Run Status Response:"
  echo "$STATUS_RESPONSE"
fi

# 3. Approach 2: Direct workflow run
echo -e "\n${BLUE}3. APPROACH 2: Direct workflow run${NC}"
echo "Running workflow directly..."
DIRECT_RESPONSE=$(curl -s -X POST "$API_BASE/workflows/weatherWorkflow" \
  -H "Content-Type: application/json" \
  -d '{
    "city": "Seattle"
  }')

# Alternative input format with direct parameters
echo "Trying alternative direct run format..."
DIRECT_RESPONSE2=$(curl -s -X POST "$API_BASE/workflows/weatherWorkflow" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "city": "Seattle"
    }
  }')

echo "Alternative Direct Run Response:"
echo "$DIRECT_RESPONSE2"

echo "Direct Run Response:"
echo "$DIRECT_RESPONSE"

# 4. Approach 3: Using watch endpoint
echo -e "\n${BLUE}4. APPROACH 3: Using watch endpoint${NC}"
echo "Creating a run to watch..."
WATCH_CREATE_RESPONSE=$(curl -s -X POST "$API_BASE/workflows/weatherWorkflow/createRun" \
  -H "Content-Type: application/json" \
  -d '{
    "city": "Seattle"
  }')

echo "Watch Create Response:"
echo "$WATCH_CREATE_RESPONSE"

WATCH_RUN_ID=$(echo $WATCH_CREATE_RESPONSE | grep -o '"runId":"[^"]*"' | sed 's/"runId":"//;s/"//')

if [ -z "$WATCH_RUN_ID" ]; then
  echo -e "${RED}Failed to create run for watching${NC}"
else
  echo -e "${GREEN}Created run for watching with ID: $WATCH_RUN_ID${NC}"
  
  # Watch the workflow run (this doesn't wait for completion, just starts watching)
  echo "Starting watch on the workflow run..."
  # Using a 10 second timeout to ensure the command doesn't hang
  WATCH_RESPONSE=$(curl -s -m 10 -X POST "$API_BASE/workflows/weatherWorkflow/watch" \
    -H "Content-Type: application/json" \
    -d "{
      \"runId\": \"$WATCH_RUN_ID\"
    }")
  
  echo "Watch Response:"
  echo "$WATCH_RESPONSE"
fi

# 5. List all runs
echo -e "\n${BLUE}5. Listing all runs${NC}"
RUNS_RESPONSE=$(curl -s -X GET "$API_BASE/workflows/weatherWorkflow/runs")

echo "Runs Response:"
echo "$RUNS_RESPONSE"

echo -e "\n${BLUE}=== Test Complete ===${NC}"
echo "Review the outputs above to determine which approach works best."
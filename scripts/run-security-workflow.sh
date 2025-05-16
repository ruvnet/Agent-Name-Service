#!/bin/bash

# run-security-workflow.sh
# This script runs the security workflow in the sparc-agent

# Define colors for better output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get the script directory for consistent path resolution
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Get Mastra port from PID file if it exists
DEFAULT_PORT=4111
MASTRA_PORT=$DEFAULT_PORT

if [ -f "$SCRIPT_DIR/mastra.pid" ]; then
    PID_INFO=$(cat "$SCRIPT_DIR/mastra.pid")
    PORT_INFO=$(echo "$PID_INFO" | grep -o ':[0-9]*' | sed 's/://')
    if [ -n "$PORT_INFO" ]; then
        MASTRA_PORT=$PORT_INFO
    fi
fi

# Set variables
MASTRA_SERVER="http://localhost:$MASTRA_PORT"

echo -e "${GREEN}=========================================================="
echo "Running Security Workflow for Agent Analysis"
echo -e "==========================================================${NC}"
echo -e "${YELLOW}Using Mastra server at: $MASTRA_SERVER${NC}"
echo

# Agent data for security analysis
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

# Function to check if response contains an error or is valid
check_response() {
    local response=$1
    if [[ "$response" =~ "404" || "$response" =~ "error" || "$response" =~ "Error" ]]; then
        return 1
    fi
    return 0
}

echo "Trying different API endpoint formats..."

# Attempt 1: /api/v1/workflows/[name]/invoke
echo "Attempt 1: Using /api/v1/workflows/[name]/invoke"
RESPONSE=$(curl -X POST "$MASTRA_SERVER/api/v1/workflows/securityWorkflow/invoke" \
  -H "Content-Type: application/json" \
  -d "$AGENT_DATA" \
  -s)
  
if check_response "$RESPONSE"; then
  echo -e "${GREEN}Success with endpoint format 1!${NC}"
  echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
  exit 0
fi

# Attempt 2: /api/workflows/[name]/invoke
echo "Attempt 2: Using /api/workflows/[name]/invoke"
RESPONSE=$(curl -X POST "$MASTRA_SERVER/api/workflows/securityWorkflow/invoke" \
  -H "Content-Type: application/json" \
  -d "$AGENT_DATA" \
  -s)
  
if check_response "$RESPONSE"; then
  echo -e "${GREEN}Success with endpoint format 2!${NC}"
  echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
  exit 0
fi

# Attempt 3: /api/workflows/[name]
echo "Attempt 3: Using /api/workflows/[name]"
RESPONSE=$(curl -X POST "$MASTRA_SERVER/api/workflows/securityWorkflow" \
  -H "Content-Type: application/json" \
  -d "$AGENT_DATA" \
  -s)
  
if check_response "$RESPONSE"; then
  echo -e "${GREEN}Success with endpoint format 3!${NC}"
  echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
  exit 0
fi

# Attempt 4: /workflows/[name]
echo "Attempt 4: Using /workflows/[name]"
RESPONSE=$(curl -X POST "$MASTRA_SERVER/workflows/securityWorkflow" \
  -H "Content-Type: application/json" \
  -d "$AGENT_DATA" \
  -s)
  
if check_response "$RESPONSE"; then
  echo -e "${GREEN}Success with endpoint format 4!${NC}"
  echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
  exit 0
fi

# Attempt 5: /[name]
echo "Attempt 5: Using /[name]"
RESPONSE=$(curl -X POST "$MASTRA_SERVER/securityWorkflow" \
  -H "Content-Type: application/json" \
  -d "$AGENT_DATA" \
  -s)
  
if check_response "$RESPONSE"; then
  echo -e "${GREEN}Success with endpoint format 5!${NC}"
  echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
  exit 0
fi

# Attempt 6: Try agent-security-workflow instead of securityWorkflow
echo "Attempt 6: Using agent-security-workflow name"
RESPONSE=$(curl -X POST "$MASTRA_SERVER/api/v1/workflows/agent-security-workflow/invoke" \
  -H "Content-Type: application/json" \
  -d "$AGENT_DATA" \
  -s)
  
if check_response "$RESPONSE"; then
  echo -e "${GREEN}Success with endpoint format 6!${NC}"
  echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
  exit 0
fi

# If all attempts failed
echo -e "${RED}All API endpoint attempts failed. Response from last attempt:${NC}"
echo "$RESPONSE"

echo -e "${YELLOW}Security workflow completed with errors.${NC}"
echo -e "${YELLOW}Check if the Mastra server is running on port $MASTRA_PORT${NC}"
echo -e "${YELLOW}Run './restart-mastra.sh' to restart the server${NC}"
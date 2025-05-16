#!/bin/bash

# run-all-workflows.sh
# This script runs all available workflows in the sparc-agent

# Define colors for better output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=========================================================="
echo "Running All SPARC Agent Workflows"
echo -e "==========================================================${NC}"
echo

# Make the individual scripts executable if needed
chmod +x ./run-weather-workflow.sh
chmod +x ./run-security-workflow.sh

# Run the weather workflow
echo -e "${YELLOW}Running Weather Workflow${NC}"
echo "----------------------------------------------------------"
./run-weather-workflow.sh "San Francisco"
WEATHER_STATUS=$?
echo

# Run the security workflow
echo -e "${YELLOW}Running Security Workflow${NC}"
echo "----------------------------------------------------------"
./run-security-workflow.sh
SECURITY_STATUS=$?
echo

# Check if both workflows were successful
if [ $WEATHER_STATUS -eq 0 ] && [ $SECURITY_STATUS -eq 0 ]; then
    echo -e "${GREEN}All workflows completed successfully!${NC}"
else
    echo -e "${RED}Some workflows encountered errors.${NC}"
    echo -e "${YELLOW}Check the logs for more information.${NC}"
    
    if [ $WEATHER_STATUS -ne 0 ]; then
        echo -e "${RED}- Weather workflow failed.${NC}"
    fi
    
    if [ $SECURITY_STATUS -ne 0 ]; then
        echo -e "${RED}- Security workflow failed.${NC}"
    fi
    
    echo -e "${YELLOW}You might need to check if the Mastra server is running and accessible.${NC}"
    echo -e "${YELLOW}Use './restart-mastra.sh' to restart the server.${NC}"
fi
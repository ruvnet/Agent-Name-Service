#!/bin/bash

# sparc-workflows.sh
# This script provides options to manage the SPARC agent workflows

# Color definitions
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Clear screen
clear

# Print header
echo -e "${BLUE}=========================================================="
echo -e "             SPARC Agent Workflow Manager"
echo -e "==========================================================${NC}"
echo

# Function to check if Mastra is running
check_mastra_running() {
    if pgrep -f "mastra dev" > /dev/null; then
        echo -e "${GREEN}Mastra server is running.${NC}"
        return 0
    else
        echo -e "${RED}Mastra server is NOT running.${NC}"
        return 1
    fi
}

# Main menu
while true; do
    echo
    echo -e "${YELLOW}Please select an option:${NC}"
    echo "1) Check Mastra server status"
    echo "2) Restart Mastra server"
    echo "3) Run Weather workflow"
    echo "4) Run Security workflow"
    echo "5) Run all workflows"
    echo "q) Quit"
    echo
    
    # Check if Mastra is running
    check_mastra_running
    
    # Get user choice
    read -p "Enter your choice: " choice
    echo
    
    case $choice in
        1)
            check_mastra_running
            ;;
        2)
            echo -e "${YELLOW}Restarting Mastra server...${NC}"
            ./scripts/restart-mastra.sh
            ;;
        3)
            if check_mastra_running; then
                read -p "Enter city name (or press Enter for default 'Seattle'): " city
                city=${city:-Seattle}
                echo -e "${YELLOW}Running Weather workflow for ${city}...${NC}"
                ./scripts/run-weather-workflow.sh "$city"
            else
                echo -e "${RED}Mastra server is not running. Please restart it first.${NC}"
            fi
            ;;
        4)
            if check_mastra_running; then
                echo -e "${YELLOW}Running Security workflow...${NC}"
                ./scripts/run-security-workflow.sh
            else
                echo -e "${RED}Mastra server is not running. Please restart it first.${NC}"
            fi
            ;;
        5)
            if check_mastra_running; then
                echo -e "${YELLOW}Running all workflows...${NC}"
                ./scripts/run-all-workflows.sh
            else
                echo -e "${RED}Mastra server is not running. Please restart it first.${NC}"
            fi
            ;;
        q|Q)
            echo -e "${BLUE}Exiting SPARC Agent Workflow Manager.${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid choice. Please try again.${NC}"
            ;;
    esac
    
    echo
    read -p "Press Enter to continue..."
    clear
    
    # Print header again
    echo -e "${BLUE}=========================================================="
    echo -e "             SPARC Agent Workflow Manager"
    echo -e "==========================================================${NC}"
    echo
done
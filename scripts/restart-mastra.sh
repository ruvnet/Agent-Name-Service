#!/bin/bash

# restart-mastra.sh
# This script kills any running Mastra processes and restarts the Mastra system

# Define colors for better output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "=========================================================="
echo "Restarting Mastra System"
echo "=========================================================="

# Get the absolute path to the project root directory
# This works regardless of where the script is run from
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
SPARC_AGENT_DIR="$PROJECT_ROOT/sparc-agent"
DEFAULT_PORT=4111

# Check if sparc-agent directory exists
if [ ! -d "$SPARC_AGENT_DIR" ]; then
    echo -e "${RED}Error: sparc-agent directory not found at $SPARC_AGENT_DIR${NC}"
    exit 1
fi

# Ask for port or use default
read -p "Enter port for Mastra server (default: $DEFAULT_PORT): " port
MASTRA_PORT=${port:-$DEFAULT_PORT}

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -i:"$port" -t &>/dev/null; then
        return 0 # Port is in use
    else
        return 1 # Port is free
    fi
}

# Function to kill process using a specific port
kill_process_on_port() {
    local port=$1
    local pids=($(lsof -i:"$port" -t 2>/dev/null))
    
    if [ ${#pids[@]} -eq 0 ]; then
        echo -e "${YELLOW}No processes found using port $port${NC}"
        return 1
    fi
    
    echo -e "${YELLOW}Found ${#pids[@]} processes using port $port: ${pids[*]}${NC}"
    
    for pid in "${pids[@]}"; do
        echo -e "${YELLOW}Killing process $pid using port $port...${NC}"
        kill "$pid" 2>/dev/null
    done
    
    sleep 2
    
    # Check if processes are still running
    local still_running=()
    for pid in "${pids[@]}"; do
        if ps -p "$pid" &>/dev/null; then
            still_running+=("$pid")
        fi
    done
    
    if [ ${#still_running[@]} -gt 0 ]; then
        echo -e "${YELLOW}Some processes are still running. Trying SIGKILL...${NC}"
        for pid in "${still_running[@]}"; do
            echo -e "${YELLOW}Force killing process $pid...${NC}"
            kill -9 "$pid" 2>/dev/null
        done
        sleep 2
    fi
    
    return 0
}

# Function to find a free port starting from the given port
find_free_port() {
    local port=$1
    local max_attempts=10
    local attempts=0
    
    while check_port "$port" && [ $attempts -lt $max_attempts ]; do
        port=$((port + 1))
        attempts=$((attempts + 1))
    done
    
    if [ $attempts -eq $max_attempts ]; then
        echo -e "${RED}Could not find a free port after $max_attempts attempts${NC}"
        return 1
    fi
    
    echo "$port"
    return 0
}

# Kill processes in multiple ways to ensure we catch everything
echo -e "${YELLOW}Stopping any running Mastra processes...${NC}"

# 1. Kill by searching for "mastra dev" in process list
pkill -f "mastra dev" 2>/dev/null || echo "No processes found matching 'mastra dev'"

# 2. Kill process using specified port
if check_port "$MASTRA_PORT"; then
    echo -e "${YELLOW}Port $MASTRA_PORT is in use. Killing the process...${NC}"
    kill_process_on_port "$MASTRA_PORT"
else
    echo -e "${GREEN}Port $MASTRA_PORT is available.${NC}"
fi

# Wait for processes to terminate
sleep 2

# Check if port is still in use
port_status=0
if check_port "$MASTRA_PORT"; then
    echo -e "${RED}Warning: Port $MASTRA_PORT is still in use after termination attempts.${NC}"
    echo -e "${YELLOW}You have several options:${NC}"
    echo "1) Try to force kill again"
    echo "2) Use a different port"
    echo "3) Continue anyway (may fail)"
    echo "4) Exit"
    
    read -p "Enter your choice (1-4): " choice
    
    case $choice in
        1)
            echo -e "${YELLOW}Attempting forceful termination again...${NC}"
            kill_process_on_port "$MASTRA_PORT"
            if check_port "$MASTRA_PORT"; then
                echo -e "${RED}Port $MASTRA_PORT is still in use.${NC}"
                echo -e "${YELLOW}To manually check processes using this port, run: lsof -i:$MASTRA_PORT${NC}"
            else
                echo -e "${GREEN}Port $MASTRA_PORT is now available.${NC}"
            fi
            ;;
        2)
            free_port=$(find_free_port $((MASTRA_PORT + 1)))
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}Found free port: $free_port${NC}"
                MASTRA_PORT=$free_port
                port_status=1
            else
                echo -e "${RED}Failed to find a free port. Exiting.${NC}"
                exit 1
            fi
            ;;
        3)
            echo -e "${YELLOW}Continuing anyway...${NC}"
            port_status=2
            ;;
        4)
            echo -e "${RED}Exiting.${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid choice. Exiting.${NC}"
            exit 1
            ;;
    esac
fi

# Restart the Mastra server
echo -e "${YELLOW}Starting Mastra server on port $MASTRA_PORT...${NC}"
echo -e "Using sparc-agent directory: ${GREEN}$SPARC_AGENT_DIR${NC}"

# Use PORT environment variable to override default port
cd "$SPARC_AGENT_DIR" && \
    PORT="$MASTRA_PORT" \
    NODE_OPTIONS="--dns-result-order=ipv4first" \
    nohup npx mastra dev > "mastra_port_${MASTRA_PORT}.log" 2>&1 &

# Store the PID of the Mastra server
MASTRA_PID=$!
echo -e "${GREEN}Mastra server started with PID: $MASTRA_PID${NC}"

# Wait for the server to initialize
echo -e "${YELLOW}Waiting for Mastra server to initialize...${NC}"
sleep 5

# Check if the server is running
if ps -p $MASTRA_PID > /dev/null; then
    echo -e "${GREEN}Mastra server is running on port $MASTRA_PORT.${NC}"
    echo -e "${YELLOW}To stop the server later, run: kill $MASTRA_PID${NC}"
    
    # Create a PID file with port info for future reference
    echo "$MASTRA_PID:$MASTRA_PORT" > "$SCRIPT_DIR/mastra.pid"
    
    # Update workflow scripts with the current port if it's not the default
    if [ "$MASTRA_PORT" != "$DEFAULT_PORT" ]; then
        echo -e "${YELLOW}Updating workflow scripts to use port $MASTRA_PORT...${NC}"
        for script in "$SCRIPT_DIR"/run-*.sh; do
            sed -i "s/MASTRA_SERVER=\"http:\/\/localhost:[0-9]*\"/MASTRA_SERVER=\"http:\/\/localhost:$MASTRA_PORT\"/g" "$script"
        done
        echo -e "${GREEN}Workflow scripts updated.${NC}"
    fi
else
    echo -e "${RED}Failed to start Mastra server. Check logs for errors.${NC}"
    echo -e "${YELLOW}See log file: $SPARC_AGENT_DIR/mastra_port_${MASTRA_PORT}.log${NC}"
fi

echo "=========================================================="
echo -e "${GREEN}Available Workflows:${NC}"
echo "- weatherWorkflow: Weather forecast and activity suggestions"
echo "- securityWorkflow: Agent security analysis"
echo "=========================================================="
echo -e "${YELLOW}To run workflows, use the scripts in the 'scripts/' directory:${NC}"
echo "- ./scripts/run-weather-workflow.sh [city]"
echo "- ./scripts/run-security-workflow.sh"
echo "- ./scripts/run-all-workflows.sh"
echo "- ./scripts/sparc-workflows.sh (Interactive menu)"
echo -e "${YELLOW}All workflow scripts will use port $MASTRA_PORT${NC}"
echo "=========================================================="
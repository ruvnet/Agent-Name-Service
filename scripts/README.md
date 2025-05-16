# SPARC Agent Workflow Scripts

This directory contains scripts to manage and run different workflows in the SPARC agent.

## Available Scripts

### Main Scripts

- `sparc-workflows.sh` - Interactive menu to manage SPARC agent workflows
- `restart-mastra.sh` - Kill and restart the Mastra server
- `run-all-workflows.sh` - Run all available workflows

### Individual Workflow Scripts

- `run-weather-workflow.sh` - Run the weather forecast workflow
- `run-security-workflow.sh` - Run the agent security analysis workflow

## Usage

### Interactive Menu

For the most user-friendly experience, use the interactive menu:

```bash
./scripts/sparc-workflows.sh
```

This will present options to:
- Check Mastra server status
- Restart the Mastra server
- Run individual workflows
- Run all workflows

### Managing the Mastra Server

To stop and restart the Mastra server:

```bash
./scripts/restart-mastra.sh
```

### Running Individual Workflows

#### Weather Workflow

To run the weather workflow with a specific city:

```bash
./scripts/run-weather-workflow.sh "San Francisco"
```

Or use the default city (Seattle):

```bash
./scripts/run-weather-workflow.sh
```

#### Security Workflow

To run the security workflow with default agent data:

```bash
./scripts/run-security-workflow.sh
```

### Running All Workflows

To run all available workflows:

```bash
./scripts/run-all-workflows.sh
```

## Workflow Details

### Weather Workflow

The weather workflow:
1. Takes a city name as input
2. Fetches weather data for that city
3. Provides activity suggestions based on the forecast

### Security Workflow

The security workflow:
1. Takes agent data as input (name, metadata, capabilities, etc.)
2. Analyzes the agent for potential security threats
3. Provides a detailed security analysis report

## Troubleshooting

If you encounter any issues:

1. Make sure the Mastra server is running. Check with:
   ```bash
   ps aux | grep "mastra dev"
   ```

2. If the server is not running, restart it:
   ```bash
   ./scripts/restart-mastra.sh
   ```

3. Check if the correct API endpoints are being used in the workflow scripts. If needed, update the endpoint URLs in the respective scripts.
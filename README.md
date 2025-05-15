# Agent Name Service (ANS)

A secure registry for AI agents based on the [OWASP GenAI Security Project's](https://genai.owasp.org/) Agent Name Service (ANS) Protocol. ANS provides a foundational framework for secure discovery and interaction among AI agents.

## Overview

The Agent Name Service is a centralized registry that enables:

- **Agent Registration**: Securely register AI agents with unique identifiers and capabilities
- **Certificate Management**: Issue and validate agent certificates for secure communications
- **Discovery**: Resolve agent information in both A2A and MCP formats
- **Security Analysis**: Integrate with Mastra.ai for threat modeling and security assessment

ANS bridges the gap between different agent communication protocols, allowing seamless interoperability between agents using Google's Agent-to-Agent (A2A) protocol and Anthropic's Model Context Protocol (MCP).

## Features

- **Secure Registration**: Register agents with unique names and capabilities with certificate generation
- **Multi-Protocol Support**: Resolve agents in both A2A and MCP protocol formats
- **Integrated Threat Analysis**: Security analysis using Mastra.ai integration
- **Lightweight Storage**: SQLite persistence layer for easy deployment
- **Modular Architecture**: Clean separation of concerns for extensibility

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/agent-name-service.git
cd agent-name-service

# Install dependencies
npm install
```

## Usage

### Basic Initialization

```typescript
import { AgentNamingService } from './src/ans';

// Initialize the ANS service
const ans = new AgentNamingService();
```

### Registering an Agent

```typescript
// Register an agent
const result = await ans.registerAgent('my-agent', {
  version: '1.0.0',
  capabilities: ['text-generation', 'summarization'],
  description: 'AI assistant for content creation',
  provider: 'OpenAI',
  model: 'gpt-4',
  endpoints: [
    {
      protocol: 'https',
      address: 'api.myagent.com',
      port: 443
    }
  ]
});

// The result contains the agent card and a threat report
console.log(result.agentCard);
console.log(result.threatReport);

// Log security assessment
if (result.threatReport.threatsDetected) {
  console.log('Security threats detected:');
  console.log(`- Threat Score: ${result.threatReport.threatScore}`);
  console.log(`- Severity: ${result.threatReport.severity}`);
  console.log(`- Threats: ${result.threatReport.detectedThreats.join(', ')}`);
  console.log(`- Recommended Actions: ${result.threatReport.recommendedActions.join(', ')}`);
}
```

### Complete Registration Example

Here's a more complete example showing agent registration with security handling:

```typescript
import { AgentNamingService } from './src/ans';

async function registerAgent() {
  try {
    // Initialize the ANS service
    const ans = new AgentNamingService();
    console.log('Agent Name Service initialized successfully.');

    // Define agent metadata
    const agentMetadata = {
      version: '1.0.0',
      capabilities: ['data-processing', 'analysis'],
      description: 'Utility agent for data processing tasks',
      provider: 'Example Corp',
      model: 'utility-model-v1',
      endpoints: [
        { protocol: 'https', address: 'api.example.com', port: 443 }
      ]
    };

    // Register the agent
    console.log(`Registering agent: basic-utility-agent`);
    const result = await ans.registerAgent('basic-utility-agent', agentMetadata);
    
    // Display results
    console.log('\n=== Registration Result ===');
    console.log(`Agent Name: ${result.agentCard.certificate.subject.CN}`);
    console.log(`Registration Status: ${result.success ? 'Success' : 'Failed'}`);
    
    console.log('\n=== Certificate Preview ===');
    // Show just the beginning of the certificate for brevity
    const certLines = result.agentCard.certificate.toString().split('\n');
    console.log(certLines.slice(0, 10).join('\n') + '\n...');
    
    console.log('\n=== Security Assessment ===');
    console.log(`Threat Score: ${result.threatReport.threatScore}`);
    console.log(`Severity: ${result.threatReport.severity}`);
    console.log(`Detected Threats: ${result.threatReport.detectedThreats.join(', ')}`);
    
    return result;
  } catch (error) {
    console.error('Error registering agent:', error);
    throw error;
  }
}

// Execute the registration
registerAgent()
  .then(() => console.log('Agent registration completed successfully.'))
  .catch(console.error);
```

### Resolving an Agent

```typescript
// Resolve an agent by name
const agentCard = await ans.resolveAgent('my-agent');

if (agentCard) {
  console.log('Agent found:', agentCard);
} else {
  console.log('Agent not found');
}
```

### Generating MCP Manifest

```typescript
// Generate an MCP manifest for the agent
const mcpManifest = ans.generateMCPManifest('my-agent', {
  tools: [
    {
      name: 'generate_content',
      description: 'Generate text content based on a prompt',
      parameters: {
        prompt: {
          type: 'string',
          description: 'Input prompt for text generation'
        }
      }
    }
  ]
});

console.log(mcpManifest);
```

## Examples

### Comprehensive Example

The [examples/usage.ts](examples/usage.ts) file demonstrates:

- Initializing the ANS service
- Registering multiple agents with different capabilities
- Resolving agents
- Examining threat analysis results
- Generating MCP manifests

Run it with:

```bash
npx ts-node examples/usage.ts
```

### Basic Agent Registration

For a simpler example showing just the registration process, see [examples/basic_registration.ts](examples/basic_registration.ts):

```bash
npx ts-node examples/basic_registration.ts
```

This example demonstrates:
- Basic ANS service initialization
- Registering a simple utility agent
- Handling the registration response
- Examining the security assessment

## Configuration

### Environment Setup

The ANS service can be configured using environment variables. Create a `.env` file in the root directory:

```bash
# Database Configuration
DB_PATH=./agent_registry.db

# Certificate Authority Configuration
CA_NAME="ANS Root CA"
CA_ORG="Agent Name Service"
CERT_VALIDITY_DAYS=365

# Security Configuration
ENABLE_THREAT_ANALYSIS=true
MASTRA_ENDPOINT=http://0.0.0.0:4111
```

### Mastra.ai Integration

The ANS service integrates with Mastra.ai for advanced threat modeling and security analysis. Two options are available:

1. **Mastra.ai Service** - If you have a Mastra service running locally (default: http://0.0.0.0:4111), ANS will use it for security analysis.

2. **Simplified Integration** - A lightweight implementation (via `mastra-simple.ts`) is provided for environments without access to the full Mastra service.

## Project Structure

```
.
├── src/                      # Source files
│   ├── ans.ts                # Core ANS service
│   ├── certificate.ts        # Certificate generation and validation
│   ├── db.ts                 # Database layer for agent registry
│   ├── mastra.ts             # Full threat modeling integration
│   ├── mastra-simple.ts      # Simplified threat modeling (fallback)
│   ├── protocols.ts          # Protocol formatters (A2A and MCP)
│   └── types/                # TypeScript type definitions
├── tests/                    # Test files
├── examples/                 # Usage examples
│   ├── usage.ts              # Complete example of ANS usage
│   └── basic_registration.ts # Simple registration example
├── docs/                     # Documentation
│   ├── architecture/         # Architecture documentation
│   ├── pseudocode/           # Development pseudocode
│   └── requirements/         # Project requirements
├── mod.ts                    # Entry point module
├── package.json              # Project dependencies
└── README.md                 # Project documentation
```

## Core Components

### 1. Agent Registry (src/db.ts)

The database layer provides persistent storage for agent records using SQLite:

- `saveAgent()`: Store agent information
- `getAgentCard()`: Retrieve an agent by name

### 2. Certificate Service (src/certificate.ts)

Mock X.509 certificate generator for agent identity:

- `issueCertificate()`: Generate a certificate for an agent

### 3. Protocol Formatters (src/protocols.ts)

Format agent information for different protocols:

- `formatAgentCard()`: Format agent data as an A2A Agent Card
- `formatMCPManifest()`: Format agent data as an MCP manifest

### 4. Threat Modeling (src/mastra.ts and src/mastra-simple.ts)

Security analysis integration with Mastra.ai:

- `analyzeAgentSecurity()`: Analyze agent metadata for security threats
- `performLocalAnalysis()`: Fallback analysis when Mastra.ai is unavailable
- Enhanced threat pattern detection for agent names, capabilities, and metadata

### 5. ANS Service (src/ans.ts)

The main service that ties everything together:

- `registerAgent()`: Register a new agent
- `resolveAgent()`: Look up an agent by name
- `generateMCPManifest()`: Generate MCP manifest for an agent

## Security Considerations

The Agent Name Service includes several security features:

- **Certificate-based Identity**: Each agent gets a unique certificate
- **Threat Analysis**: Integration with Mastra.ai for security assessment
- **Validation**: Input validation for agent registration
- **Secure Resolution**: Secure protocol for agent discovery

## Troubleshooting

### Mastra Integration Issues

If you encounter issues with the Mastra.ai integration:

1. **Verify Mastra Service**: Check if the Mastra service is running on your configured endpoint:
   ```bash
   curl http://0.0.0.0:4111/api/health
   ```

2. **Use Simplified Integration**: The system automatically falls back to the simplified version if the Mastra service is unavailable.

3. **Check Workflow Configuration**: If using a custom Mastra deployment, verify the security workflow is properly configured:
   ```bash
   curl http://0.0.0.0:4111/api/workflows
   ```

4. **Debug Mode**: Set `DEBUG=ans:*` environment variable for detailed logging:
   ```bash
   DEBUG=ans:* npx ts-node examples/usage.ts
   ```

### Common Issues

- **Certificate Generation Failures**: Ensure the CA configuration in your .env file is correct
- **Missing Module Errors**: Verify all dependencies are installed with `npm install`
- **Type Errors**: Make sure you're using TypeScript 4.5+ and have all required type definitions

## Testing

Run the tests using Jest:

```bash
npm test
```

For specific test suites:

```bash
npm test -- --testPathPattern=certificate
npm test -- --testPathPattern=core
npm test -- --testPathPattern=security
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- OWASP GenAI Security Project for the ANS Protocol specification
- Google's Agent-to-Agent (A2A) Protocol
- Anthropic's Model Context Protocol (MCP)
- Mastra.ai for threat modeling capabilities


[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
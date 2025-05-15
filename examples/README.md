# Agent Name Service (ANS) Examples

This directory contains examples demonstrating various features and use cases of the Agent Name Service (ANS). These examples are designed to help you understand how to use ANS in your applications.

## Running the Examples

All examples can be run using the TypeScript Node.js executor:

```bash
npx ts-node examples/<example-name>.ts
```

Each example includes a `--quiet` flag option to suppress verbose debugging logs:

```bash
npx ts-node examples/<example-name>.ts --quiet
```

## Available Examples

| Example | Description | Command |
|---------|-------------|---------|
| [Basic Registration](./basic_registration.ts) | Demonstrates how to register a single agent with ANS and view its certificate. | `npx ts-node examples/basic_registration.ts` |
| [Certificate Verification](./certificate_verification.ts) | Shows certificate validation, including checking legitimate and tampered certificates. | `npx ts-node examples/certificate_verification.ts` |
| [Batch Operations](./batch_operations.ts) | Demonstrates registering and resolving multiple agents in batch, with security filtering. | `npx ts-node examples/batch_operations.ts` |
| [Custom Configuration](./custom_configuration.ts) | Shows how to use custom configuration options for ANS, including name validation and rate limiting. | `npx ts-node examples/custom_configuration.ts` |
| [Complete Usage](./usage.ts) | A comprehensive example showing all main features of ANS. | `npx ts-node examples/usage.ts` |
| [Quiet Examples](./quiet_examples.ts) | A demonstration of running ANS with minimal logging output. | `npx ts-node examples/quiet_examples.ts` |

## Example Utilities

| Utility | Description |
|---------|-------------|
| [Quiet Logging](./utils/quiet-logging.ts) | Utility functions to suppress verbose logs for cleaner example output. |

## Features Demonstrated

Through these examples, you'll learn how to:

1. **Initialize the ANS Service**
   - Create an ANS instance with default configuration
   - Apply custom configuration settings

2. **Manage Agent Registration**
   - Register agents with various capabilities
   - Handle certificates
   - Understand security assessments

3. **Certificate Validation**
   - Validate certificates against the ANS trust chain
   - Detect tampered or invalid certificates

4. **Security Analysis**
   - Interpret threat scores and security events
   - Filter agents based on security criteria

5. **Batch Processing**
   - Register multiple agents efficiently
   - Process sets of agents in parallel

6. **MCP Integration**
   - Generate Model Context Protocol (MCP) manifests
   - Format agent information for MCP compatibility

## Error Handling

Examples include proper error handling and verbose logging. You'll notice messages like "Mastra import failed..." or "Using fallback analysis..." in the output. These are expected behaviors in a development environment and show how ANS gracefully handles missing components.

To suppress these messages, use the `--quiet` flag with any example.

## Notes on Implementation

- Examples use in-memory storage for simplicity
- Security analysis falls back to a local implementation when Mastra is unavailable
- All examples automatically exit after completion (using `process.exit()`)
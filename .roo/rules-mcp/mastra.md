# Mastra MCP Integration Guide

## Overview

[Mastra](https://mastra.ai) provides MCP (Model Context Protocol) integration through its documentation server and tooling. This guide covers how to use Mastra's MCP server, its available tools, and best practices for integration.

## Available Tools

Mastra's MCP server provides the following tools:

### 1. mastraBlog

Get Mastra.ai blog content.

**Description**: Without a URL, returns a list of all blog posts. With a URL, returns the specific blog post content in markdown format. The blog contains changelog posts as well as announcements and posts about Mastra features and AI news.

**Parameters**:
- `url` (required): URL of a specific blog post to fetch. If the string "/blog" is passed as the url, it returns a list of all blog posts.

**Example**:
```xml
<use_mcp_tool>
  <server_name>mastra</server_name>
  <tool_name>mastraBlog</tool_name>
  <arguments>
    {
      "url": "/blog/why-were-all-in-on-mcp"
    }
  </arguments>
</use_mcp_tool>
```

### 2. mastraDocs

Get Mastra.ai documentation.

**Description**: Request paths to explore the docs. References contain API docs. Other paths contain guides. If the user asks about a feature, check general docs as well as reference docs for that feature (e.g., with evals check in evals/ and in reference/evals/). Provide code examples for better understanding. Note that docs about MCP are currently in reference/tools/.

**Parameters**:
- `paths` (required): One or more documentation paths to fetch

**Available Paths**:
- Top-level directories: 
  - agents/
  - community/
  - deployment/
  - evals/
  - frameworks/
  - getting-started/
  - local-dev/
  - mastra-cloud/
  - memory/
  - observability/
  - rag/
  - reference/
  - storage/
  - tools-mcp/
  - voice/
  - workflows-vnext/
  - workflows/
- Reference subdirectories:
  - reference/agents/
  - reference/cli/
  - reference/client-js/
  - reference/core/
  - reference/deployer/
  - reference/evals/
  - reference/memory/
  - reference/networks/
  - reference/observability/
  - reference/rag/
  - reference/storage/
  - reference/tools/
  - reference/voice/
  - reference/workflows/
- Files:
  - index.mdx

**Example**:
```xml
<use_mcp_tool>
  <server_name>mastra</server_name>
  <tool_name>mastraDocs</tool_name>
  <arguments>
    {
      "paths": ["tools-mcp/", "reference/tools/"]
    }
  </arguments>
</use_mcp_tool>
```

### 3. mastraExamples

Get code examples from the Mastra.ai examples directory.

**Description**: Without a specific example name, lists all available examples. With an example name, returns the full source code of that example.

**Parameters**:
- `example` (optional): Name of the specific example to fetch. If not provided, lists all available examples.

**Available Examples**:
a2a, agent, agent-network, ai-sdk-useChat, assistant-ui, bird-checker-with-express, bird-checker-with-nextjs, bird-checker-with-nextjs-and-eval, client-side-tools, crypto-chatbot, fireworks-r1, mcp-configuration, mcp-registry-registry, memory-todo-agent, memory-with-context, memory-with-libsql, memory-with-mem0, memory-with-pg, memory-with-processors, memory-with-upstash, openapi-spec-writer, quick-start, stock-price-tool, weather-agent, workflow-ai-recruiter, workflow-with-inline-steps, workflow-with-memory, workflow-with-separate-steps

**Example**:
```xml
<use_mcp_tool>
  <server_name>mastra</server_name>
  <tool_name>mastraExamples</tool_name>
  <arguments>
    {
      "example": "mcp-configuration"
    }
  </arguments>
</use_mcp_tool>
```

### 4. mastraChanges

Get changelog information for Mastra.ai packages.

**Description**: Retrieve detailed changelog information for Mastra packages, including recent updates, bug fixes, and feature additions.

**Parameters**:
- `package` (optional): Name of the specific package to fetch changelog for. If not provided, lists all available packages.

**Available Packages**:
@internal/storage-test-utils, @mastra/astra, @mastra/chroma, @mastra/clickhouse, @mastra/client-js, @mastra/cloud, @mastra/cloudflare, @mastra/cloudflare-d1, @mastra/core, @mastra/couchbase, @mastra/deployer, @mastra/deployer-cloudflare, @mastra/deployer-netlify, @mastra/deployer-vercel, @mastra/evals, @mastra/fastembed, @mastra/firecrawl, @mastra/github, @mastra/libsql, @mastra/loggers, @mastra/mcp, @mastra/mcp-docs-server, @mastra/mcp-registry-registry, @mastra/mem0, @mastra/memory, @mastra/mongodb, @mastra/opensearch, @mastra/pg, @mastra/pinecone, @mastra/playground-ui, @mastra/qdrant, @mastra/rag, @mastra/ragie, @mastra/server, @mastra/speech-azure, @mastra/speech-deepgram, @mastra/speech-elevenlabs, @mastra/speech-google, @mastra/speech-ibm, @mastra/speech-murf, @mastra/speech-openai, @mastra/speech-playai, @mastra/speech-replicate, @mastra/speech-speechify, @mastra/turbopuffer, @mastra/upstash, @mastra/vectorize, @mastra/voice-azure, @mastra/voice-cloudflare, @mastra/voice-deepgram, @mastra/voice-elevenlabs, @mastra/voice-google, @mastra/voice-murf, @mastra/voice-openai, @mastra/voice-openai-realtime, @mastra/voice-playai, @mastra/voice-sarvam, @mastra/voice-speechify, create-mastra, mastra

**Example**:
```xml
<use_mcp_tool>
  <server_name>mastra</server_name>
  <tool_name>mastraChanges</tool_name>
  <arguments>
    {
      "package": "@mastra/mcp"
    }
  </arguments>
</use_mcp_tool>
```

## Installation and Configuration

### Installing the Mastra MCP Server

```bash
# Using NPM
npm install -g @mastra/mcp-docs-server

# Using PNPM
pnpm add -g @mastra/mcp-docs-server

# Using Yarn
yarn global add @mastra/mcp-docs-server
```

### Configuring in Code Projects

Add the Mastra MCP server to your project using:

```json
{
  "mcpServers": {
    "mastra": {
      "command": "npx",
      "args": [
        "-y",
        "@mastra/mcp-docs-server@latest"
      ],
      "alwaysAllow": [
        "mastraDocs",
        "mastraExamples",
        "mastraBlog",
        "mastraChanges"
      ]
    }
  }
}
```

## Integration with Mastra

Mastra provides two main ways to work with MCP:

### 1. Using MCPClient (Recommended)

The `MCPClient` class allows for managing multiple MCP server connections:

```typescript
import { MCPClient } from "@mastra/mcp";

const mcp = new MCPClient({
  servers: {
    // Mastra documentation server
    mastra: {
      command: "npx",
      args: ["-y", "@mastra/mcp-docs-server@latest"],
    },
    // Other MCP servers...
  },
});

// Get available toolsets
const toolsets = await mcp.getToolsets();

// Use with an agent
const response = await agent.stream(prompt, { toolsets });
```

### 2. Using MastraMCPClient for Single Server Connection

For connecting to a single MCP server:

```typescript
import { MastraMCPClient } from "@mastra/mcp";

// Connect to Mastra docs server
const client = new MastraMCPClient({
  name: "mastra-docs",
  server: {
    command: "npx",
    args: ["-y", "@mastra/mcp-docs-server@latest"],
  },
});

// Connect to the server
await client.connect();

// Get available tools
const tools = await client.tools();

// Use with an agent
const response = await agent.stream(prompt, {
  toolsets: { mastraDocs: tools },
});

// Always disconnect when done
await client.disconnect();
```

## Best Practices for Mastra MCP Integration

1. **Be concise with queries**: Mastra's documentation server works best with specific, targeted queries rather than open-ended questions

2. **Cache responses when appropriate**: For frequently accessed documentation or unchanging content

3. **Install appropriate packages**: If you see examples with imports like `import { X } from "@mastra/$PACKAGE_NAME"`, install the latest version:
   ```bash
   pnpm add @mastra/$PACKAGE_NAME@latest
   ```

4. **Prefer latest versions**: Always use the latest tagged version unless explicitly required to use alpha/beta versions

5. **Verify package installation**: Ensure required packages are installed before executing examples

6. **Focus on relevant documentation paths**: Query only the necessary documentation paths rather than fetching everything

## Troubleshooting

### Common Issues

1. **Tool not found**: Ensure the Mastra MCP server is properly installed and running
   ```bash
   npx -y @mastra/mcp-docs-server@latest
   ```

2. **Outdated documentation**: The Mastra ecosystem evolves rapidly; always check package changelogs to ensure compatibility

3. **Missing dependencies**: When implementing examples, ensure all required packages are installed

4. **Connection failures**: Verify network connection and try restarting the MCP server

### Error Handling

Always implement proper error handling when working with MCP tools:

```typescript
try {
  const result = await useMCPTool("mastra", "mastraDocs", { 
    paths: ["tools-mcp/"] 
  });
  // Process result
} catch (error) {
  console.error("Error accessing Mastra documentation:", error);
  // Implement fallback mechanism or retry logic
}
```

## Related Resources

- [Mastra Documentation](https://docs.mastra.ai)
- [MCP Registry Registry](https://registry.mastra.ai)
- [GitHub Repository](https://github.com/mastra-ai/mastra)
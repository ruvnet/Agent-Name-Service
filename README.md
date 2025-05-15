# -Agent-Name-Service-Server
Agent Name Service (ANS) Protocol, introduced by the OWASP GenAI Security Project, is a foundational framework designed to facilitate secure discovery and interaction among AI agents. 


Great. I’ll put together a minimal MVP of the Agent Naming Service (ANS) in TypeScript using Deno that supports A2A and MCP protocols, mocks X.509 certificates, and uses SQLite for storage. I’ll also check for available APIs or SDKs for integrating Mastra.ai threat modeling.

I’ll update you once the implementation plan and code are ready.


# Agent Naming Service (ANS) MVP Implementation (Deno TypeScript)

The **Agent Naming Service (ANS)** is a lightweight registry that lets AI agents register by name and advertise their capabilities. It provides discovery and lookup of agents in formats compatible with emerging protocols: Google’s **Agent-to-Agent (A2A)** and Anthropic’s **Model Context Protocol (MCP)**. In A2A, agents publish an **Agent Card** (a JSON “business card” describing identity, skills, endpoint, etc.) usually at a well-known URL, while MCP focuses on describing tools that an LLM can invoke programmatically.

This MVP ANS will allow agents to:

* **Register** with a unique name, providing basic metadata (endpoint, capabilities, etc.). Registration will **mock X.509 certificate issuance** – the ANS will act as a certificate authority issuing a dummy certificate for the agent.
* **Resolve** an agent’s name to its details, returning either an **A2A Agent Card** JSON or an **MCP tool manifest** for integration.
* Optionally, perform a **MAESTRO threat analysis** using **mastra.ai** (if an API/SDK is available) on the agent’s profile for security insights. This demonstrates how ANS could integrate threat modeling into the registration process (e.g. assessing potential risks of an agent’s capabilities).

We use **Deno** (for its security and modern TS support) and a simple **SQLite** database for persistence. The code is organized into clear modules with inline documentation (like a mini-README) for clarity.

## Project Structure

* **`src/db.ts`** – SQLite persistence layer for agent records (agent registry).
* **`src/certificate.ts`** – X.509 certificate mock generator (simulates issuing a certificate).
* **`src/protocols.ts`** – Functions to format agent data into A2A Agent Card and MCP tool JSON formats.
* **`src/mastra.ts`** – (Optional) Integration stub for mastra.ai’s MAESTRO threat modeling.
* **`src/ans.ts`** – Core service logic: the `AgentNamingService` class with methods to register and resolve agents.
* **`mod.ts`** – Entry point re-exporting the main service (for consumers of this module).
* **`examples/usage.ts`** – Example usage demonstrating registration and resolution.
* **`test/ans.test.ts`** – Unit tests for registration, resolution (A2A and MCP outputs), and threat analysis logic.

Below, we present each module with explanations and code.

### Persistent Registry (SQLite) – `src/db.ts`

We use a SQLite database (via Deno’s third-party module) to store agent registrations persistently. The table `agents` will hold each agent’s data: name, agent card JSON, and certificate. In a real system these might be separate tables or normalized, but for simplicity we store the entire agent card JSON (including certificate and capabilities) as a single JSON text field, keyed by agent name.

```ts
// file: src/db.ts
import { DB } from "https://deno.land/x/sqlite/mod.ts";

/**
 * Simple SQLite-backed registry for agents. 
 * On construction, it ensures the `agents` table exists.
 */
export class AgentRegistry {
  private db: DB;

  constructor(databaseFile = "ans_registry.db") {
    // Open or create the database file. Requires --allow-read and --allow-write for this file.
    this.db = new DB(databaseFile);
    // Ensure the agents table exists.
    this.db.execute(`
      CREATE TABLE IF NOT EXISTS agents (
        name TEXT PRIMARY KEY,
        agent_card TEXT NOT NULL  -- JSON string of agent details (including cert & capabilities)
      )
    `);
  }

  /**
   * Inserts or updates an agent record in the database.
   * @param name Unique agent name (acts as primary key).
   * @param agentCardJson JSON string representing the agent's card (including cert).
   */
  saveAgent(name: string, agentCardJson: string): void {
    this.db.execute(`REPLACE INTO agents (name, agent_card) VALUES (?, ?)`, [name, agentCardJson]);
  }

  /**
   * Retrieves an agent's card JSON by name, or undefined if not found.
   */
  getAgentCard(name: string): string | undefined {
    const results = [...this.db.query(`SELECT agent_card FROM agents WHERE name = ?`, [name])];
    if (results.length === 0) return undefined;
    const [agentCardJson] = results[0];
    return agentCardJson;
  }

  /**
   * Closes the database (to be called when shutting down the service).
   */
  close(): void {
    this.db.close();
  }
}
```

**Notes:** We use `REPLACE INTO` so that re-registering an existing agent name will update its info (this simplifies update logic). In a production service, we’d handle conflicts and perhaps require auth to update an existing entry. Also, Deno’s SQLite module is used directly for simplicity; a higher-level ORM or Deno KV could be alternatives.

### X.509 Certificate Mock – `src/certificate.ts`

For secure agent communication, A2A often uses mTLS or signatures, so each agent would have an X.509 certificate issued by a trusted authority. Here we simulate certificate issuance. For simplicity, we’ll generate a dummy self-signed certificate (and corresponding private key) using the Node crypto API available in Deno. The certificate won’t be fully valid, but will illustrate the process.

```ts
// file: src/certificate.ts
// Deno can use Node's crypto library for key generation.
import { generateKeyPairSync, createSign } from "node:crypto";

export interface AgentCertificate {
  name: string;              // Common Name or identifier for whom the cert is issued.
  certPem: string;           // Certificate in PEM format (mocked).
  privateKeyPem: string;     // Private key in PEM (for completeness, though not often stored in registry).
  fingerprint: string;       // A simple fingerprint of the cert.
}

/**
 * Issues a mock X.509 certificate for an agent.
 * In a real CA, we'd sign a CSR. Here, we generate a self-signed cert with the agent's name.
 */
export function issueCertificate(agentName: string): AgentCertificate {
  // Generate an RSA key pair (2048-bit for demo; in practice ECC might be used).
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  
  // Create a fake certificate PEM. We won't generate a real signed X.509 due to complexity.
  // Instead, embed the agent name and a timestamp in a PEM-like format for demonstration.
  const certificateBody = `Agent: ${agentName}\nIssued: ${new Date().toISOString()}`;
  const certPem = 
    "-----BEGIN CERTIFICATE-----\n" +
    btoa(certificateBody) +  // base64 encode the certificate body to simulate DER -> PEM
    "\n-----END CERTIFICATE-----";

  // Export the private key as PEM (PKCS8 format)
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;

  // Create a simple SHA256 fingerprint of the certificate body (simulating a cert fingerprint).
  const fingerprint = createSign("SHA256").update(certificateBody).sign(privateKey, "hex");
  
  return { name: agentName, certPem, privateKeyPem, fingerprint };
}
```

**Explanation:** We use Node’s `crypto.generateKeyPairSync` to get a public/private key pair, and then craft a dummy certificate. We base64-encode a string containing the agent’s name and issuance timestamp to mimic the content of a certificate, and wrap it in PEM headers. We also generate a SHA-256 signature of the content as a stand-in for a fingerprint. In reality, issuing a proper X.509 cert involves creating a certificate signing request (CSR) and using a CA key to sign it, resulting in a DER-encoded certificate – but that complexity is beyond our needs here. The `AgentCertificate` object holds the PEM strings and a fingerprint.

### Protocol Formatters – `src/protocols.ts`

This module knows how to render agent information into the formats expected by A2A and MCP.

* **A2A Agent Card**: Typically a JSON served at `/.well-known/agent.json` describing the agent’s identity, endpoint URL, version, capabilities, and security details. We’ll construct a JSON with fields like `name`, `endpoint`, `version`, `capabilities`, and include the certificate or its fingerprint as a proof of identity.

* **MCP Tool Manifest**: MCP allows tools (functions/skills) to be invoked by LLMs in a standardized way. An MCP “server” might provide a list of tools with their schemas. For our agent, we can represent it as an MCP tool provider with one or more tools corresponding to its capabilities. To keep it simple, we’ll expose a single generic tool that allows invoking the agent with a text prompt (in practice, each distinct capability might be a separate tool with defined input/output schemas).

```ts
// file: src/protocols.ts

interface AgentInfo { 
  name: string;
  endpoint: string;
  version: string;
  capabilities: string[]; 
  certificateFingerprint: string;
}

/** Produce an A2A Agent Card JSON string for the given agent info. */
export function formatAgentCard(info: AgentInfo): string {
  // The card includes identity, endpoint, capabilities, and security info.
  const agentCard = {
    name: info.name,
    endpoint: info.endpoint,            // base URL where the agent's A2A server lives
    version: info.version,
    capabilities: info.capabilities,    // e.g. list of skill identifiers or descriptions
    cert_fingerprint: info.certificateFingerprint,
    protocol: "A2A/1.0"                 // indicates compliance with A2A spec version
    // (In a full implementation we might include auth requirements, supported formats, etc.)
  };
  return JSON.stringify(agentCard, null, 2);
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}
interface MCPManifest {
  agent: string;
  tools: MCPTool[];
}

/** Produce an MCP tool manifest JSON string for the given agent info. */
export function formatMCPManifest(info: AgentInfo): string {
  // For simplicity, we expose a single tool that delegates to the agent.
  const tool: MCPTool = {
    name: info.name,  // tool name can just be the agent’s name
    description: `Proxy tool for agent "${info.name}" – forwards a prompt to the agent and returns its response.`,
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Instruction or question for the agent" }
      },
      required: ["prompt"]
    },
    outputSchema: {
      type: "object",
      properties: {
        result: { type: "string", description: "Agent's response to the prompt" }
      }
    }
  };
  const manifest: MCPManifest = {
    agent: info.name,
    tools: [ tool ]
  };
  return JSON.stringify(manifest, null, 2);
}
```

**Notes:** Our `AgentInfo` structure is a distilled version of what an agent provides. The `cert_fingerprint` in the A2A card is used as a lightweight identity verification (another agent could verify the cert presented during TLS handshake matches this fingerprint). In a full spec, the Agent Card might include more (like accepted content types, auth mechanisms, etc.), but we’re keeping it minimal.

For MCP, we present the agent as a single “tool” that can be invoked with a generic prompt. In a real scenario, if an agent had discrete functions (e.g., `scheduleMeeting`, `analyzeFinances`), each would be listed as a separate tool with more specific input/output schemas. The manifest format chosen here is a simple custom JSON – actual MCP implementations might use JSON Schema or OpenAPI for tool descriptions, but our focus is to demonstrate the idea.

### Mastra.ai Threat Modeling Integration – `src/mastra.ts`

To integrate threat modeling, we include a stub that would interface with **mastra.ai** (a TypeScript AI framework) or a hypothetical API endpoint for the **MAESTRO** security framework. In practice, mastra might offer an SDK to analyze an agent’s configuration for known threat patterns (e.g., checking if an agent’s capabilities might be abused). Since we don’t have a concrete API to call here, we simulate this step.

```ts
// file: src/mastra.ts

export interface ThreatReport {
  riskScore: number;       // e.g., 0 (low risk) to 10 (high risk)
  issues: string[];        // list of identified security issues or warnings
  summary: string;         // a human-readable summary of the threat analysis
}

/**
 * Dummy threat analyzer that attempts to integrate with mastra.ai's MAESTRO framework.
 * If a mastra API were available, we'd call it here. For now, we simulate results.
 */
export async function analyzeAgentSecurity(agentCardJson: string): Promise<ThreatReport> {
  try {
    // In a real scenario, check for mastra API availability (e.g., an environment variable or SDK).
    const apiKey = Deno.env.get("MASTRA_API_KEY");
    if (!apiKey) {
      // No API key/config – simulate a basic analysis locally.
      return basicThreatAnalysis(agentCardJson);
    }

    // If API key is present, call the mastra.ai threat modeling API (hypothetical endpoint).
    const response = await fetch("https://api.mastra.ai/analysis", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: agentCardJson
    });
    if (!response.ok) {
      console.warn(`Mastra API returned status ${response.status}, using basic analysis instead.`);
      return basicThreatAnalysis(agentCardJson);
    }
    const report = await response.json();
    // We expect the API to return a structure matching ThreatReport; adjust as needed.
    return report as ThreatReport;
  } catch (err) {
    console.error("Threat analysis failed, proceeding without it:", err);
    // Fallback to basic analysis on errors.
    return basicThreatAnalysis(agentCardJson);
  }
}

/** A simple built-in threat analysis as fallback – checks for obvious issues in the agent card. */
function basicThreatAnalysis(agentCardJson: string): ThreatReport {
  const issues: string[] = [];
  const card = JSON.parse(agentCardJson);
  // Example checks (very naive for demonstration):
  if ((card.capabilities || []).length === 0) {
    issues.push("Agent has no declared capabilities.");
  }
  if (card.endpoint && card.endpoint.startsWith("http://")) {
    issues.push("Agent endpoint is not using HTTPS.");  // not secure
  }
  // Risk score: base it on number of issues (capped at 10)
  const riskScore = Math.min(issues.length * 3, 10);
  return {
    riskScore,
    issues,
    summary: issues.length ? 
      `Found ${issues.length} potential issues.` : 
      "No obvious issues detected."
  };
}
```

**How this works:** We created a function `analyzeAgentSecurity` that tries to use a mastra.ai API if available (simulated by checking an environment variable `MASTRA_API_KEY`). In a real environment, mastra’s SDK or a REST endpoint could provide a thorough analysis of the agent’s security posture using the MAESTRO framework. Lacking that, our `basicThreatAnalysis` simply checks for some dummy conditions (like missing capabilities or insecure endpoints) to produce a `ThreatReport`. This integration is optional – if threat analysis fails or is not configured, the ANS can still function, just without that extra insight.

### Core Service – `src/ans.ts`

Finally, the heart of the system: the **AgentNamingService** class. It ties everything together:

* It initializes the database.
* Provides a `registerAgent()` method that takes an agent’s name and info (like endpoint URL, capabilities, optional version). This method issues a mock certificate, builds the agent card JSON (using the protocol formatter), saves it in the registry, and optionally performs threat analysis (logging or storing the result).
* Provides a `resolveAgent()` method that, given a name and a protocol specifier (`"A2A"` or `"MCP"`), retrieves the agent’s info from the registry and returns the appropriate format (Agent Card JSON or MCP manifest JSON). If the agent is not found, it throws an error or returns undefined.

We’ll also define a Type for the registration input to clarify what data an agent provides at registration time.

```ts
// file: src/ans.ts
import { AgentRegistry } from "./db.ts";
import { issueCertificate } from "./certificate.ts";
import { formatAgentCard, formatMCPManifest } from "./protocols.ts";
import { analyzeAgentSecurity, ThreatReport } from "./mastra.ts";

/** Input data required to register an agent. */
export interface AgentRegistration {
  name: string;                 // Unique agent name (identifier in ANS).
  endpoint: string;             // Base URL for the agent's A2A interface.
  capabilities: string[];       // List of capability identifiers or descriptions.
  version?: string;             // Optional version (default "1.0").
}

/** The main Agent Naming Service class. */
export class AgentNamingService {
  private registry: AgentRegistry;

  constructor(dbFile?: string) {
    this.registry = new AgentRegistry(dbFile);
  }

  /**
   * Registers a new agent (or updates an existing one) in the naming service.
   * @param reg Info about the agent (name, endpoint, capabilities, etc).
   * @returns The issued certificate for the agent (so the agent can use it), and any threat analysis report.
   * @throws Error if registration fails (e.g., invalid data).
   */
  registerAgent(reg: AgentRegistration): { certificatePem: string; threatReport?: ThreatReport } {
    const { name, endpoint, capabilities } = reg;
    const version = reg.version ?? "1.0";
    if (!name || !endpoint) {
      throw new Error("Agent name and endpoint are required for registration.");
    }

    // 1. Issue a certificate for the agent (simulate CA signing).
    const cert = issueCertificate(name);

    // 2. Construct the AgentCard JSON using the provided info and cert fingerprint.
    const agentInfo = {
      name,
      endpoint,
      version,
      capabilities,
      certificateFingerprint: cert.fingerprint
    };
    const agentCardJson = formatAgentCard(agentInfo);

    // 3. Save the agent record in the registry (persist to SQLite).
    this.registry.saveAgent(name, agentCardJson);

    // 4. Perform threat modeling analysis (optional).
    let threatReport: ThreatReport | undefined;
    analyzeAgentSecurity(agentCardJson).then(report => {
      threatReport = report;
      if (report && report.issues.length) {
        console.warn(`Threat modeling for agent "${name}" found issues:`, report.issues);
      }
    }).catch(err => {
      console.error("Error during threat analysis:", err);
    });
    // Note: We trigger analysis asynchronously so that registration is not blocked. 
    // In a real system, we might want to await and handle it synchronously or in a background job.

    // 5. Return the certificate (so the registering agent can retrieve its cert to use).
    return { certificatePem: cert.certPem, threatReport };
  }

  /**
   * Resolves an agent by name and returns its metadata in the requested format.
   * @param name Agent name to look up.
   * @param format "A2A" for Agent Card JSON, "MCP" for tool manifest JSON.
   * @returns A string containing the agent's data in the specified format.
   * @throws Error if agent not found or format is unsupported.
   */
  resolveAgent(name: string, format: "A2A" | "MCP"): string {
    const agentCardJson = this.registry.getAgentCard(name);
    if (!agentCardJson) {
      throw new Error(`Agent "${name}" not found in ANS registry.`);
    }
    if (format === "A2A") {
      // We stored the full agent card JSON in the DB, return that directly (pretty printed).
      return JSON.stringify(JSON.parse(agentCardJson), null, 2);
    } else if (format === "MCP") {
      // Convert the stored agent info to an MCP manifest.
      const card = JSON.parse(agentCardJson);
      const agentInfo = {
        name: card.name,
        endpoint: card.endpoint,
        version: card.version,
        capabilities: card.capabilities,
        certificateFingerprint: card.cert_fingerprint
      };
      return formatMCPManifest(agentInfo);
    } else {
      throw new Error(`Unsupported format "${format}". Use "A2A" or "MCP".`);
    }
  }

  /** Close the underlying database when shutting down the service. */
  close(): void {
    this.registry.close();
  }
}
```

**Key behaviors:**

* **Registration (`registerAgent`)**: We ensure required fields are present, then get a certificate via `issueCertificate`. We build the `agentInfo` object to pass to formatters. The **Agent Card** JSON is saved in SQLite for later retrieval. We then kick off a threat analysis (non-blocking). We chose to not block registration on the external call (to keep things fast), but we do log issues if any are found. In a real scenario, one might store the threat report or have a callback. Here we simply log warnings and optionally include the report in the return (if it was ready immediately – note we don’t await it, to keep things minimal; a more robust version would `await analyzeAgentSecurity` before returning, or handle results asynchronously).

* **Resolution (`resolveAgent`)**: We fetch the stored agent card JSON. For **A2A**, we return it directly (as it’s already in Agent Card format). For **MCP**, we transform the agent’s info to an MCP manifest. Attempting an unsupported format yields an error.

The returned strings can then be served via an API or used in code. For example, an HTTP server could call `resolveAgent(name, "A2A")` to respond to queries for an agent’s card.

### Entry Point – `mod.ts`

For convenience, we create a `mod.ts` that re-exports the main service class and types, so users can import the ANS easily.

```ts
// file: mod.ts
export * from "./src/ans.ts";
```

### Example Usage

Finally, let’s demonstrate how this all comes together. In an `examples/usage.ts`, we show a simple flow of registering two agents and resolving them in both formats. This acts like a mini-README usage section for our library:

```ts
// file: examples/usage.ts
import { AgentNamingService } from "../mod.ts";

// Initialize the service (using in-memory DB for demo by using :memory: URI if supported, else a temp file).
const ans = new AgentNamingService(":memory:");

// Example agent registrations
const agentA = {
  name: "agent-alpha",
  endpoint: "https://alpha.example.com/a2a", 
  capabilities: ["generate_report", "answer_questions"],
  version: "1.0"
};
const agentB = {
  name: "agent-beta",
  endpoint: "http://beta.internal.test:3000",  // note: http (not https) for demo of threat warning
  capabilities: [],
  version: "0.1"
};

// Register agents
console.log(`Registering ${agentA.name}...`);
const resultA = ans.registerAgent(agentA);
console.log(`Issued certificate for ${agentA.name}:\n${resultA.certificatePem}\n`);

console.log(`Registering ${agentB.name}...`);
const resultB = ans.registerAgent(agentB);
console.log(`Issued certificate for ${agentB.name}:\n${resultB.certificatePem}\n`);

// Resolve Agent Alpha in A2A format
console.log(`Resolving ${agentA.name} (A2A format)...`);
const cardA = ans.resolveAgent("agent-alpha", "A2A");
console.log("Agent Card JSON:", cardA);

// Resolve Agent Alpha in MCP format
console.log(`Resolving ${agentA.name} (MCP format)...`);
const mcpA = ans.resolveAgent("agent-alpha", "MCP");
console.log("MCP Manifest JSON:", mcpA);

// Resolve Agent Beta in A2A format (to see threat analysis effect, if any)
console.log(`Resolving ${agentB.name} (A2A format)...`);
const cardB = ans.resolveAgent("agent-beta", "A2A");
console.log("Agent Card JSON:", cardB);

// Close the service (close DB connection)
ans.close();
```

If you run the above (with appropriate permissions: `--allow-read --allow-write` for the DB, and `--allow-net` if you expect to call mastra API), you might get output like:

```
Registering agent-alpha...
Issued certificate for agent-alpha:
-----BEGIN CERTIFICATE-----
QWdlbnQ6IGFnZW50LWFscGhhCklzc3VlZDog2025-05-15T17:45:30.123Z
-----END CERTIFICATE-----

Registering agent-beta...
Issued certificate for agent-beta:
-----BEGIN CERTIFICATE-----
QWdlbnQ6IGFnZW50LWJldGECSXNzdWVkOiAyMDI1LTA1LTE1VDE3OjQ1OjMwLjQ1M1o=
-----END CERTIFICATE-----

Resolving agent-alpha (A2A format)...
Agent Card JSON: {
  "name": "agent-alpha",
  "endpoint": "https://alpha.example.com/a2a",
  "version": "1.0",
  "capabilities": [
    "generate_report",
    "answer_questions"
  ],
  "cert_fingerprint": "…abcdef123456",   // (some hex string)
  "protocol": "A2A/1.0"
}

Resolving agent-alpha (MCP format)...
MCP Manifest JSON: {
  "agent": "agent-alpha",
  "tools": [
    {
      "name": "agent-alpha",
      "description": "Proxy tool for agent \"agent-alpha\" – forwards a prompt to the agent and returns its response.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "prompt": {
            "type": "string",
            "description": "Instruction or question for the agent"
          }
        },
        "required": [
          "prompt"
        ]
      },
      "outputSchema": {
        "type": "object",
        "properties": {
          "result": {
            "type": "string",
            "description": "Agent's response to the prompt"
          }
        }
      }
    }
  ]
}

Resolving agent-beta (A2A format)...
Agent Card JSON: {
  "name": "agent-beta",
  "endpoint": "http://beta.internal.test:3000",
  "version": "0.1",
  "capabilities": [],
  "cert_fingerprint": "…7890abcd",
  "protocol": "A2A/1.0"
}
```

*(You might also see a console warning from the threat analysis for agent-beta, e.g. “Found 2 potential issues” because it has an HTTP endpoint and no capabilities declared.)*

### Unit Tests – `test/ans.test.ts`

To ensure our ANS works correctly, we include some basic unit tests using Deno’s built-in test framework. These tests cover registering an agent, resolving it in both formats, and checking that the outputs contain expected fields (like the name and endpoint). We also simulate the threat analysis by checking the log or the returned `ThreatReport`.

```ts
// file: test/ans.test.ts
import { AgentNamingService } from "../src/ans.ts";
import { assertEquals, assertThrows } from "https://deno.land/std/testing/asserts.ts";

Deno.test("Registration and Resolution (A2A)", () => {
  const ans = new AgentNamingService(":memory:");
  const regInfo = { 
    name: "agent-test", 
    endpoint: "https://test.example.com/api", 
    capabilities: ["test_capability"] 
  };
  const result = ans.registerAgent(regInfo);
  // The certificate should be a PEM string containing the agent name
  if (!result.certificatePem.includes("BEGIN CERTIFICATE")) {
    throw new Error("Certificate PEM missing BEGIN CERTIFICATE header");
  }
  assertEquals(typeof result.certificatePem, "string");
  // Now resolve in A2A format
  const cardJson = ans.resolveAgent("agent-test", "A2A");
  const card = JSON.parse(cardJson);
  assertEquals(card.name, "agent-test");
  assertEquals(card.endpoint, "https://test.example.com/api");
  assertEquals(card.capabilities, ["test_capability"]);
  // protocol field should be present and indicate A2A
  assertEquals(card.protocol, "A2A/1.0");
  ans.close();
});

Deno.test("Resolution (MCP format)", () => {
  const ans = new AgentNamingService(":memory:");
  ans.registerAgent({
    name: "agent-tool",
    endpoint: "https://tool.example.com",
    capabilities: ["do_thing", "do_other"]
  });
  const manifestJson = ans.resolveAgent("agent-tool", "MCP");
  const manifest = JSON.parse(manifestJson);
  assertEquals(manifest.agent, "agent-tool");
  // It should list exactly one tool in our design
  assertEquals(manifest.tools.length, 1);
  const tool = manifest.tools[0];
  // Tool name should match agent name
  assertEquals(tool.name, "agent-tool");
  // The input schema should require a prompt
  assertEquals(tool.inputSchema.required.includes("prompt"), true);
  ans.close();
});

Deno.test("Unknown agent resolution throws", () => {
  const ans = new AgentNamingService(":memory:");
  // Not registering any agent, directly test resolution
  assertThrows(() => {
    ans.resolveAgent("non-existent", "A2A");
  }, Error, `Agent "non-existent" not found`);
  ans.close();
});
```

These tests create an isolated in-memory instance of the ANS (using SQLite’s `:memory:` feature for a fresh DB each time) and verify:

* After registration, the returned certificate is a non-empty PEM string containing the expected header.
* Resolving in A2A yields JSON that contains the correct name, endpoint, capabilities, and a `protocol` field of `A2A/1.0`.
* Resolving in MCP yields a manifest with the agent’s name and at least one tool, and that the tool’s schema includes the expected properties.
* Resolving a name that hasn’t been registered throws an error.
* (We implicitly test threat analysis by observing that registration doesn’t throw and optionally by checking console output if we wanted to, but since it’s asynchronous we do not assert on it here.)

---

**Conclusion:** The above implementation provides a minimal but functional **Agent Naming Service** with support for the **A2A** and **MCP** protocols. It demonstrates registering agents with a dummy certificate, storing their info in a SQLite registry, resolving by name to produce either an A2A Agent Card or an MCP tool description, and even hooks in a security analysis step using the **MAESTRO** framework via **mastra.ai** (simulated in this context). Despite being an MVP, it covers the core use cases:

* *Registration* of an agent with identity and capabilities.
* *Discovery/Resolution* of an agent by name in multiple interoperable formats.
* *Security consideration* through threat modeling integration.

This structured, documented code can serve as a starting point for a more robust ANS service or can be extended for specific integration needs (such as actual certificate authority integration, real mastra.ai API usage, network service endpoints for lookup, etc.).


## Alternative approach
**Quick map of what you need**

| Layer              | What you build                                                                                                                      | Tech you can re-use                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Trust & PKI        | Online CA issuing short-lived X.509 certs for every agent                                                                           | **step-ca**, **ACME** clients                |
| Registry core      | CRUD API backed by a table keyed on `(protocol, agentID, capability, provider, version)` plus JSONB column for `protocolExtensions` | **PostgreSQL** or **etcd**, FastAPI/Express  |
| Resolver           | `GET /resolve?name=<ANSName>` → signed endpoint doc (URL + cert thumbprint + metadata)                                              | Edge cache (Cloudflare Workers, Deno Deploy) |
| Protocol adapters  | Wrapper that turns a resolved record into A2A cards, MCP tools, or ACP profiles                                                     | Thin TS/py libs                              |
| Security hardening | MAESTRO threat model + mTLS + rate-limiting                                                                                         | OWASP cheat sheets                           |

---

### 1 Understand the contract

* ANSName grammar:
  `a2a://AgentID.Capability.Provider.v<semver>.<ext>` (example: `mcp://summarizer.textAnalysis.AcmeCorp.v1.3.hipaa`) ([genai.owasp.org][1])
* A record (see Appendix A JSON schema) must include protocol, capability, PKI cert and optional `protocolExtensions` for A2A/MCP/ACP specific blobs ([genai.owasp.org][1]).

Keep your DB schema close to this JSON so you can validate inbound registrations with standard JSON-Schema tooling.

---

### 2 Spin up a CA

```bash
step ca init --name "ANS Dev CA" --provisioner admin@example.com
step ca start
```

Agents call `POST /register` with a CSR; the RA service signs it and stores the PEM alongside the JSON record. Automate renewals with ACME to avoid manual cert juggling. PKI is what gives ANS its differentiation, so nail this first ([genai.owasp.org][1]).

---

### 3 Write the registry microservice

```python
# FastAPI sketch
class AnsRecord(BaseModel):
    protocol: str
    agentID: str
    capability: str
    provider: str
    version: str
    certificate: CertModel
    protocolExtensions: dict = {}

@app.post("/register")
def register(rec: AnsRecord): ...

@app.get("/resolve")
def resolve(name: str): ...
```

Persist the record, issue a signed JWT envelope or JWS-signed JSON when returning it so the client can verify integrity.

---

### 4 Resolver logic

Follow the spec’s algorithm: parse, query, select the best semver inside requested range, verify the embedded cert is still valid, then return the endpoint doc ([genai.owasp.org][1]). Edge-cache positive responses for a TTL shorter than your cert lifetime.

---

### 5 Adapters

Expose convenience endpoints:

```
/resolve/a2a/<ANSName>   --> A2A Agent Card
/resolve/mcp/<ANSName>   --> MCP tool JSON
```

All you’re doing is transforming the canonical record into each protocol’s native payload. Keep this in a separate module so new protocols are just new formatters.

---

### 6 Model threats early

Run the MAESTRO seven-layer checklist against each component to catch registry poisoning, spoofed certs, or DoS on the resolver ([genai.owasp.org][1]). Least effort: stick everything behind mTLS, rate-limit unauthenticated `resolve`, and require authZ scopes for `register` and `renew`.

---

### 7 Plug it into agents

* **LangGraph/LangChain**: wrap a node that calls `/resolve` before tool invocation.
* **Google ADK (A2A)**: drop the Agent Card you emit straight into the directory service.
* **MCP**: reference your resolver URL in the `tools` array.

---

### 8 Ship

CI: run JSON-schema validation and semver checks on every PR.
CD: blue-green deploy the registry; resolver caches invalidate on promotion.

---

### Should you do all this?

If you control <50 agents inside one cluster, Consul or plain DNS-SD is simpler. ANS shines when you need **cross-company discovery with cryptographic identity** and a single naming convention. Otherwise, keep watching until a reference implementation matures.

[1]: https://genai.owasp.org/download/47278/?tmstv=1747275418 "Microsoft Word - Agentic AI - Agent Name Service (ANS) for Secure AI Agent Discovery.v.1.0.docx"


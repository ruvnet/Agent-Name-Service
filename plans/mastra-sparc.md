Here’s a minimal **SPARC-aligned Mastra project scaffold** with **MCP integration** ready to go. It includes the core structure: Specification, Pseudocode, Architecture, Refinement, Completion — as agent workflows, plus MCP for IDE assist.

---

### **Step-by-Step: Setup Scaffold with MCP**

#### 1. **Initialize Project**

```bash
npx create-mastra@latest
```

**Prompts:**

* **Project name** → `sparc-mastra`
* **Include example agents/tools/workflows?** → Yes
* **Enable MCP integration?** → Yes
* **Choose IDE** → Cursor (or Windsurf)
* **LLM Provider** → OpenAI (or Groq/Anthropic)

---

#### 2. **Directory Overview**

```
sparc-mastra/
├── src/
│   └── mastra/
│       ├── agents/
│       │   ├── spec.agent.ts         # Specification Agent
│       │   ├── pseudocode.agent.ts   # Pseudocode Generator
│       │   ├── architecture.agent.ts # Architecture Generator
│       │   ├── refine.agent.ts       # Refinement Agent
│       │   └── complete.agent.ts     # Final Code Generator
│       ├── tools/
│       │   └── codeReview.tool.ts    # Example tool for validation
│       ├── workflows/
│       │   └── buildSPARC.workflow.ts
│       └── index.ts
├── .env
├── package.json
├── tsconfig.json
└── README.md
```

---

#### 3. **Start the MCP Context Server**

```bash
npx mastra mcp
```

Check: [http://localhost:4859/status](http://localhost:4859/status)

---

### **Example: buildSPARC.workflow\.ts**

```ts
import { defineWorkflow } from "@mastra/core"

export default defineWorkflow({
  id: "build_sparc",
  description: "Full SPARC agentic code flow",
  steps: [
    { id: "spec", agent: "spec" },
    { id: "pseudo", agent: "pseudocode", after: "spec" },
    { id: "arch", agent: "architecture", after: "pseudo" },
    { id: "refine", agent: "refine", after: "arch" },
    { id: "complete", agent: "complete", after: "refine" }
  ]
})
```

---

### **MCP Benefits in This Setup**

* Inline examples for every SPARC phase
* Auto-suggestions for tool chaining and eval configuration
* Cursor or Windsurf shows real-time docs from the MCP server
* Easy RAG plugin support to add memory or docs to any agent

--- 
mastraproject


Tools (4)
Resources (0)
Errors (0)
mastraBlog
Get Mastra.ai blog content. Without a URL, returns a list of all blog posts. With a URL, returns the specific blog post content in markdown format. The blog contains changelog posts as well as announcements and posts about Mastra features and AI news
Parameters
url*
URL of a specific blog post to fetch. If the string /blog is passed as the url it returns a list of all blog posts.
mastraDocs
Get Mastra.ai documentation. Request paths to explore the docs. References contain API docs. Other paths contain guides. The user doesn't know about files and directories. This is your internal knowledge the user can't read. If the user asks about a feature check general docs as well as reference docs for that feature. Ex: with evals check in evals/ and in reference/evals/. Provide code examples so the user understands. If you build a URL from the path, only paths ending in .mdx exist. Note that docs about MCP are currently in reference/tools/. IMPORTANT: Be concise with your answers. The user will ask for more info. If packages need to be installed, provide the pnpm command to install them. Ex. if you see `import { X } from "@mastra/$PACKAGE_NAME"` in an example, show an install command. Always install latest tag, not alpha unless requested. If you scaffold a new project it may be in a subdir
Parameters
paths*
One or more documentation paths to fetch Available paths: Available top-level paths: Directories: - agents/ - community/ - deployment/ - evals/ - frameworks/ - getting-started/ - local-dev/ - mastra-cloud/ - memory/ - observability/ - rag/ - reference/ - storage/ - tools-mcp/ - voice/ - workflows-vnext/ - workflows/ Reference subdirectories: - reference/agents/ - reference/cli/ - reference/client-js/ - reference/core/ - reference/deployer/ - reference/evals/ - reference/memory/ - reference/networks/ - reference/observability/ - reference/rag/ - reference/storage/ - reference/tools/ - reference/voice/ - reference/workflows/ Files: - index.mdx
mastraExamples
Get code examples from the Mastra.ai examples directory. Without a specific example name, lists all available examples. With an example name, returns the full source code of that example.
Parameters
example
Name of the specific example to fetch. If not provided, lists all available examples. Available examples: a2a, agent, agent-network, ai-sdk-useChat, assistant-ui, bird-checker-with-express, bird-checker-with-nextjs, bird-checker-with-nextjs-and-eval, client-side-tools, crypto-chatbot, fireworks-r1, mcp-configuration, mcp-registry-registry, memory-todo-agent, memory-with-context, memory-with-libsql, memory-with-mem0, memory-with-pg, memory-with-processors, memory-with-upstash, openapi-spec-writer, quick-start, stock-price-tool, weather-agent, workflow-ai-recruiter, workflow-with-inline-steps, workflow-with-memory, workflow-with-separate-steps
mastraChanges
Get changelog information for Mastra.ai packages. Available packages: @internal/storage-test-utils, @mastra/astra, @mastra/chroma, @mastra/clickhouse, @mastra/client-js, @mastra/cloud, @mastra/cloudflare, @mastra/cloudflare-d1, @mastra/core, @mastra/couchbase, @mastra/deployer, @mastra/deployer-cloudflare, @mastra/deployer-netlify, @mastra/deployer-vercel, @mastra/evals, @mastra/fastembed, @mastra/firecrawl, @mastra/github, @mastra/libsql, @mastra/loggers, @mastra/mcp, @mastra/mcp-docs-server, @mastra/mcp-registry-registry, @mastra/mem0, @mastra/memory, @mastra/mongodb, @mastra/opensearch, @mastra/pg, @mastra/pinecone, @mastra/playground-ui, @mastra/qdrant, @mastra/rag, @mastra/ragie, @mastra/server, @mastra/speech-azure, @mastra/speech-deepgram, @mastra/speech-elevenlabs, @mastra/speech-google, @mastra/speech-ibm, @mastra/speech-murf, @mastra/speech-openai, @mastra/speech-playai, @mastra/speech-replicate, @mastra/speech-speechify, @mastra/turbopuffer, @mastra/upstash, @mastra/vectorize, @mastra/voice-azure, @mastra/voice-cloudflare, @mastra/voice-deepgram, @mastra/voice-elevenlabs, @mastra/voice-google, @mastra/voice-murf, @mastra/voice-openai, @mastra/voice-openai-realtime, @mastra/voice-playai, @mastra/voice-sarvam, @mastra/voice-speechify, create-mastra, mastra
Parameters
package
Name of the specific package to fetch changelog for. If not provided, lists all available packages.
// mod.ts - Agent Naming Service (ANS) entry point

// Export core service
export { AgentNamingService } from './src/ans';

// Export types and utilities
export { AgentRegistry } from './src/db';
export { issueCertificate } from './src/certificate';
export { formatAgentCard, formatMCPManifest } from './src/protocols';

/**
 * Agent Naming Service (ANS)
 * 
 * A service for registering, resolving, and managing agent identities
 * in a distributed agent ecosystem.
 * 
 * Basic usage:
 * 
 * ```typescript
 * import { AgentNamingService } from './mod';
 * 
 * const ans = new AgentNamingService();
 * 
 * // Register an agent
 * const agentCard = await ans.registerAgent('agent-1', { 
 *   capabilities: ['text-generation', 'image-analysis']
 * });
 * 
 * // Resolve an agent
 * const resolvedAgent = await ans.resolveAgent('agent-1');
 * ```
 */
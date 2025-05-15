// src/protocols.ts

export function formatAgentCard(agentName: string, card: string): string {
  return "Agent Card for " + agentName + ": " + card;
}

export function formatMCPManifest(agentName: string, manifest: object): string {
  return "MCP Manifest for " + agentName + ": " + JSON.stringify(manifest, null, 2);
}
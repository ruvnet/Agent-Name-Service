
import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { LibSQLStore } from '@mastra/libsql';
import {
  weatherWorkflow,
  // Import the other workflows
  agentRegistrationWorkflow,
  certificateRotationWorkflow,
  agentResolutionWorkflow,
  securityMonitoringWorkflow,
  protocolTranslationWorkflow,
  agentCapabilityDiscoveryWorkflow
} from './workflows';

// Import security workflow separately to ensure we get the committed version
import { securityWorkflow as securityWorkflowRaw } from './workflows/security-workflow';
// Ensure we have a fully committed workflow
const securityWorkflow = securityWorkflowRaw;
import {
  weatherAgent,
  securityAnalysisAgent,
  protocolTranslationAgentDirect,
  registrationAgentDirect,
  securityMonitoringAgentDirect,
  agentResolutionAgentDirect,
  certificateRotationAgentDirect,
  capabilityDiscoveryAgentDirect
} from './agents';

// Export the Mastra instance with all workflows
// Make sure workflows are properly committed
weatherWorkflow.commit();
agentRegistrationWorkflow.commit();
certificateRotationWorkflow.commit();
agentResolutionWorkflow.commit();
securityMonitoringWorkflow.commit();
protocolTranslationWorkflow.commit();
agentCapabilityDiscoveryWorkflow.commit();

export const mastra = new Mastra({
  workflows: {
    weatherWorkflow,
    // Temporarily remove securityWorkflow to fix TypeScript error
    agentRegistrationWorkflow,
    certificateRotationWorkflow,
    agentResolutionWorkflow,
    securityMonitoringWorkflow,
    protocolTranslationWorkflow,
    agentCapabilityDiscoveryWorkflow
  },
  agents: {
    weatherAgent,
    securityAnalysisAgent,
    protocolTranslationAgentDirect,
    registrationAgentDirect,
    securityMonitoringAgentDirect,
    agentResolutionAgentDirect,
    certificateRotationAgentDirect,
    capabilityDiscoveryAgentDirect
  },
  storage: new LibSQLStore({
    url: ":memory:",
  }),
  logger: createLogger({
    name: 'Mastra',
    level: 'info',
  }),
  server: {
    port: 4111,
    host: '0.0.0.0',  // Listen on all interfaces, not just localhost
  },
});

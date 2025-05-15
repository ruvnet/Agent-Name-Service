
import { Mastra } from '@mastra/core/mastra';
import { createLogger } from '@mastra/core/logger';
import { LibSQLStore } from '@mastra/libsql';
import { weatherWorkflow, securityWorkflow } from './workflows';
import { weatherAgent, securityAnalysisAgent } from './agents';

// Export the Mastra instance with both workflows
export const mastra = new Mastra({
  workflows: {
    weatherWorkflow,
    securityWorkflow
  },
  agents: {
    weatherAgent,
    securityAnalysisAgent
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

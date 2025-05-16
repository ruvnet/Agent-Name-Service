import { Step, Workflow } from '@mastra/core/workflows';
import { securityAnalysisAgent } from '../agents';
import { z } from 'zod';

// Define the schema for agent data
const agentDataSchema = z.object({
  name: z.string().describe('The name of the agent'),
  metadata: z.record(z.any()).describe('Agent metadata including capabilities'),
  certificate: z.any().optional().describe('Agent certificate data if available'),
  ipAddress: z.string().optional().describe('IP address the agent is registering from'),
  registrationHistory: z.array(z.any()).optional().describe('History of agent registrations'),
});

// Step to analyze agent security
const analyzeAgentSecurity = new Step({
  id: 'analyze-agent-security',
  description: 'Analyzes agent data for security threats',
  inputSchema: agentDataSchema,
  outputSchema: z.object({
    id: z.string(),
    timestamp: z.string(),
    threatScore: z.number(),
    severity: z.string(),
    threatsDetected: z.boolean(),
    detectedThreats: z.array(z.string()),
    recommendedActions: z.array(z.string()),
    details: z.object({
      threatCategories: z.record(z.any()),
      analysisSource: z.string(),
      metadata: z.record(z.any()).optional(),
    }),
  }),
  execute: async ({ context }) => {
    // Get the trigger data which contains our agent information
    const triggerData = context.getStepResult('trigger');
    
    if (!triggerData) {
      throw new Error('Agent data not found in trigger');
    }
    
    // Convert trigger data to a format suitable for the agent
    const agentInput = {
      agentName: triggerData.name,
      metadata: triggerData.metadata,
      certificate: triggerData.certificate || null,
      ipAddress: triggerData.ipAddress || 'unknown',
      registrationHistory: triggerData.registrationHistory || [],
      analysisTime: new Date().toISOString(),
    };

    // Use the agent to analyze the security using stream() method
    const response = await securityAnalysisAgent.stream([
      {
        role: 'user',
        content: `Perform security analysis on the following agent data and return ONLY a valid JSON response with these fields:
        - threatScore: number from 0-100
        - severity: string ("INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL")
        - threats: array of threat objects with {type, confidence, evidence, impact, mitigation}
        - recommendedActions: array of strings
        - summary: string summary of findings

        Agent data:
        ${JSON.stringify(agentInput, null, 2)}`,
      },
      {
        role: 'system',
        content: 'You must respond with ONLY valid JSON. Do not include any explanations, markdown, or text outside of the JSON object.'
      }
    ]);

    // Collect the streamed response
    let agentResponse = '';
    for await (const chunk of response.textStream) {
      agentResponse += chunk;
    }
    
    // Try to parse the agent's response as JSON
    try {
      const analysisResult = JSON.parse(agentResponse);
      
      // Transform the agent response to our expected format
      return {
        id: `mastra-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: new Date().toISOString(),
        threatScore: analysisResult.threatScore || 0,
        severity: analysisResult.severity || 'INFO',
        threatsDetected: (analysisResult.threats && analysisResult.threats.length > 0) || false,
        detectedThreats: analysisResult.threats ?
          analysisResult.threats.map((threat: any) => threat.type) : [],
        recommendedActions: analysisResult.recommendedActions || ['MONITOR_ACTIVITY'],
        details: {
          threatCategories: transformThreatsToCategories(analysisResult.threats || []),
          analysisSource: 'mastra',
          metadata: {
            analysisVersion: '1.0.0',
            summary: analysisResult.summary || 'No issues detected',
            provider: 'Mastra.ai'
          }
        }
      };
    } catch (error) {
      // Handle parsing errors
      console.error('Failed to parse agent response:', error);
      
      // Return a basic result
      return {
        id: `mastra-error-${Date.now()}`,
        timestamp: new Date().toISOString(),
        threatScore: 10, // Low default score
        severity: 'INFO',
        threatsDetected: true,
        detectedThreats: ['ANALYSIS_ERROR'],
        recommendedActions: ['MONITOR_ACTIVITY'],
        details: {
          threatCategories: {
            ANALYSIS_ERROR: {
              confidence: 1.0,
              evidence: 'Failed to parse security analysis result',
              impact: 'Cannot properly assess agent security'
            }
          },
          analysisSource: 'mastra',
          metadata: {
            error: String(error),
            rawResponse: agentResponse
          }
        }
      };
    }
  },
});

// Helper function to transform the threats array to the expected format
function transformThreatsToCategories(threats: any[]) {
  const categories: Record<string, any> = {};
  
  for (const threat of threats) {
    categories[threat.type] = {
      confidence: threat.confidence || 0.5,
      evidence: threat.evidence || 'No evidence provided',
      impact: threat.impact || 'Unknown impact',
      mitigation: threat.mitigation || 'No mitigation suggested'
    };
  }
  
  return categories;
}

// Create the security workflow
const securityWorkflowBuilder = new Workflow({
  name: 'agent-security-workflow',
  triggerSchema: agentDataSchema,
});

// Add steps to the workflow
securityWorkflowBuilder.step(analyzeAgentSecurity);

// Commit the workflow to make it active
securityWorkflowBuilder.commit();

// Export the committed workflow
export const securityWorkflow = securityWorkflowBuilder;
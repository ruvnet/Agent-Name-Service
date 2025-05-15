// Test file to check proper exports from mastra-simple.ts
import { analyzeAgentSecurity, ThreatReport, SecurityAction } from './mastra-simple';

// Simple test function
async function testMastra() {
  try {
    const testAgent = {
      name: 'test-agent',
      metadata: { purpose: 'testing' }
    };
    
    // Test the function
    const result = await analyzeAgentSecurity(testAgent);
    console.log('Analysis result:', result);
    
    // Test the types
    const action: SecurityAction = SecurityAction.MONITOR_ACTIVITY;
    console.log('Action:', action);
    
    // Create a mock report
    const report: ThreatReport = {
      id: 'test-123',
      timestamp: new Date().toISOString(),
      threatScore: 0,
      threatsDetected: false,
      detectedThreats: [],
      severity: 'INFO',
      recommendedActions: [SecurityAction.MONITOR_ACTIVITY],
      details: {
        threatCategories: {},
        analysisSource: 'fallback'
      }
    };
    console.log('Report:', report);
    
    return result;
  } catch (error) {
    console.error('Test failed:', error);
    throw error;
  }
}

// Run the test
testMastra().catch(console.error);
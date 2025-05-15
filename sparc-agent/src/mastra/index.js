/**
 * JavaScript version of the Mastra module for ANS system compatibility
 */

// Simple threat analysis interface for ANS integration
const mastra = {
  // Main method that the ANS system will call for security analysis
  async analyzeThreat(agentData) {
    console.log('Mastra security analysis started via JS bridge for agent:', agentData.name);
    
    try {
      // Call the Mastra API running on the default port
      const response = await fetch('http://localhost:4111/api/threat-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName: agentData.name,
          metadata: agentData.metadata || {},
          certificate: agentData.certificate,
          ipAddress: agentData.ipAddress || 'unknown',
          registrationHistory: agentData.registrationHistory || [],
          analysisTime: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(3000) // Timeout after 3 seconds
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Successfully received threat analysis from Mastra service');
        
        // Return the result in the format expected by ANS
        return {
          id: result.id || `mastra-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          timestamp: result.timestamp || new Date().toISOString(),
          threatScore: result.threatScore || 0,
          severity: result.severity || 'INFO',
          threatsDetected: result.threatsDetected || false,
          detectedThreats: result.detectedThreats || [],
          recommendedActions: result.recommendedActions || ['MONITOR_ACTIVITY'],
          details: {
            threatCategories: result.threatCategories || {},
            analysisSource: 'mastra',
            metadata: result.metadata || {}
          }
        };
      } else {
        // If the service returns an error, throw it to be caught below
        throw new Error(`Mastra service error: ${response.status} ${await response.text()}`);
      }
    } catch (error) {
      console.warn('Error using Mastra service:', error.message);
      
      // Perform basic fallback analysis when the service is unavailable
      return performBasicThreatAnalysis(agentData);
    }
  }
};

// Fallback function for when the Mastra service is unavailable
function performBasicThreatAnalysis(agentData) {
  console.log('Performing basic threat analysis for:', agentData.name);
  
  // Extract data for analysis
  const name = agentData.name || '';
  const metadata = agentData.metadata || {};
  const metadataStr = JSON.stringify(metadata).toLowerCase();
  
  // Initialize threat detection variables
  const detectedThreats = [];
  let threatScore = 0;
  const threatCategories = {};
  
  // Check for suspicious patterns in name
  if (name.includes('admin') || name.includes('root') || name.includes('system')) {
    detectedThreats.push('PRIVILEGED_NAME');
    threatScore += 15;
    threatCategories.PRIVILEGED_NAME = {
      confidence: 0.8,
      evidence: `Agent name '${name}' contains privileged terms`,
      impact: 'Potential privilege escalation or impersonation'
    };
  }
  
  // Check for code execution capabilities
  if (metadataStr.includes('exec') || metadataStr.includes('execute') || 
      metadataStr.includes('run') || metadataStr.includes('command')) {
    detectedThreats.push('CODE_EXECUTION');
    threatScore += 25;
    threatCategories.CODE_EXECUTION = {
      confidence: 0.85,
      evidence: 'Agent metadata indicates code execution capabilities',
      impact: 'Potential arbitrary code execution'
    };
  }
  
  // Check for network access
  if (metadataStr.includes('http') || metadataStr.includes('fetch') || 
      metadataStr.includes('api') || metadataStr.includes('request')) {
    detectedThreats.push('NETWORK_ACCESS');
    threatScore += 10;
    threatCategories.NETWORK_ACCESS = {
      confidence: 0.7,
      evidence: 'Agent metadata indicates network access capabilities',
      impact: 'Potential for unauthorized data transfer or API access'
    };
  }
  
  // Determine severity based on threat score
  let severity = 'INFO';
  if (threatScore >= 70) severity = 'CRITICAL';
  else if (threatScore >= 50) severity = 'HIGH';
  else if (threatScore >= 30) severity = 'MEDIUM';
  else if (threatScore >= 10) severity = 'LOW';
  
  // Determine recommended actions
  const recommendedActions = ['MONITOR_ACTIVITY'];
  
  // Log security events for medium+ threats
  if (threatScore >= 30) {
    recommendedActions.push('LOG_SECURITY_EVENT');
  }
  
  // Reject registration for critical threats
  if (threatScore >= 70) {
    recommendedActions.push('REJECT_REGISTRATION');
  }
  
  // Create and return the threat report
  return {
    id: `mastra-fallback-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    threatScore,
    severity,
    threatsDetected: detectedThreats.length > 0,
    detectedThreats,
    recommendedActions,
    details: {
      threatCategories,
      analysisSource: 'mastra-fallback',
      metadata: {
        analysisVersion: '1.0.0',
        provider: 'Mastra.ai (Fallback)'
      }
    }
  };
}

// Export the mastra object for direct import by ANS
module.exports = { mastra };
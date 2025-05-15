/**
 * src/mastra.ts
 * Mastra.ai threat modeling integration for Agent Name Service
 */

// This will be initialized later when needed
let mastra: any = null;

// Import the required modules
import { SecuritySeverity } from './types';

// Function to connect to the Mastra service
async function importMastra() {
  try {
    // Check if the Mastra service is running on the default port (using 0.0.0.0)
    const response = await fetch('http://0.0.0.0:4111/api', {
      signal: AbortSignal.timeout(1000) // Timeout after 1 second
    });
    
    if (response.ok) {
      console.log('Found running Mastra service, will use it for analysis');
      // Return a proxy object that will forward requests to the running service
      return {
        runningServiceUrl: 'http://0.0.0.0:4111',
        // Add the analyzeThreat method that will be called by analyzeAgentSecurity
        analyzeThreat: async (agentData: any) => {
          try {
            console.log(`Starting security analysis for agent: ${agentData.name}`);
            
            // Use one consistent format for URL construction
            const MASTRA_BASE_URL = 'http://0.0.0.0:4111';
            const requestUrl = `${MASTRA_BASE_URL}/api/workflows/securityWorkflow/start-async`;
            // Ensure our request body matches the format that works with curl
            const requestBody = {
              input: {
                name: agentData.name,
                metadata: agentData.metadata || {}
              }
            };
            
            console.log(`Debug - Request body: ${JSON.stringify(requestBody)}`);
            
            console.log(`Making request to: ${requestUrl}`);
            console.log(`Full request body: ${JSON.stringify(requestBody)}`);
            
            try {
              // Log the raw request we're going to make
              console.log('DEBUG - Full request details:');
              console.log('URL:', requestUrl);
              console.log('Headers:', { 'Content-Type': 'application/json' });
              console.log('Body:', JSON.stringify(requestBody));
              
              // Make the direct curl command for debugging
              console.log(`DEBUG - Equivalent curl:
              curl -X POST -H "Content-Type: application/json" -d '${JSON.stringify(requestBody)}' ${requestUrl}`);
              
              // Use the workflow API with the correct workflow ID
              const analysisResponse = await fetch(requestUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
                signal: AbortSignal.timeout(5000) // Increased timeout to 5 seconds
              });
              
              // Log detailed response info
              console.log(`DEBUG - Response details:`);
              console.log(`Status: ${analysisResponse.status} ${analysisResponse.statusText}`);
              console.log(`Headers:`, Object.fromEntries([...analysisResponse.headers.entries()]));
              
              // Try to get the response body as text for debugging
              const rawResponseText = await analysisResponse.text();
              console.log(`DEBUG - Raw response body: ${rawResponseText}`);
              
              // Re-parse the response text for our normal processing
              const responseData = rawResponseText ? JSON.parse(rawResponseText) : null;
              console.log(`DEBUG - Parsed response:`, responseData);
              
              if (analysisResponse.ok && responseData) {
                // Use the parsed response data directly
                const workflowResponse = responseData;
                console.log('Received workflow response:', JSON.stringify(workflowResponse));
                
                // Extract the actual result from the workflow response
                const stepResult = workflowResponse.results?.['analyze-agent-security']?.output;
              
                if (stepResult) {
                  console.log('Found step result with threat score:', stepResult.threatScore);
                  
                  // If the step contains an analysis error due to JSON parsing
                  if (stepResult.detectedThreats?.includes('ANALYSIS_ERROR') &&
                      stepResult.details?.metadata?.rawResponse) {
                  
                    // Try to manually extract data from the raw Markdown JSON response
                    const rawResponse = stepResult.details.metadata.rawResponse;
                    console.log('Found raw response, attempting to extract threat data');
                    
                    try {
                      // The response is in markdown format with ```json ... ```
                      // Extract just the JSON part by removing the markdown code block markers
                      const jsonContent = rawResponse.replace(/```json\n|\n```/g, '');
                      const extractedData = JSON.parse(jsonContent);
                      
                      // Create a normalized threat report from the extracted data
                      return {
                        id: `mastra-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                        timestamp: new Date().toISOString(),
                        threatScore: extractedData.threatScore || 0,
                        severity: extractedData.severity || 'INFO',
                        threatsDetected: (extractedData.threats && extractedData.threats.length > 0) || false,
                        detectedThreats: extractedData.threats ?
                          extractedData.threats.map((threat: any) => threat.type) : [],
                        recommendedActions: extractedData.recommendedActions || [SecurityAction.MONITOR_ACTIVITY],
                        details: {
                          threatCategories: extractedData.threats ? extractedData.threats.reduce((acc: any, threat: any) => {
                            acc[threat.type] = {
                              confidence: threat.confidence || 0.5,
                              evidence: threat.evidence || 'No evidence provided',
                              impact: threat.impact || 'Unknown impact',
                              mitigation: threat.mitigation || 'No mitigation suggested'
                            };
                            return acc;
                          }, {}) : {},
                          analysisSource: 'mastra',
                          metadata: {
                            summary: extractedData.summary || 'No summary provided',
                            provider: 'Mastra.ai'
                          }
                        }
                      };
                    } catch (extractError) {
                      console.error('Failed to extract JSON from raw response:', extractError);
                      // Continue with the existing step result
                    }
                  }
                
                  // Return the step result directly
                  return {
                    id: stepResult.id || `mastra-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    timestamp: stepResult.timestamp || new Date().toISOString(),
                    threatScore: stepResult.threatScore || 0,
                    severity: stepResult.severity || 'INFO',
                    threatsDetected: stepResult.threatsDetected || false,
                    detectedThreats: stepResult.detectedThreats || [],
                    recommendedActions: stepResult.recommendedActions || [SecurityAction.MONITOR_ACTIVITY],
                    details: {
                      threatCategories: stepResult.details?.threatCategories || {},
                      analysisSource: 'mastra',
                      metadata: stepResult.details?.metadata || {}
                    }
                  };
                } else {
                  // If we couldn't find the step result, fall back
                  console.warn('Workflow response was valid, but step output was missing');
                  throw new Error('Invalid workflow response format');
                }
              } else {
                // Get detailed error information
                const errorText = rawResponseText; // We already have the response text
                console.error(`Mastra service returned status ${analysisResponse.status}: ${errorText}`);
                console.error(`Failed request URL: ${requestUrl}`);
                
                // Try to diagnose why the workflow endpoint might not be working
                console.log('Attempting direct workflow list request to diagnose issue...');
                try {
                  const workflowsResponse = await fetch('http://0.0.0.0:4111/api/workflows', {
                    signal: AbortSignal.timeout(2000)
                  });
                  
                  if (workflowsResponse.ok) {
                    const workflows = await workflowsResponse.json();
                    console.log('Available workflows:', Object.keys(workflows));
                    console.log('Security workflow details:', workflows.securityWorkflow?.name);
                  } else {
                    console.log('Could not fetch workflows list:', workflowsResponse.status);
                  }
                } catch (diagError: any) {
                  console.log('Diagnostic request failed:', diagError?.message || 'Unknown error');
                }
                
                throw new Error(`Mastra service returned status ${analysisResponse.status}: ${errorText}`);
              }
            } catch (error: any) {
              console.warn('Error calling Mastra service:', error.message);
              throw error;
            }
        }
      };
    }
  } catch (error: any) {
    console.warn('Mastra service not available:', error.message || 'Unknown error');
  }
  
  // Return null if the service is not available
  return null;
}

// Initialize mastra instance when needed
(async function() {
  mastra = await importMastra();
})();

/**
 * Represents a security threat analysis report
 */
export interface ThreatReport {
  /**
   * Unique identifier for the threat report
   */
  id: string;
  
  /**
   * Timestamp when the analysis was performed
   */
  timestamp: string;
  
  /**
   * Overall threat score (0-100, higher means more severe)
   */
  threatScore: number;
  
  /**
   * Whether threats were detected
   */
  threatsDetected: boolean;
  
  /**
   * Array of detected threat types
   */
  detectedThreats: string[];
  
  /**
   * Severity level of the threats (INFO, LOW, MEDIUM, HIGH, CRITICAL)
   */
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  
  /**
   * Recommended actions to mitigate detected threats
   */
  recommendedActions: string[];
  
  /**
   * Detailed analysis results
   */
  details: {
    /**
     * Breakdown of threats by category
     */
    threatCategories: {
      [category: string]: {
        /**
         * Confidence score for this category (0-1)
         */
        confidence: number;
        
        /**
         * Specific details about the threat
         */
        details: string;
      }
    };
    
    /**
     * Whether the analysis was performed by Mastra.ai or the fallback
     */
    analysisSource: 'mastra' | 'fallback';
    
    /**
     * Additional metadata about the analysis
     */
    metadata?: Record<string, any>;
  };
}

/**
 * Supported threat categories for analysis
 */
export enum ThreatCategory {
  MALICIOUS_INTENT = 'MALICIOUS_INTENT',
  PRIVILEGE_ESCALATION = 'PRIVILEGE_ESCALATION',
  NETWORK_ACCESS = 'NETWORK_ACCESS',
  FILE_SYSTEM_ACCESS = 'FILE_SYSTEM_ACCESS',
  CODE_EXECUTION = 'CODE_EXECUTION',
  PRIVILEGED_NAME = 'PRIVILEGED_NAME',
  DATA_EXFILTRATION = 'DATA_EXFILTRATION',
  SUSPICIOUS_ORIGIN = 'SUSPICIOUS_ORIGIN',
  INSECURE_CONFIGURATION = 'INSECURE_CONFIGURATION',
  KNOWN_VULNERABILITY = 'KNOWN_VULNERABILITY'
}

/**
 * Recommended security actions that can be taken
 */
export enum SecurityAction {
  REJECT_REGISTRATION = 'REJECT_REGISTRATION',
  LOG_SECURITY_EVENT = 'LOG_SECURITY_EVENT',
  RESTRICT_CAPABILITIES = 'RESTRICT_CAPABILITIES',
  INCREASE_MONITORING = 'INCREASE_MONITORING',
  MONITOR_ACTIVITY = 'MONITOR_ACTIVITY',
  REQUIRE_ADDITIONAL_VERIFICATION = 'REQUIRE_ADDITIONAL_VERIFICATION',
  ISOLATE_AGENT = 'ISOLATE_AGENT',
  FLAG_FOR_REVIEW = 'FLAG_FOR_REVIEW'
}

/**
 * Analyzes agent security using Mastra.ai or fallback analysis
 * 
 * @param agentData Agent data to analyze
 * @returns Threat analysis report
 */
export async function analyzeAgentSecurity(
  agentData: {
    name: string;
    metadata: object;
    certificate?: any;
    ipAddress?: string;
    registrationHistory?: any[];
  }
): Promise<ThreatReport> {
  try {
    // Validate input data
    if (!agentData || !agentData.name) {
      throw new Error('Invalid agent data provided for security analysis');
    }

    const startTime = Date.now();
    
    // First check if the Mastra service is running directly
    try {
      const serviceResponse = await fetch('http://0.0.0.0:4111/api/health', {
        signal: AbortSignal.timeout(1000) // Timeout after 1 second to prevent hanging
      });
      
      if (serviceResponse.ok) {
        console.log('Found running Mastra service, will attempt to use it directly');
        
        try {
          // Prepare agent data for analysis
          const agentInfo = {
            agentName: agentData.name,
            metadata: agentData.metadata,
            certificateData: agentData.certificate,
            ipAddress: agentData.ipAddress,
            registrationHistory: agentData.registrationHistory,
            analysisTime: new Date().toISOString()
          };
          
          // Call the service API
          const analysisResponse = await fetch('http://0.0.0.0:4111/api/threat-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(agentInfo),
            signal: AbortSignal.timeout(3000) // Timeout after 3 seconds
          });
          
          if (analysisResponse.ok) {
            const result = await analysisResponse.json();
            console.log('Successfully received threat analysis from Mastra service');
            
            // Convert the service response to our expected format
            const mastraAnalysis: ThreatReport = {
              id: result.id || `mastra-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              timestamp: result.timestamp || new Date().toISOString(),
              threatScore: result.threatScore || 0,
              threatsDetected: result.threatsDetected || false,
              detectedThreats: result.detectedThreats || [],
              severity: result.severity || 'INFO',
              recommendedActions: result.recommendedActions || [SecurityAction.MONITOR_ACTIVITY],
              details: {
                threatCategories: result.details?.threatCategories || {},
                analysisSource: 'mastra',
                metadata: result.metadata
              }
            };
            
            console.log(`Mastra service analysis completed in ${Date.now() - startTime}ms`);
            return mastraAnalysis;
          }
        } catch (serviceError) {
          console.warn('Error using running Mastra service:', serviceError);
        }
      }
    } catch (fetchError) {
      // Silently continue if the service check fails
    }
    
    // Try to use imported Mastra module as a fallback
    if (!mastra) {
      mastra = await importMastra();
    }
    
    if (mastra) {
      try {
        // Enhanced Mastra integration
        const mastraAnalysis = await performMastraAnalysis(agentData);
        
        if (mastraAnalysis) {
          console.log(`Mastra.ai analysis completed in ${Date.now() - startTime}ms`);
          return mastraAnalysis;
        }
      } catch (mastraError) {
        // Log the error, but don't expose to the caller
        console.error('Mastra analysis failed:', sanitizeErrorMessage(mastraError));
      }
    }

    // Fall back to local analysis if all methods fail
    console.warn('Using fallback analysis as Mastra security workflow is not available');
    const fallbackAnalysis = performLocalAnalysis(agentData);
    
    console.log(`Fallback analysis completed in ${Date.now() - startTime}ms`);
    return fallbackAnalysis;
  } catch (error) {
    // Log the full error internally
    console.error('Error in analyzeAgentSecurity:', error);
    
    // Return a sanitized error report
    return createErrorThreatReport(sanitizeErrorMessage(error));
  }
}

/**
 * Attempts to perform threat analysis using Mastra.ai
 * 
 * @param agentData Agent data to analyze
 * @returns Threat analysis report or undefined if Mastra.ai is unavailable
 */
async function performMastraAnalysis(agentData: {
  name: string;
  metadata: object;
  certificate?: any;
  ipAddress?: string;
  registrationHistory?: any[];
}): Promise<ThreatReport | undefined> {
  try {
    // Prepare agent data for Mastra analysis
    const agentInfo = {
      agentName: agentData.name,
      metadata: agentData.metadata,
      certificateData: agentData.certificate,
      ipAddress: agentData.ipAddress,
      registrationHistory: agentData.registrationHistory,
      analysisTime: new Date().toISOString()
    };

    console.log(`Attempting to analyze agent security using Mastra for: ${agentData.name}`);
    
    // Check if we have a direct Mastra instance
    if (mastra && !('runningServiceUrl' in mastra)) {
      // Use the direct Mastra instance
      // This is a placeholder for the actual Mastra API integration
      console.log('Using directly imported Mastra instance');
      
      // TODO: Implement full Mastra.ai integration
      // For now, return undefined to fall back to local analysis
      return undefined;
      
    } else if (mastra && 'runningServiceUrl' in mastra) {
      // Use the running Mastra service
      console.log(`Using running Mastra service at ${mastra.runningServiceUrl}`);
      
      try {
        // Call the Mastra service API
        const response = await fetch(`${mastra.runningServiceUrl}/api/threat-analysis`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(agentInfo),
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('Successfully received threat analysis from Mastra service');
          
          // Convert the service response to our expected format
          return {
            id: result.id || `mastra-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            timestamp: result.timestamp || new Date().toISOString(),
            threatScore: result.threatScore || 0,
            threatsDetected: result.threatsDetected || false,
            detectedThreats: result.detectedThreats || [],
            severity: result.severity || 'INFO',
            recommendedActions: result.recommendedActions || [SecurityAction.MONITOR_ACTIVITY],
            details: {
              threatCategories: result.details?.threatCategories || {},
              analysisSource: 'mastra',
              metadata: result.metadata
            }
          };
        } else {
          console.warn(`Mastra service returned status ${response.status}: ${await response.text()}`);
        }
      } catch (fetchError) {
        console.error('Error calling Mastra service:', sanitizeErrorMessage(fetchError));
      }
    }
    
    // If all else fails, return undefined to fall back to local analysis
    return undefined;
  } catch (error) {
    // Don't expose internal Mastra errors to the caller
    console.error('Mastra analysis error:', sanitizeErrorMessage(error));
    return undefined;
  }
}

/**
 * Creates a threat report for error scenarios
 * 
 * @param errorMessage The error message to include in the report
 * @returns A minimal threat report
 */
function createErrorThreatReport(errorMessage: string): ThreatReport {
  return {
    id: `error-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    threatScore: 0,
    threatsDetected: false,
    detectedThreats: [],
    severity: 'INFO',
    recommendedActions: [SecurityAction.MONITOR_ACTIVITY],
    details: {
      threatCategories: {},
      analysisSource: 'fallback',
      metadata: { 
        error: true, 
        message: `Analysis failed: ${errorMessage}`
      }
    }
  };
}

/**
 * Performs enhanced local threat analysis
 * 
 * @param agentData Agent data to analyze
 * @returns Detailed threat analysis report
 */
function performLocalAnalysis(
  agentData: { 
    name: string; 
    metadata: object;
    certificate?: any;
    ipAddress?: string;
    registrationHistory?: any[];
  }
): ThreatReport {
  try {
    // Extract metadata for analysis
    const metadata = agentData.metadata || {};
    const metadataStr = JSON.stringify(metadata).toLowerCase();
    const agentName = agentData.name.toLowerCase();
    
    // Enhanced threat patterns with more sophisticated detection
    const threatPatterns = [
      // Malicious intent patterns
      { 
        pattern: /(hack|exploit|attack|malicious|inject|intrusion|breach|bypass|crack|steal)/i, 
        category: ThreatCategory.MALICIOUS_INTENT, 
        weight: 0.8,
        explanation: 'Detected terminology associated with malicious activities'
      },
      
      // Privilege escalation patterns
      { 
        pattern: /(admin|root|sudo|superuser|privilege|elevation|escalation|password)/i, 
        category: ThreatCategory.PRIVILEGE_ESCALATION, 
        weight: 0.7,
        explanation: 'Detected indicators of privilege escalation attempts'
      },
      
      // Network access patterns
      { 
        pattern: /(fetch|http|url|request|socket|tunnel|port|connect)/i, 
        category: ThreatCategory.NETWORK_ACCESS, 
        weight: 0.5,
        explanation: 'Detected network access capabilities'
      },
      
      // File system access patterns
      { 
        pattern: /(file|directory|path|read|write|delete|create|modify|chmod|chown)/i, 
        category: ThreatCategory.FILE_SYSTEM_ACCESS, 
        weight: 0.6,
        explanation: 'Detected file system access capabilities'
      },
      
      // Code execution patterns
      { 
        pattern: /(execute|run|eval|spawn|process|shell|command|script|exec)/i, 
        category: ThreatCategory.CODE_EXECUTION, 
        weight: 0.8,
        explanation: 'Detected code execution capabilities'
      },
      
      // Data exfiltration patterns
      { 
        pattern: /(collect|gather|exfil|extract|scrape|harvest|download|upload)/i, 
        category: ThreatCategory.DATA_EXFILTRATION, 
        weight: 0.7,
        explanation: 'Detected possible data exfiltration capabilities'
      }
    ];
    
    // Initial threat analysis
    let threatScore = 0;
    const detectedThreats: string[] = [];
    const threatCategories: Record<string, { confidence: number; details: string }> = {};
    
    // Check for suspicious patterns in metadata with enhanced detection
    threatPatterns.forEach(({ pattern, category, weight, explanation }) => {
      if (pattern.test(metadataStr)) {
        const matches = metadataStr.match(pattern) || [];
        const matchCount = matches.length;
        
        // Calculate confidence score based on match count and pattern weight
        // More matches = higher confidence, but with diminishing returns
        const baseConfidence = Math.min(matchCount * 0.2, 0.8);
        const confidence = Math.min(baseConfidence * weight, 0.95);
        
        // Only include significant matches (confidence threshold)
        if (confidence > 0.3) {
          detectedThreats.push(category);
          
          // Increase threat score based on pattern weight and match frequency
          threatScore += confidence * 25 * weight;
          
          // Capture detailed information about the detection
          threatCategories[category] = {
            confidence,
            details: `${explanation}: ${matchCount} instance${matchCount !== 1 ? 's' : ''} detected`
          };
        }
      }
    });
    
    // Analyze agent name for security issues (enhanced detection)
    analyzeAgentName(agentData.name, detectedThreats, threatCategories, (value) => { 
      threatScore += value;
    });
    
    // If available, analyze agent's IP address for geo-based risks
    // This would be more sophisticated in a production system
    if (agentData.ipAddress) {
      analyzeIPAddress(agentData.ipAddress, detectedThreats, threatCategories, (value) => {
        threatScore += value;
      });
    }
    
    // If available, analyze registration history for suspicious patterns
    if (agentData.registrationHistory && agentData.registrationHistory.length > 0) {
      analyzeRegistrationHistory(
        agentData.registrationHistory, 
        detectedThreats, 
        threatCategories, 
        (value) => { threatScore += value; }
      );
    }
    
    // Analyze capabilities specifically (if provided in metadata)
    if (metadata && (metadata as any).capabilities) {
      analyzeCapabilities(
        (metadata as any).capabilities, 
        detectedThreats, 
        threatCategories, 
        (value) => { threatScore += value; }
      );
    }
    
    // Cap threatScore at 100
    threatScore = Math.min(Math.round(threatScore), 100);
    
    // Remove duplicate threat categories
    const uniqueThreats = [...new Set(detectedThreats)];
    
    // Determine severity based on threat score with more granular thresholds
    let severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'INFO';
    if (threatScore >= 85) severity = 'CRITICAL';
    else if (threatScore >= 65) severity = 'HIGH';
    else if (threatScore >= 45) severity = 'MEDIUM';
    else if (threatScore >= 25) severity = 'LOW';
    
    // Generate appropriate recommended actions based on severity and threats
    const recommendedActions = determineRecommendedActions(threatScore, uniqueThreats);
    
    return {
      id: `threat-local-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      threatScore,
      threatsDetected: uniqueThreats.length > 0,
      detectedThreats: uniqueThreats,
      severity,
      recommendedActions,
      details: {
        threatCategories,
        analysisSource: 'fallback'
      }
    };
  } catch (error) {
    // If local analysis fails, return a sanitized error report
    console.error('Error in local threat analysis:', error);
    return createErrorThreatReport(sanitizeErrorMessage(error));
  }
}

/**
 * Analyzes an agent name for security concerns
 * 
 * @param name The agent name to analyze
 * @param detectedThreats Array to populate with detected threats
 * @param threatCategories Object to populate with threat details
 * @param updateScore Function to update the threat score
 */
function analyzeAgentName(
  name: string,
  detectedThreats: string[],
  threatCategories: Record<string, { confidence: number; details: string }>,
  updateScore: (value: number) => void
): void {
  const nameLower = name.toLowerCase();
  
  // Check for privileged name patterns
  const privilegedPatterns = [
    { pattern: /(admin|root|system|sudo)/i, confidence: 0.8, score: 30 },
    { pattern: /(service|daemon|kernel)/i, confidence: 0.6, score: 20 },
    { pattern: /(security|auth|access)/i, confidence: 0.5, score: 15 }
  ];
  
  // Check for reserved prefixes
  const reservedPrefixes = [
    { prefix: 'system.', confidence: 0.9, score: 35 },
    { prefix: 'admin.', confidence: 0.8, score: 30 },
    { prefix: 'security.', confidence: 0.7, score: 25 },
    { prefix: 'root.', confidence: 0.9, score: 35 },
    { prefix: 'mcp.', confidence: 0.7, score: 25 },
    { prefix: 'core.', confidence: 0.6, score: 20 },
  ];
  
  // Check for privileged name patterns
  privilegedPatterns.forEach(({ pattern, confidence, score }) => {
    if (pattern.test(nameLower)) {
      detectedThreats.push(ThreatCategory.PRIVILEGED_NAME);
      updateScore(score);
      
      threatCategories[ThreatCategory.PRIVILEGED_NAME] = {
        confidence,
        details: 'Agent name suggests elevated privileges or system-level access'
      };
    }
  });
  
  // Check for reserved prefixes
  reservedPrefixes.forEach(({ prefix, confidence, score }) => {
    if (nameLower.startsWith(prefix)) {
      detectedThreats.push(ThreatCategory.PRIVILEGED_NAME);
      updateScore(score);
      
      threatCategories[ThreatCategory.PRIVILEGED_NAME] = {
        confidence,
        details: `Agent name uses reserved prefix "${prefix}"`
      };
    }
  });
  
  // Check for potential injection in names
  if (/[<>(){}[\]'"`\\;]/.test(name)) {
    detectedThreats.push(ThreatCategory.MALICIOUS_INTENT);
    updateScore(40);
    
    threatCategories[ThreatCategory.MALICIOUS_INTENT] = {
      confidence: 0.8,
      details: 'Agent name contains potentially dangerous special characters'
    };
  }
}

/**
 * Analyzes agent capabilities for security concerns
 * 
 * @param capabilities Array of capabilities to analyze
 * @param detectedThreats Array to populate with detected threats
 * @param threatCategories Object to populate with threat details
 * @param updateScore Function to update the threat score
 */
function analyzeCapabilities(
  capabilities: string[],
  detectedThreats: string[],
  threatCategories: Record<string, { confidence: number; details: string }>,
  updateScore: (value: number) => void
): void {
  if (!Array.isArray(capabilities) || capabilities.length === 0) {
    return;
  }
  
  // Map capabilities to threat categories
  const capabilityMappings: {[key: string]: {category: ThreatCategory, confidence: number, score: number}} = {
    'file-read': { category: ThreatCategory.FILE_SYSTEM_ACCESS, confidence: 0.5, score: 15 },
    'file-write': { category: ThreatCategory.FILE_SYSTEM_ACCESS, confidence: 0.7, score: 25 },
    'file-delete': { category: ThreatCategory.FILE_SYSTEM_ACCESS, confidence: 0.8, score: 30 },
    'code-execution': { category: ThreatCategory.CODE_EXECUTION, confidence: 0.9, score: 40 },
    'system-admin': { category: ThreatCategory.PRIVILEGE_ESCALATION, confidence: 0.9, score: 45 },
    'network-access': { category: ThreatCategory.NETWORK_ACCESS, confidence: 0.6, score: 20 },
    'data-collection': { category: ThreatCategory.DATA_EXFILTRATION, confidence: 0.7, score: 25 }
  };
  
  // Count how many high-risk capabilities are requested
  let highRiskCount = 0;
  
  capabilities.forEach(capability => {
    const capabilityKey = capability.toLowerCase().trim();
    
    if (capabilityMappings[capabilityKey]) {
      const { category, confidence, score } = capabilityMappings[capabilityKey];
      
      detectedThreats.push(category);
      updateScore(score);
      
      // If this category already exists, only override if confidence is higher
      if (!threatCategories[category] || threatCategories[category].confidence < confidence) {
        threatCategories[category] = {
          confidence,
          details: `Agent requests ${capabilityKey} capability`
        };
      }
      
      // Count high-risk capabilities (those with confidence > 0.7)
      if (confidence > 0.7) {
        highRiskCount++;
      }
    }
  });
  
  // Apply additional risk for combinations of high-risk capabilities
  if (highRiskCount >= 2) {
    updateScore(highRiskCount * 10);
    
    // Add combination risk
    threatCategories['COMBINED_RISK'] = {
      confidence: Math.min(0.5 + (highRiskCount * 0.1), 0.95),
      details: `Agent requests ${highRiskCount} high-risk capabilities in combination`
    };
  }
}

/**
 * Analyzes IP address for geolocation-based risks
 * This is a simplified placeholder implementation
 */
function analyzeIPAddress(
  ipAddress: string,
  detectedThreats: string[],
  threatCategories: Record<string, { confidence: number; details: string }>,
  updateScore: (value: number) => void
): void {
  // This would be expanded in a production system to include:
  // - IP reputation database checks
  // - Geo-location risk assessment
  // - Known VPN/proxy detection
  // - Traffic pattern analysis
  
  // For now, we'll do a simple check for local testing IPs
  if (ipAddress === '127.0.0.1' || ipAddress === 'localhost' || ipAddress.startsWith('192.168.') || ipAddress.startsWith('10.')) {
    // Local IPs are typically lower risk in this context
    return;
  }
  
  // Add a placeholder for more sophisticated IP analysis
  detectedThreats.push(ThreatCategory.SUSPICIOUS_ORIGIN);
  updateScore(10); // Small bump in score
  
  threatCategories[ThreatCategory.SUSPICIOUS_ORIGIN] = {
    confidence: 0.3,
    details: 'IP address requires additional verification'
  };
}

/**
 * Analyzes registration history for suspicious patterns
 * This is a simplified placeholder implementation
 */
function analyzeRegistrationHistory(
  history: any[],
  detectedThreats: string[],
  threatCategories: Record<string, { confidence: number; details: string }>,
  updateScore: (value: number) => void
): void {
  if (!Array.isArray(history) || history.length === 0) {
    return;
  }
  
  // Check for many rapid registration attempts
  if (history.length > 3) {
    const timestamps = history.map(h => new Date(h.timestamp).getTime());
    const timeSpans = [];
    
    // Calculate time spans between registration attempts
    for (let i = 1; i < timestamps.length; i++) {
      timeSpans.push(timestamps[i] - timestamps[i-1]);
    }
    
    // Check if any time spans are very small (rapid registration attempts)
    const rapidRegistrations = timeSpans.filter(span => span < 60000).length; // Less than 1 minute
    
    if (rapidRegistrations > 2) {
      detectedThreats.push(ThreatCategory.SUSPICIOUS_ORIGIN);
      updateScore(20);
      
      threatCategories[ThreatCategory.SUSPICIOUS_ORIGIN] = {
        confidence: 0.6,
        details: `Detected ${rapidRegistrations} rapid registration attempts`
      };
    }
  }
}

/**
 * Determines recommended security actions based on threat score and detected threats
 * 
 * @param threatScore The overall threat score
 * @param detectedThreats Array of detected threats
 * @returns Array of recommended actions
 */
function determineRecommendedActions(
  threatScore: number, 
  detectedThreats: string[]
): string[] {
  const actions: string[] = [];
  
  // Progressive security measures based on threat score
  if (threatScore >= 85) {
    actions.push(SecurityAction.REJECT_REGISTRATION);
    actions.push(SecurityAction.LOG_SECURITY_EVENT);
    actions.push(SecurityAction.FLAG_FOR_REVIEW);
  } 
  else if (threatScore >= 65) {
    actions.push(SecurityAction.REJECT_REGISTRATION);
    actions.push(SecurityAction.LOG_SECURITY_EVENT);
  } 
  else if (threatScore >= 45) {
    actions.push(SecurityAction.RESTRICT_CAPABILITIES);
    actions.push(SecurityAction.REQUIRE_ADDITIONAL_VERIFICATION);
    actions.push(SecurityAction.INCREASE_MONITORING);
  } 
  else if (threatScore >= 25) {
    actions.push(SecurityAction.MONITOR_ACTIVITY);
    actions.push(SecurityAction.FLAG_FOR_REVIEW);
  } 
  else {
    actions.push(SecurityAction.MONITOR_ACTIVITY);
  }
  
  // Add threat-specific actions
  if (detectedThreats.includes(ThreatCategory.CODE_EXECUTION)) {
    actions.push(SecurityAction.ISOLATE_AGENT);
  }
  
  if (detectedThreats.includes(ThreatCategory.PRIVILEGED_NAME) ||
      detectedThreats.includes(ThreatCategory.PRIVILEGE_ESCALATION)) {
    actions.push(SecurityAction.RESTRICT_CAPABILITIES);
  }
  
  // Return unique actions only
  return [...new Set(actions)];
}

/**
 * Sanitizes error messages to prevent information leakage
 * 
 * @param error The error to sanitize
 * @returns A sanitized error message
 */
function sanitizeErrorMessage(error: any): string {
  // Convert to string if it's not already
  const message = error?.message || String(error);
  
  // Remove any potentially sensitive information
  return message
    .replace(/(?:\/[\w.-]+)+/g, '[PATH]')
    .replace(/at\s+[\w\s./<>]+\s+\(.*\)/g, '[STACK_TRACE]')
    .replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi, '[EMAIL]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP_ADDRESS]')
    .replace(/key|secret|password|token|credential|auth/gi, '[SENSITIVE]');
}
import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

// Define the schema for security monitoring triggers
const securityMonitoringSchema = z.object({
  monitoringType: z.enum(['SCHEDULED', 'EVENT_TRIGGERED', 'MANUAL']).describe('Type of monitoring operation'),
  eventData: z.object({
    eventType: z.string().optional().describe('Type of security event that triggered monitoring'),
    agentName: z.string().optional().describe('Name of the agent involved in the event'),
    ipAddress: z.string().optional().describe('IP address associated with the event'),
    timestamp: z.string().datetime().optional().describe('Time of the event'),
    severity: z.enum(['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional().describe('Severity of the event'),
    details: z.string().optional().describe('Additional details about the event'),
  }).optional(),
  timeRange: z.object({
    startTime: z.string().datetime().optional().describe('Start time for analysis period'),
    endTime: z.string().datetime().optional().describe('End time for analysis period'),
  }).optional(),
  alertThreshold: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM').describe('Threshold for security alerts'),
});

// Agent for security assessment
const securityAssessmentAgent = new Agent({
  name: 'Security Assessment Agent',
  model: openai('gpt-4o'),
  instructions: `
    You are a security assessment agent for the Agent Naming Service.
    Your task is to analyze security events and patterns to identify threats.
    
    For each set of security events:
    1. Identify common patterns and anomalies
    2. Assess the severity and urgency of detected threats
    3. Recommend appropriate security actions
    4. Provide detailed reasoning for your assessment
    
    Your analysis should focus on:
    - Login patterns and authentication failures
    - Access control violations
    - Resolution pattern anomalies
    - Certificate-related issues
    - API rate limit violations
    - Unusual traffic patterns
    
    Format your response as a JSON object with:
    - threat_assessment: Summary of threats detected
    - severity: Overall severity (INFO, LOW, MEDIUM, HIGH, CRITICAL)
    - recommended_actions: List of specific actions to take
    - detailed_analysis: In-depth explanation of your findings
  `,
});

// Helper function to convert severity string to numeric level
function severityLevel(severity: string): number {
  switch (severity) {
    case 'CRITICAL': return 4;
    case 'HIGH': return 3;
    case 'MEDIUM': return 2;
    case 'LOW': return 1;
    case 'INFO':
    case 'NONE':
    default: return 0;
  }
}

// Define output schemas for the steps
const securityEventsSchema = z.object({
  monitoringType: z.string(),
  timeRange: z.object({
    startTime: z.string(),
    endTime: z.string(),
  }),
  events: z.array(z.object({
    id: z.string(),
    eventType: z.string(),
    agentName: z.string().optional(),
    ipAddress: z.string().optional(),
    timestamp: z.string(),
    severity: z.string(),
    details: z.string().optional(),
  })),
  alertThreshold: z.string(),
  collectionStatus: z.string(),
  issues: z.array(z.string()),
});

const analysisResultSchema = z.object({
  monitoringType: z.string(),
  timeRange: z.object({
    startTime: z.string(),
    endTime: z.string(),
  }),
  eventCount: z.number(),
  patternsSummary: z.object({
    totalEvents: z.number(),
    eventTypes: z.record(z.string(), z.number()),
    severityCounts: z.record(z.string(), z.number()),
    agentNameCounts: z.record(z.string(), z.number()),
    ipAddressCounts: z.record(z.string(), z.number()),
  }),
  anomalies: z.array(z.any()),
  threatPatterns: z.array(z.any()),
  analysisStatus: z.string(),
  alertLevel: z.string(),
  issues: z.array(z.string()),
});

const securityActionsSchema = z.object({
  alertLevel: z.string(),
  analysisStatus: z.string(),
  actions: z.array(z.any()),
  automatedActions: z.array(z.any()),
  manualActions: z.array(z.any()),
  notificationTargets: z.array(z.string()),
  actionStatus: z.string(),
  issues: z.array(z.string()),
});

// Step 1: Collect Security Events
const collectSecurityEvents = new Step({
  id: 'collect-security-events',
  description: 'Collects security events for analysis',
  inputSchema: securityMonitoringSchema,
  outputSchema: securityEventsSchema,
  execute: async ({ context }) => {
    // Get the trigger data for security monitoring
    const triggerData = context.getStepResult('trigger');
    
    if (!triggerData) {
      throw new Error('Security monitoring data not found in trigger');
    }
    
    // Extract monitoring details
    const { monitoringType, eventData, timeRange: inputTimeRange, alertThreshold } = triggerData;
    
    // Initialize collection result
    const collectionResult = {
      monitoringType,
      timeRange: {
        startTime: '',
        endTime: '',
      },
      events: [] as any[],
      alertThreshold: alertThreshold || 'MEDIUM',
      collectionStatus: 'PENDING',
      issues: [] as string[],
    };
    
    try {
      // Determine time range for event collection
      const now = new Date();
      let startTime, endTime;
      
      if (inputTimeRange?.startTime && inputTimeRange?.endTime) {
        // Use provided time range
        startTime = new Date(inputTimeRange.startTime);
        endTime = new Date(inputTimeRange.endTime);
      } else if (monitoringType === 'EVENT_TRIGGERED' && eventData?.timestamp) {
        // For event-triggered monitoring, look at events from 24 hours before the trigger event
        const eventTime = new Date(eventData.timestamp);
        startTime = new Date(eventTime);
        startTime.setHours(startTime.getHours() - 24);
        endTime = now;
      } else {
        // Default: last hour for scheduled monitoring
        startTime = new Date(now);
        startTime.setHours(startTime.getHours() - 1);
        endTime = now;
      }
      
      // Format time range
      collectionResult.timeRange = {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      };
      
      // Build query criteria for event collection
      const queryCriteria: any = {
        timeRange: {
          start: startTime.toISOString(),
          end: endTime.toISOString(),
        },
      };
      
      // Add additional criteria if event data is provided
      if (eventData) {
        if (eventData.agentName) {
          queryCriteria.agentName = eventData.agentName;
        }
        if (eventData.ipAddress) {
          queryCriteria.ipAddress = eventData.ipAddress;
        }
        if (eventData.eventType) {
          queryCriteria.eventType = eventData.eventType;
        }
        if (eventData.severity) {
          queryCriteria.minSeverity = eventData.severity;
        }
      }
      
      // Execute query to collect security events
      // In a real implementation, this would query a security event database
      // Mock implementation for design purposes
      const securityEvents = [
        // Mock events - in a real system these would come from a database
        {
          id: `event-${Date.now()}-1`,
          eventType: 'FAILED_LOGIN',
          agentName: 'test-agent',
          ipAddress: '192.168.1.100',
          timestamp: new Date(now.getTime() - 45 * 60 * 1000).toISOString(), // 45 mins ago
          severity: 'MEDIUM',
          details: 'Failed login attempt',
        },
        {
          id: `event-${Date.now()}-2`,
          eventType: 'UNAUTHORIZED_ACCESS',
          agentName: 'test-agent',
          ipAddress: '192.168.1.100',
          timestamp: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), // 30 mins ago
          severity: 'HIGH',
          details: 'Attempted to access restricted endpoint',
        },
        {
          id: `event-${Date.now()}-3`,
          eventType: 'CERTIFICATE_ERROR',
          agentName: 'another-agent',
          ipAddress: '192.168.1.101',
          timestamp: new Date(now.getTime() - 15 * 60 * 1000).toISOString(), // 15 mins ago
          severity: 'LOW',
          details: 'Certificate validation warning',
        },
      ];
      
      // Add the collected events to the result
      collectionResult.events = securityEvents;
      collectionResult.collectionStatus = 'COMPLETED';
      
      // Log event count
      if (securityEvents.length === 0) {
        collectionResult.issues.push('No security events found in the specified time range');
      }
      
      return collectionResult;
    } catch (error) {
      collectionResult.collectionStatus = 'FAILED';
      collectionResult.issues.push(`Failed to collect security events: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return collectionResult;
    }
  },
});

// Step 2: Analyze Event Patterns
const analyzeEventPatterns = new Step({
  id: 'analyze-event-patterns',
  description: 'Analyzes security events to identify patterns and anomalies',
  execute: async ({ context }) => {
    // Get collected events from previous step
    const collectionResult = context.getStepResult(collectSecurityEvents);
    
    if (!collectionResult) {
      throw new Error('Security event collection result not found');
    }
    
    // Extract events and metadata
    const { events, monitoringType, timeRange, alertThreshold } = collectionResult;
    
    // Initialize analysis result
    const analysisResult = {
      monitoringType,
      timeRange,
      eventCount: events.length,
      patternsSummary: {
        totalEvents: events.length,
        eventTypes: {} as Record<string, number>,
        severityCounts: {} as Record<string, number>,
        agentNameCounts: {} as Record<string, number>,
        ipAddressCounts: {} as Record<string, number>,
      },
      anomalies: [] as any[],
      threatPatterns: [] as any[],
      analysisStatus: 'COMPLETED',
      alertLevel: 'NONE',
      issues: [] as string[],
    };
    
    try {
      // Skip analysis if no events were collected
      if (events.length === 0) {
        analysisResult.analysisStatus = 'SKIPPED';
        analysisResult.issues.push('No events available for analysis');
        return analysisResult;
      }
      
      // Count events by type, severity, agent name, and IP address
      events.forEach(event => {
        // Count by event type
        analysisResult.patternsSummary.eventTypes[event.eventType] = 
          (analysisResult.patternsSummary.eventTypes[event.eventType] || 0) + 1;
        
        // Count by severity
        analysisResult.patternsSummary.severityCounts[event.severity] = 
          (analysisResult.patternsSummary.severityCounts[event.severity] || 0) + 1;
        
        // Count by agent name (if present)
        if (event.agentName) {
          analysisResult.patternsSummary.agentNameCounts[event.agentName] = 
            (analysisResult.patternsSummary.agentNameCounts[event.agentName] || 0) + 1;
        }
        
        // Count by IP address (if present)
        if (event.ipAddress) {
          analysisResult.patternsSummary.ipAddressCounts[event.ipAddress] = 
            (analysisResult.patternsSummary.ipAddressCounts[event.ipAddress] || 0) + 1;
        }
      });
      
      // Analyze for anomalies and patterns
      
      // 1. Check for high frequency of events from a single IP
      const ipThreshold = monitoringType === 'SCHEDULED' ? 5 : 3;
      Object.entries(analysisResult.patternsSummary.ipAddressCounts).forEach(([ip, count]) => {
        if (count >= ipThreshold) {
          analysisResult.anomalies.push({
            type: 'HIGH_EVENT_FREQUENCY',
            source: ip,
            count,
            severity: count >= ipThreshold * 2 ? 'HIGH' : 'MEDIUM',
            description: `High frequency of events (${count}) from IP address ${ip}`,
          });
        }
      });
      
      // 2. Check for failed login patterns
      const failedLoginEvents = events.filter(e => e.eventType === 'FAILED_LOGIN');
      if (failedLoginEvents.length >= 3) {
        // Group by IP
        const ipGroups: Record<string, any[]> = {};
        failedLoginEvents.forEach(event => {
          if (event.ipAddress) {
            ipGroups[event.ipAddress] = ipGroups[event.ipAddress] || [];
            ipGroups[event.ipAddress].push(event);
          }
        });
        
        // Check for failed logins from the same IP
        Object.entries(ipGroups).forEach(([ip, ipEvents]) => {
          if (ipEvents.length >= 3) {
            analysisResult.threatPatterns.push({
              type: 'BRUTE_FORCE_ATTEMPT',
              source: ip,
              count: ipEvents.length,
              severity: ipEvents.length >= 5 ? 'HIGH' : 'MEDIUM',
              description: `Possible brute force attempt: ${ipEvents.length} failed logins from IP ${ip}`,
              events: ipEvents.map(e => e.id),
            });
          }
        });
      }
      
      // 3. Check for escalation pattern (failed login followed by unauthorized access)
      events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      const ipTimelines: Record<string, any[]> = {};
      
      // Group events by IP address
      events.forEach(event => {
        if (event.ipAddress) {
          ipTimelines[event.ipAddress] = ipTimelines[event.ipAddress] || [];
          ipTimelines[event.ipAddress].push(event);
        }
      });
      
      // Check each IP's timeline for escalation patterns
      Object.entries(ipTimelines).forEach(([ip, timeline]) => {
        for (let i = 0; i < timeline.length - 1; i++) {
          if (timeline[i].eventType === 'FAILED_LOGIN' && 
              timeline[i+1].eventType === 'UNAUTHORIZED_ACCESS') {
            
            analysisResult.threatPatterns.push({
              type: 'ESCALATION_PATTERN',
              source: ip,
              severity: 'HIGH',
              description: `Potential breach: Failed login followed by unauthorized access from IP ${ip}`,
              events: [timeline[i].id, timeline[i+1].id],
            });
          }
        }
      });
      
      // 4. Check for certificate-related issues
      const certEvents = events.filter(e => 
        e.eventType.includes('CERTIFICATE') || e.details?.includes('certificate')
      );
      
      if (certEvents.length > 0) {
        // Group by agent
        const agentGroups: Record<string, any[]> = {};
        certEvents.forEach(event => {
          if (event.agentName) {
            agentGroups[event.agentName] = agentGroups[event.agentName] || [];
            agentGroups[event.agentName].push(event);
          }
        });
        
        // Check for multiple certificate issues for the same agent
        Object.entries(agentGroups).forEach(([agent, agentEvents]) => {
          if (agentEvents.length >= 2) {
            analysisResult.threatPatterns.push({
              type: 'CERTIFICATE_ISSUE_PATTERN',
              agent,
              count: agentEvents.length,
              severity: 'MEDIUM',
              description: `Multiple certificate issues detected for agent ${agent}`,
              events: agentEvents.map(e => e.id),
            });
          }
        });
      }
      
      // Use AI for enhanced pattern detection for more complex cases
      if (events.length > 5 && (analysisResult.anomalies.length > 0 || analysisResult.threatPatterns.length > 0)) {
        try {
          // Prepare data for AI analysis
          const eventSummary = {
            events: events.map(e => ({
              type: e.eventType,
              agent: e.agentName,
              ip: e.ipAddress,
              severity: e.severity,
              time: e.timestamp,
              details: e.details,
            })),
            detectedPatterns: [
              ...analysisResult.anomalies.map(a => a.type),
              ...analysisResult.threatPatterns.map(t => t.type),
            ],
            timeRange,
          };
          
          // Call the security assessment agent
          const response = await securityAssessmentAgent.stream([
            {
              role: 'user',
              content: `Analyze these security events for threat patterns:\n\n${JSON.stringify(eventSummary, null, 2)}`,
            }
          ]);
          
          // Collect the streamed response
          let analysisText = '';
          for await (const chunk of response.textStream) {
            analysisText += chunk;
          }
          
          // Try to parse AI response as JSON
          try {
            const aiAnalysis = JSON.parse(analysisText);
            
            // Add any new threats detected by AI
            if (aiAnalysis.additional_patterns) {
              for (const pattern of aiAnalysis.additional_patterns) {
                analysisResult.threatPatterns.push({
                  type: pattern.type,
                  severity: pattern.severity,
                  description: pattern.description,
                  aiDetected: true,
                  confidence: pattern.confidence || 0.7,
                });
              }
            }
            
            // Consider AI severity assessment
            if (aiAnalysis.severity) {
              // We'll give some weight to the AI's assessment
              if (severityLevel(aiAnalysis.severity) > severityLevel(analysisResult.alertLevel)) {
                analysisResult.alertLevel = aiAnalysis.severity;
              }
            }
          } catch (parseError) {
            // Continue with basic analysis if parsing fails
            console.error('Failed to parse AI analysis:', parseError);
          }
        } catch (aiError) {
          // Continue with basic analysis if AI analysis fails
          console.error('Error during AI security analysis:', aiError);
        }
      }
      
      // Determine overall alert level based on findings and threshold
      if (analysisResult.alertLevel === 'NONE') {
        if (analysisResult.threatPatterns.some(p => p.severity === 'CRITICAL')) {
          analysisResult.alertLevel = 'CRITICAL';
        } else if (analysisResult.threatPatterns.some(p => p.severity === 'HIGH')) {
          analysisResult.alertLevel = 'HIGH';
        } else if (analysisResult.threatPatterns.some(p => p.severity === 'MEDIUM')) {
          analysisResult.alertLevel = 'MEDIUM';
        } else if (analysisResult.anomalies.length > 0) {
          analysisResult.alertLevel = 'LOW';
        }
      }
      
      return analysisResult;
    } catch (error) {
      analysisResult.analysisStatus = 'FAILED';
      analysisResult.issues.push(`Failed to analyze security events: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return analysisResult;
    }
  },
});

// Step 3: Determine Security Actions
const determineSecurityActions = new Step({
  id: 'determine-security-actions',
  description: 'Determines appropriate security actions based on analysis results',
  execute: async ({ context }) => {
    // Get analysis result from previous step
    const analysisResult = context.getStepResult(analyzeEventPatterns);
    
    if (!analysisResult) {
      throw new Error('Event analysis result not found');
    }
    
    // Cast the analysis result to the expected type
    const typedAnalysisResult = analysisResult as {
      alertLevel: string;
      anomalies: any[];
      threatPatterns: any[];
      monitoringType: string;
      analysisStatus: string;
      issues: string[];
    };
    
    // Extract key information
    const {
      alertLevel,
      anomalies,
      threatPatterns,
      monitoringType,
      analysisStatus,
      issues: analysisIssues,
    } = typedAnalysisResult;
    
    // Initialize security actions result
    const actionsResult = {
      alertLevel,
      analysisStatus,
      actions: [] as any[],
      automatedActions: [] as any[],
      manualActions: [] as any[],
      notificationTargets: [] as string[],
      actionStatus: 'PENDING',
      issues: [...(analysisIssues || [])],
    };
    
    try {
      // Skip action determination if analysis failed or was skipped
      if (analysisStatus !== 'COMPLETED') {
        actionsResult.actionStatus = 'SKIPPED';
        actionsResult.issues.push('Cannot determine actions due to incomplete analysis');
        return actionsResult;
      }
      
      // Define action severity threshold based on monitoring type
      // For event-triggered monitoring, we may want to take action even at lower severity
      const actionThreshold = monitoringType === 'EVENT_TRIGGERED' ? 'LOW' : 'MEDIUM';
      
      // Skip actions if alert level is below threshold
      const severityLevels = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
      const alertLevelIndex = severityLevels.indexOf(alertLevel);
      const thresholdIndex = severityLevels.indexOf(actionThreshold);
      
      if (alertLevelIndex < thresholdIndex) {
        actionsResult.actionStatus = 'SKIPPED';
        actionsResult.issues.push(`Alert level ${alertLevel} is below the action threshold ${actionThreshold}`);
        return actionsResult;
      }
      
      // Determine notification targets based on severity
      if (alertLevel === 'CRITICAL') {
        actionsResult.notificationTargets = ['security-team', 'admin', 'ops-team'];
      } else if (alertLevel === 'HIGH') {
        actionsResult.notificationTargets = ['security-team', 'admin'];
      } else if (alertLevel === 'MEDIUM') {
        actionsResult.notificationTargets = ['security-team'];
      } else {
        actionsResult.notificationTargets = ['monitoring-system'];
      }
      
      // Define actions based on detected patterns
      
      // 1. Actions for brute force attempts
      const bruteForcePatterns = threatPatterns.filter((p: any) => p.type === 'BRUTE_FORCE_ATTEMPT');
      bruteForcePatterns.forEach((pattern: any) => {
        // Add IP block action for severe brute force attempts
        if (pattern.severity === 'HIGH') {
          actionsResult.automatedActions.push({
            id: `action-block-ip-${Date.now()}-${pattern.source}`,
            type: 'BLOCK_IP',
            target: pattern.source,
            duration: '24h',
            reason: pattern.description,
            severity: pattern.severity,
          });
        }
        
        // Add increased monitoring for all brute force attempts
        actionsResult.automatedActions.push({
          id: `action-monitor-ip-${Date.now()}-${pattern.source}`,
          type: 'ENHANCED_MONITORING',
          target: pattern.source,
          duration: '48h',
          reason: pattern.description,
          severity: pattern.severity,
        });
      });
      
      // 2. Actions for escalation patterns (failed login followed by unauthorized access)
      const escalationPatterns = threatPatterns.filter(p => p.type === 'ESCALATION_PATTERN');
      escalationPatterns.forEach(pattern => {
        // These are high severity and may indicate an active breach
        actionsResult.automatedActions.push({
          id: `action-block-ip-${Date.now()}-${pattern.source}`,
          type: 'BLOCK_IP',
          target: pattern.source,
          duration: '48h', // Longer block for escalation patterns
          reason: pattern.description,
          severity: 'HIGH',
        });
        
        // Add a manual review action
        actionsResult.manualActions.push({
          id: `action-review-escalation-${Date.now()}`,
          type: 'SECURITY_REVIEW',
          target: pattern.source,
          urgency: 'HIGH',
          assignedTo: 'security-team',
          reason: pattern.description,
        });
      });
      
      // 3. Actions for certificate issues
      const certificatePatterns = threatPatterns.filter(p => p.type === 'CERTIFICATE_ISSUE_PATTERN');
      certificatePatterns.forEach(pattern => {
        // Add certificate rotation action
        actionsResult.automatedActions.push({
          id: `action-rotate-cert-${Date.now()}-${pattern.agent}`,
          type: 'ROTATE_CERTIFICATE',
          target: pattern.agent,
          reason: pattern.description,
          severity: pattern.severity,
        });
      });
      
      // Combine automated and manual actions into the main actions array
      actionsResult.actions = [
        ...actionsResult.automatedActions,
        ...actionsResult.manualActions,
      ];
      
      actionsResult.actionStatus = 'COMPLETED';
      return actionsResult;
    } catch (error) {
      actionsResult.actionStatus = 'FAILED';
      actionsResult.issues.push(`Failed to determine security actions: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return actionsResult;
    }
  },
});

// Step 4: Execute Security Actions
const executeSecurityActions = new Step({
  id: 'execute-security-actions',
  description: 'Executes the determined security actions',
  inputSchema: securityActionsSchema,
  outputSchema: z.object({
    alertLevel: z.string(),
    actionStatus: z.string(),
    executedActions: z.array(z.object({
      id: z.string(),
      type: z.string(),
      target: z.string().optional(),
      status: z.string(),
      timestamp: z.string(),
      details: z.string().optional(),
    })),
    executionSummary: z.string(),
    issues: z.array(z.string()),
  }),
  execute: async ({ context }) => {
    // Get the actions from the previous step
    const actionsResult = context.getStepResult(determineSecurityActions);
    
    if (!actionsResult) {
      throw new Error('Security actions result not found');
    }
    
    // Cast to expected type
    const typedActionsResult = actionsResult as {
      alertLevel: string;
      actions: any[];
      actionStatus: string;
      issues: string[];
    };
    
    // Extract key information
    const {
      alertLevel,
      actions,
      actionStatus,
      issues: actionIssues
    } = typedActionsResult;
    
    // Initialize execution result
    const executionResult = {
      alertLevel,
      actionStatus: 'PENDING',
      executedActions: [] as any[],
      executionSummary: '',
      issues: [...(actionIssues || [])],
    };
    
    try {
      // Skip execution if no actions were determined or previous step failed
      if (actionStatus !== 'COMPLETED' || actions.length === 0) {
        executionResult.actionStatus = 'SKIPPED';
        executionResult.issues.push(`No actions to execute: ${actionStatus}`);
        return executionResult;
      }
      
      // Track success and failure counts for summary
      let succeededCount = 0;
      let failedCount = 0;
      
      // Execute each action
      for (const action of actions) {
        try {
          // In a real implementation, these would call other services
          // or perform actual security actions
          let status = 'SUCCEEDED';
          let details = '';
          
          // Simulate different execution logic based on action type
          switch (action.type) {
            case 'BLOCK_IP':
              details = `IP ${action.target} blocked for ${action.duration}`;
              break;
            case 'ENHANCED_MONITORING':
              details = `Enhanced monitoring enabled for ${action.target} for ${action.duration}`;
              break;
            case 'ROTATE_CERTIFICATE':
              details = `Certificate rotation initiated for agent ${action.target}`;
              break;
            case 'SECURITY_REVIEW':
              status = 'PENDING'; // Manual actions are marked as pending
              details = `Security review task created and assigned to ${action.assignedTo}`;
              break;
            default:
              details = `Action executed: ${action.type}`;
          }
          
          // Record the executed action
          executionResult.executedActions.push({
            id: action.id,
            type: action.type,
            target: action.target,
            status,
            timestamp: new Date().toISOString(),
            details,
          });
          
          if (status === 'SUCCEEDED') {
            succeededCount++;
          } else {
            // For pending manual actions, we still count them separately
            if (status === 'PENDING') {
              executionResult.issues.push(`Manual action required: ${action.type} for ${action.target}`);
            }
          }
        } catch (actionError) {
          failedCount++;
          executionResult.executedActions.push({
            id: action.id,
            type: action.type,
            target: action.target,
            status: 'FAILED',
            timestamp: new Date().toISOString(),
            details: `Failed to execute ${action.type}: ${actionError instanceof Error ? actionError.message : 'Unknown error'}`,
          });
          executionResult.issues.push(`Action execution failed: ${action.type} for ${action.target}`);
        }
      }
      
      // Create a summary of execution
      executionResult.executionSummary = `Executed ${actions.length} security actions: ${succeededCount} succeeded, ${failedCount} failed, ${actions.length - succeededCount - failedCount} pending`;
      
      // Set final execution status
      if (failedCount === 0) {
        if (succeededCount === actions.length) {
          executionResult.actionStatus = 'COMPLETED';
        } else {
          executionResult.actionStatus = 'PARTIAL';
        }
      } else if (succeededCount === 0) {
        executionResult.actionStatus = 'FAILED';
      } else {
        executionResult.actionStatus = 'PARTIAL';
      }
      
      return executionResult;
    } catch (error) {
      executionResult.actionStatus = 'FAILED';
      executionResult.issues.push(`Failed to execute security actions: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return executionResult;
    }
  },
});

// Create the security monitoring workflow
const securityMonitoringWorkflow = new Workflow({
  name: 'security-monitoring-workflow',
  triggerSchema: securityMonitoringSchema,
})
  .step(collectSecurityEvents)
  .then(analyzeEventPatterns)
  .then(determineSecurityActions)
  .then(executeSecurityActions);

// Commit the workflow to make it active
securityMonitoringWorkflow.commit();

// Export the workflow
export { securityMonitoringWorkflow };
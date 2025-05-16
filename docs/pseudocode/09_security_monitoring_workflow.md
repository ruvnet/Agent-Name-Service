# Security Monitoring Workflow

## Overview

The Security Monitoring Workflow provides continuous monitoring and analysis of agent behavior and interactions for security threats. This workflow collects security events, analyzes patterns, detects anomalies, and triggers appropriate responses to maintain the security integrity of the Agent Naming Service.

## Workflow Components

### Input Schema

```typescript
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
```

### Steps

#### 1. Collect Security Events

```typescript
const collectSecurityEvents = new Step({
  id: 'collect-security-events',
  description: 'Collects security events for analysis',
  inputSchema: securityMonitoringSchema,
  outputSchema: z.object({
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
  }),
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
      events: [],
      alertThreshold: alertThreshold || 'MEDIUM',
      collectionStatus: 'PENDING',
      issues: [],
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
        // Add more mock events as needed
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
      collectionResult.issues.push(`Failed to collect security events: ${error.message || 'Unknown error'}`);
      return collectionResult;
    }
  },
});

// TEST: Should collect events within the specified time range
// TEST: Should filter events based on provided criteria (agent name, IP, event type)
// TEST: Should default to the last hour when no time range is provided
// TEST: Should look back 24 hours for event-triggered monitoring
// TEST: Should handle event collection errors gracefully
```

#### 2. Analyze Event Patterns

```typescript
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
        Object.entries(ipGroups).forEach(([ip, events]) => {
          if (events.length >= 3) {
            analysisResult.threatPatterns.push({
              type: 'BRUTE_FORCE_ATTEMPT',
              source: ip,
              count: events.length,
              severity: events.length >= 5 ? 'HIGH' : 'MEDIUM',
              description: `Possible brute force attempt: ${events.length} failed logins from IP ${ip}`,
              events: events.map(e => e.id),
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
      
      // Determine overall alert level based on findings and threshold
      if (analysisResult.threatPatterns.some(p => p.severity === 'CRITICAL')) {
        analysisResult.alertLevel = 'CRITICAL';
      } else if (analysisResult.threatPatterns.some(p => p.severity === 'HIGH')) {
        analysisResult.alertLevel = 'HIGH';
      } else if (analysisResult.threatPatterns.some(p => p.severity === 'MEDIUM')) {
        analysisResult.alertLevel = 'MEDIUM';
      } else if (analysisResult.anomalies.length > 0) {
        analysisResult.alertLevel = 'LOW';
      }
      
      return analysisResult;
    } catch (error) {
      analysisResult.analysisStatus = 'FAILED';
      analysisResult.issues.push(`Failed to analyze security events: ${error.message || 'Unknown error'}`);
      return analysisResult;
    }
  },
});

// TEST: Should identify high frequency events from the same IP
// TEST: Should detect brute force login attempts
// TEST: Should identify escalation patterns (failed login followed by unauthorized access)
// TEST: Should properly count events by type, severity, agent, and IP
// TEST: Should correctly determine alert level based on findings
```

#### 3. Determine Security Actions

```typescript
const determineSecurityActions = new Step({
  id: 'determine-security-actions',
  description: 'Determines appropriate security actions based on analysis results',
  execute: async ({ context }) => {
    // Get analysis result from previous step
    const analysisResult = context.getStepResult(analyzeEventPatterns);
    
    if (!analysisResult) {
      throw new Error('Event analysis result not found');
    }
    
    // Extract key information
    const { 
      alertLevel, 
      anomalies, 
      threatPatterns, 
      monitoringType,
      analysisStatus,
      issues: analysisIssues,
    } = analysisResult;
    
    // Initialize security actions result
    const actionsResult = {
      alertLevel,
      analysisStatus,
      actions: [] as any[],
      automatedActions: [] as any[],
      manualActions: [] as any[],
      notificationTargets: [] as string[],
      actionStatus: 'PENDING',
      issues: [...analysisIssues],
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
      
      // Process threat patterns and determine appropriate actions
      threatPatterns.forEach(pattern => {
        switch (pattern.type) {
          case 'BRUTE_FORCE_ATTEMPT':
            // Add IP blocking action for brute force attempts
            actionsResult.actions.push({
              type: 'BLOCK_IP',
              source: pattern.source,
              duration: '24h',
              severity: pattern.severity,
              automated: alertLevelIndex >= 3, // Automate if HIGH or CRITICAL
              reason: `Blocking IP ${pattern.source} due to brute force attempts`,
            });
            
            // Add account lockout for affected agents
            const affectedAgents = new Set<string>();
            pattern.events.forEach((eventId: string) => {
              const event = analysisResult.events?.find((e: any) => e.id === eventId);
              if (event?.agentName) {
                affectedAgents.add(event.agentName);
              }
            });
            
            affectedAgents.forEach(agentName => {
              actionsResult.actions.push({
                type: 'LOCK_AGENT',
                agentName,
                duration: '1h',
                severity: pattern.severity,
                automated: alertLevelIndex >= 4, // Only automate if CRITICAL
                reason: `Temporarily locking agent ${agentName} due to brute force attempts`,
              });
            });
            break;
            
          case 'ESCALATION_PATTERN':
            // For escalation patterns, take stronger actions
            actionsResult.actions.push({
              type: 'BLOCK_IP',
              source: pattern.source,
              duration: '72h', // Longer block for escalation
              severity: 'HIGH',
              automated: true, // Always automate for escalation
              reason: `Blocking IP ${pattern.source} due to suspicious escalation pattern`,
            });
            
            // Revoke certificates for affected agents
            const compromisedAgents = new Set<string>();
            pattern.events.forEach((eventId: string) => {
              const event = analysisResult.events?.find((e: any) => e.id === eventId);
              if (event?.agentName) {
                compromisedAgents.add(event.agentName);
              }
            });
            
            compromisedAgents.forEach(agentName => {
              actionsResult.actions.push({
                type: 'REVOKE_CERTIFICATE',
                agentName,
                severity: 'HIGH',
                automated: alertLevelIndex >= 3, // Automate if HIGH or CRITICAL
                reason: `Revoking certificate for agent ${agentName} due to suspected compromise`,
              });
            });
            break;
        }
      });
      
      // Process anomalies and determine appropriate actions
      anomalies.forEach(anomaly => {
        switch (anomaly.type) {
          case 'HIGH_EVENT_FREQUENCY':
            // Rate limiting for high frequency events
            actionsResult.actions.push({
              type: 'RATE_LIMIT',
              source: anomaly.source,
              duration: '1h',
              severity: anomaly.severity,
              automated: anomaly.severity === 'HIGH', // Automate only if HIGH
              reason: `Applying rate limiting to IP ${anomaly.source} due to high event frequency`,
            });
            break;
        }
      });
      
      // Separate actions into automated and manual
      actionsResult.automatedActions = actionsResult.actions.filter(action => action.automated);
      actionsResult.manualActions = actionsResult.actions.filter(action => !action.automated);
      
      // Determine notification targets based on alert level
      if (alertLevel === 'CRITICAL') {
        actionsResult.notificationTargets = ['security_team', 'admin', 'soc', 'sms_alert'];
      } else if (alertLevel === 'HIGH') {
        actionsResult.notificationTargets = ['security_team', 'admin', 'email_alert'];
      } else if (alertLevel === 'MEDIUM') {
        actionsResult.notificationTargets = ['security_team', 'email_alert'];
      } else if (alertLevel === 'LOW') {
        actionsResult.notificationTargets = ['security_log'];
      }
      
      actionsResult.actionStatus = 'DETERMINED';
      return actionsResult;
    } catch (error) {
      actionsResult.actionStatus = 'FAILED';
      actionsResult.issues.push(`Failed to determine security actions: ${error.message || 'Unknown error'}`);
      return actionsResult;
    }
  },
});

// TEST: Should create appropriate actions for brute force attempts
// TEST: Should create stronger actions for escalation patterns
// TEST: Should correctly separate automated and manual actions
// TEST: Should determine notification targets based on alert level
// TEST: Should respect the action threshold based on monitoring type
```

#### 4. Execute Automated Actions

```typescript
const executeAutomatedActions = new Step({
  id: 'execute-automated-actions',
  description: 'Executes automated security actions',
  execute: async ({ context }) => {
    // Get actions from previous step
    const actionsResult = context.getStepResult(determineSecurityActions);
    
    if (!actionsResult) {
      throw new Error('Security actions result not found');
    }
    
    // Extract automated actions
    const { automatedActions, alertLevel, actionStatus } = actionsResult;
    
    // Initialize execution result
    const executionResult = {
      alertLevel,
      actionsAttempted: 0,
      actionsSucceeded: 0,
      actionsFailed: 0,
      executionStatus: 'PENDING',
      actionResults: [] as any[],
      manualActions: actionsResult.manualActions,
      notificationTargets: actionsResult.notificationTargets,
      issues: [] as string[],
    };
    
    try {
      // Skip execution if no actions were determined or action determination failed
      if (actionStatus !== 'DETERMINED' || automatedActions.length === 0) {
        executionResult.executionStatus = 'SKIPPED';
        executionResult.issues.push('No automated actions to execute');
        return executionResult;
      }
      
      // Execute each automated action
      for (const action of automatedActions) {
        executionResult.actionsAttempted++;
        
        try {
          // In a real implementation, this would execute actual security measures
          // Mock implementation for design purposes
          const actionResult = {
            type: action.type,
            target: action.source || action.agentName,
            executed: false,
            timestamp: new Date().toISOString(),
            success: false,
            details: '',
          };
          
          switch (action.type) {
            case 'BLOCK_IP':
              // Mock IP blocking logic
              console.log(`MOCK: Blocking IP ${action.source} for ${action.duration}`);
              actionResult.executed = true;
              actionResult.success = true;
              actionResult.details = `IP ${action.source} blocked for ${action.duration}`;
              break;
              
            case 'LOCK_AGENT':
              // Mock agent locking logic
              console.log(`MOCK: Locking agent ${action.agentName} for ${action.duration}`);
              actionResult.executed = true;
              actionResult.success = true;
              actionResult.details = `Agent ${action.agentName} locked for ${action.duration}`;
              break;
              
            case 'REVOKE_CERTIFICATE':
              // Mock certificate revocation logic
              console.log(`MOCK: Revoking certificate for agent ${action.agentName}`);
              actionResult.executed = true;
              actionResult.success = true;
              actionResult.details = `Certificate revoked for agent ${action.agentName}`;
              break;
              
            case 'RATE_LIMIT':
              // Mock rate limiting logic
              console.log(`MOCK: Rate limiting IP ${action.source} for ${action.duration}`);
              actionResult.executed = true;
              actionResult.success = true;
              actionResult.details = `Rate limiting applied to ${action.source} for ${action.duration}`;
              break;
              
            default:
              actionResult.details = `Unknown action type: ${action.type}`;
              actionResult.success = false;
          }
          
          // Update action counters
          if (actionResult.success) {
            executionResult.actionsSucceeded++;
          } else {
            executionResult.actionsFailed++;
          }
          
          // Add result to action results
          executionResult.actionResults.push(actionResult);
          
        } catch (actionError) {
          executionResult.actionsFailed++;
          executionResult.actionResults.push({
            type: action.type,
            target: action.source || action.agentName,
            executed: false,
            timestamp: new Date().toISOString(),
            success: false,
            details: `Action execution failed: ${actionError.message || 'Unknown error'}`,
          });
        }
      }
      
      // Determine overall execution status
      if (executionResult.actionsSucceeded === automatedActions.length) {
        executionResult.executionStatus = 'SUCCESS';
      } else if (executionResult.actionsSucceeded > 0) {
        executionResult.executionStatus = 'PARTIAL';
      } else {
        executionResult.executionStatus = 'FAILED';
      }
      
      return executionResult;
    } catch (error) {
      executionResult.executionStatus = 'FAILED';
      executionResult.issues.push(`Failed to execute security actions: ${error.message || 'Unknown error'}`);
      return executionResult;
    }
  },
});

// TEST: Should execute IP blocking actions correctly
// TEST: Should execute agent locking actions correctly
// TEST: Should execute certificate revocation actions correctly
// TEST: Should handle action execution errors gracefully
// TEST: Should report partial success if some actions succeed and others fail
```
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

#### 5. Create Security Report

```typescript
const createSecurityReport = new Step({
  id: 'create-security-report',
  description: 'Creates a comprehensive security report',
  execute: async ({ context }) => {
    // Get execution result from previous step
    const executionResult = context.getStepResult(executeAutomatedActions);
    
    if (!executionResult) {
      throw new Error('Action execution result not found');
    }
    
    // Get previous step results for comprehensive reporting
    const analysisResult = context.getStepResult(analyzeEventPatterns);
    const collectionResult = context.getStepResult(collectSecurityEvents);
    
    // Initialize report
    const report = {
      reportId: `security-report-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      summary: {
        alertLevel: executionResult.alertLevel,
        eventsAnalyzed: collectionResult?.events.length || 0,
        threatPatternsDetected: analysisResult?.threatPatterns.length || 0,
        anomaliesDetected: analysisResult?.anomalies.length || 0,
        actionsExecuted: executionResult.actionsSucceeded,
        actionsFailed: executionResult.actionsFailed,
        pendingManualActions: executionResult.manualActions.length,
      },
      timeRange: collectionResult?.timeRange,
      threatPatterns: analysisResult?.threatPatterns || [],
      anomalies: analysisResult?.anomalies || [],
      actionResults: executionResult.actionResults,
      pendingManualActions: executionResult.manualActions,
      notificationTargets: executionResult.notificationTargets,
      issues: [
        ...(collectionResult?.issues || []),
        ...(analysisResult?.issues || []),
        ...(executionResult.issues || [])
      ],
      recommendations: [] as string[],
    };
    
    try {
      // Generate recommendations based on findings
      if (report.summary.threatPatternsDetected > 0) {
        report.recommendations.push('Review security policies for affected agents');
        report.recommendations.push('Consider implementing additional authentication factors');
      }
      
      if (executionResult.manualActions.length > 0) {
        report.recommendations.push('Review and execute pending manual actions');
      }
      
      // Add threat-specific recommendations
      if (analysisResult?.threatPatterns) {
        const hasBruteForce = analysisResult.threatPatterns.some(p => p.type === 'BRUTE_FORCE_ATTEMPT');
        if (hasBruteForce) {
          report.recommendations.push('Implement progressive rate limiting for login attempts');
          report.recommendations.push('Consider CAPTCHA for authentication endpoints');
        }
        
        const hasEscalation = analysisResult.threatPatterns.some(p => p.type === 'ESCALATION_PATTERN');
        if (hasEscalation) {
          report.recommendations.push('Review access control policies and update as needed');
          report.recommendations.push('Consider implementing anomaly detection for user behavior');
        }
      }
      
      // Format the report as a string (e.g., for logging or notification)
      const formattedReport = JSON.stringify(report, null, 2);
      
      return {
        report,
        formattedReport,
        reportStatus: 'COMPLETED',
        alertLevel: executionResult.alertLevel,
        pendingManualActions: executionResult.manualActions,
        notificationTargets: executionResult.notificationTargets,
      };
    } catch (error) {
      return {
        report: {
          ...report,
          issues: [...report.issues, `Failed to create complete security report: ${error.message || 'Unknown error'}`],
        },
        formattedReport: JSON.stringify({
          reportId: report.reportId,
          generatedAt: report.generatedAt,
          summary: report.summary,
          error: `Failed to create complete security report: ${error.message || 'Unknown error'}`,
        }, null, 2),
        reportStatus: 'PARTIAL',
        alertLevel: executionResult.alertLevel,
        pendingManualActions: executionResult.manualActions,
        notificationTargets: executionResult.notificationTargets,
      };
    }
  },
});

// TEST: Should include all key components in the security report
// TEST: Should generate appropriate recommendations based on findings
// TEST: Should consolidate issues from all previous steps
// TEST: Should provide clear summaries of detected threats and anomalies
// TEST: Should handle report generation errors gracefully
```

### Complete Workflow

```typescript
// Create the security monitoring workflow
export const securityMonitoringWorkflow = new Workflow({
  name: 'security-monitoring-workflow',
  triggerSchema: securityMonitoringSchema,
})
  .step(collectSecurityEvents)
  .then(analyzeEventPatterns)
  .then(determineSecurityActions)
  .then(executeAutomatedActions)
  .then(createSecurityReport);

// Commit the workflow
securityMonitoringWorkflow.commit();
```

## Sequence Diagram

```
┌──────────────┐      ┌────────────────┐       ┌────────────────┐       ┌─────────────────┐       ┌──────────────────┐      ┌────────────────┐
│    Trigger   │      │collectEvents   │       │analyzePatterns │       │determineActions │       │executeActions    │      │createReport    │
└──────┬───────┘      └───────┬────────┘       └───────┬────────┘       └────────┬────────┘       └────────┬─────────┘      └───────┬────────┘
       │                      │                        │                         │                         │                        │
       │  Monitoring Request  │                        │                         │                         │                        │
       │─────────────────────>│                        │                         │                         │                        │
       │                      │                        │                         │                         │                        │
       │                      │ Collect Security       │                         │                         │                        │
       │                      │ Events                 │                         │                         │                        │
       │                      │────────────────────────>                         │                         │                        │
       │                      │                        │                         │                         │                        │
       │                      │                        │ Analyze Event           │                         │                        │
       │                      │                        │ Patterns                │                         │                        │
       │                      │                        │────────────────────────>│                         │                        │
       │                      │                        │                         │                         │                        │
       │                      │                        │                         │ Determine               │                        │
       │                      │                        │                         │ Security Actions        │                        │
       │                      │                        │                         │────────────────────────>│                        │
       │                      │                        │                         │                         │                        │
       │                      │                        │                         │                         │ Execute                │
       │                      │                        │                         │                         │ Automated Actions      │
       │                      │                        │                         │                         │───────────────────────>│
       │                      │                        │                         │                         │                        │
       │                      │                        │                         │                         │                        │ Create Security
       │                      │                        │                         │                         │                        │ Report
       │                      │                        │                         │                         │                        │───────────┐
       │                      │                        │                         │                         │                        │           │
       │                      │                        │                         │                         │                        │<──────────┘
       │                      │                        │                         │                         │                        │
       │   Security Report    │                        │                         │                         │                        │
       │<─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Error Handling

The security monitoring workflow implements comprehensive error handling:

1. **Graceful Degradation**: Each step continues processing even if parts of the analysis fail, with clear error documentation.

2. **Issue Tracking**: All issues are tracked throughout the workflow and consolidated in the final report.

3. **Status Flags**: Each step has clear status indicators (COMPLETED, PARTIAL, FAILED, SKIPPED) to track progress.

4. **Fallback Logic**: Even with partial failures, the workflow continues to generate valuable security insights.

5. **Exception Capture**: All exceptions are caught, sanitized, and included in the reporting without exposing sensitive details.

## Performance Considerations

1. **Configurable Time Ranges**: The workflow allows specifying time ranges to control the volume of events processed.

2. **Targeted Analysis**: For event-triggered monitoring, analysis focuses on relevant events around the trigger.

3. **Early Exit**: Processing stops early when no events are found or alert levels are below thresholds.

4. **Efficient Pattern Matching**: The pattern detection algorithms are optimized to handle large volumes of events.

5. **Consolidated Reporting**: Issues from all stages are aggregated at the end to avoid redundant processing.

## Security Considerations

1. **Defense in Depth**: Multiple detection mechanisms (pattern analysis, anomaly detection) provide layered security.

2. **Immediate Response**: Critical security issues trigger automated responses without human intervention.

3. **Threat-specific Actions**: Actions are tailored to the specific type and severity of detected threats.

4. **Clear Audit Trail**: All analysis steps, decisions, and actions are documented for audit purposes.

5. **Graduated Response**: Security actions escalate in severity based on the detected threat level.

## Implementation Guidelines

1. **Database Optimization**: The event collection phase should use optimized queries with proper indexing.

2. **Scaling**: For high-volume deployments, consider implementing the workflow with distributed processing.

3. **Notification Integration**: Connect notification targets to actual communication channels (email, SMS, ticketing systems).

4. **Action Execution**: Implement actual security controls for IP blocking, agent locking, and certificate revocation.

5. **Reporting Storage**: Store generated reports in a secure, tamper-evident storage system for future reference.

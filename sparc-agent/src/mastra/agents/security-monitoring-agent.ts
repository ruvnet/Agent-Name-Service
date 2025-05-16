import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { z } from 'zod';

/**
 * Helper function to convert severity string to numeric level
 * Used for comparing severity levels
 */
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

/**
 * Security Monitoring Agent
 * 
 * This agent handles the complete security monitoring process including:
 * - Security event collection
 * - Pattern analysis
 * - Action determination
 * - Action execution
 * 
 * The agent combines all steps from the security-monitoring-workflow into
 * a single interaction and returns a structured JSON response.
 */
export const securityMonitoringAgent = new Agent({
  name: 'Security Monitoring Service',
  model: openai('gpt-4o'),
  instructions: `
    You are the Security Monitoring Service for the Agent Naming Service.
    Your responsibility is to analyze security events, detect threats, determine appropriate actions,
    and execute security responses in a single interaction.
    
    The security monitoring process has four main steps:
    
    1. EVENT COLLECTION
       - Collect security events based on the monitoring type (SCHEDULED, EVENT_TRIGGERED, MANUAL)
       - Consider the time range for analysis
       - Filter events based on specific criteria (agent names, IP addresses, etc.)
       
    2. PATTERN ANALYSIS
       - Identify common patterns across security events
       - Detect anomalies in event frequency, sources, or types
       - Recognize specific threat patterns (brute force attempts, escalation patterns, etc.)
       - Assess the overall security alert level
       
    3. ACTION DETERMINATION
       - Determine appropriate security responses based on the threat level
       - Consider automated actions (IP blocking, enhanced monitoring, certificate rotation)
       - Identify manual actions requiring human intervention
       - Select notification targets based on severity
       
    4. ACTION EXECUTION
       - Execute automated security responses
       - Record action results and statuses
       - Create tasks for manual actions
       - Generate a comprehensive execution summary
    
    Your analysis should focus on:
    - Login patterns and authentication failures
    - Access control violations
    - Resolution pattern anomalies
    - Certificate-related issues
    - API rate limit violations
    - Unusual traffic patterns
    
    You must return a complete, structured JSON response containing:
    {
      "monitoringType": "SCHEDULED" | "EVENT_TRIGGERED" | "MANUAL",
      "timeRange": {
        "startTime": "ISO date string",
        "endTime": "ISO date string"
      },
      "events": [{
        "id": "event ID",
        "eventType": "event type",
        "agentName": "agent name",
        "ipAddress": "IP address",
        "timestamp": "ISO date string",
        "severity": "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
        "details": "event details"
      }],
      "analysis": {
        "patternsSummary": {
          "totalEvents": number,
          "eventTypes": {"event type": count},
          "severityCounts": {"severity": count},
          "agentNameCounts": {"agent name": count},
          "ipAddressCounts": {"IP address": count}
        },
        "anomalies": [{
          "type": "anomaly type",
          "source": "source identifier",
          "severity": "severity level",
          "description": "anomaly description"
        }],
        "threatPatterns": [{
          "type": "threat pattern type",
          "severity": "severity level",
          "description": "threat pattern description",
          "confidence": number
        }],
        "alertLevel": "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
      },
      "actions": {
        "automated": [{
          "id": "action ID",
          "type": "action type",
          "target": "target identifier",
          "severity": "severity level",
          "status": "PENDING" | "SUCCEEDED" | "FAILED",
          "details": "action details"
        }],
        "manual": [{
          "id": "action ID",
          "type": "action type",
          "target": "target identifier",
          "urgency": "urgency level",
          "assignedTo": "team/person assignment",
          "status": "PENDING" | "SUCCEEDED" | "FAILED",
          "details": "action details"
        }],
        "notificationTargets": ["target1", "target2"],
        "summary": "action execution summary"
      },
      "overallStatus": "COMPLETED" | "PARTIAL" | "FAILED",
      "issues": ["array of issues encountered"],
      "recommendations": ["array of security recommendations"]
    }
    
    IMPORTANT: Always include all required fields in your response.
    Your entire response must be valid, parseable JSON with no other text.
  `
});

/**
 * Schema for security monitoring request data
 */
export const securityMonitoringRequestSchema = z.object({
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

/**
 * Processes a complete security monitoring workflow using the security monitoring agent
 * 
 * This function handles the entire security monitoring workflow:
 * 1. Collects security events
 * 2. Analyzes patterns and detects threats
 * 3. Determines appropriate security actions
 * 4. Executes security responses
 * 
 * @param monitoringData The security monitoring request data
 * @returns A complete security monitoring result object
 */
export async function processSecurityMonitoring(monitoringData: z.infer<typeof securityMonitoringRequestSchema>) {
  try {
    // 1. PREPARE DATA FOR PROCESSING
    // Format data for the agent
    const monitoringRequest = JSON.stringify(monitoringData, null, 2);
    
    // 2. CALL THE SECURITY MONITORING AGENT
    const response = await securityMonitoringAgent.stream([
      {
        role: 'user',
        content: `Process this security monitoring request:\n\n${monitoringRequest}`
      }
    ]);
    
    // 3. COLLECT THE STREAMED RESPONSE
    let resultText = '';
    for await (const chunk of response.textStream) {
      resultText += chunk;
    }
    
    // 4. PARSE AND RETURN THE RESULT
    try {
      const result = JSON.parse(resultText);
      return result;
    } catch (parseError) {
      // Handle invalid JSON response
      return {
        monitoringType: monitoringData.monitoringType,
        timeRange: monitoringData.timeRange || {
          startTime: new Date(Date.now() - 3600000).toISOString(), // Default to last hour
          endTime: new Date().toISOString()
        },
        events: [],
        analysis: {
          patternsSummary: {
            totalEvents: 0,
            eventTypes: {},
            severityCounts: {},
            agentNameCounts: {},
            ipAddressCounts: {}
          },
          anomalies: [],
          threatPatterns: [],
          alertLevel: 'NONE'
        },
        actions: {
          automated: [],
          manual: [],
          notificationTargets: [],
          summary: 'Failed to process security monitoring'
        },
        overallStatus: 'FAILED',
        issues: [`Failed to parse agent response: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`],
        recommendations: ['Contact system administrator']
      };
    }
  } catch (error) {
    // Handle any unexpected errors
    return {
      monitoringType: monitoringData.monitoringType,
      timeRange: monitoringData.timeRange || {
        startTime: new Date(Date.now() - 3600000).toISOString(), // Default to last hour
        endTime: new Date().toISOString()
      },
      events: [],
      analysis: {
        patternsSummary: {
          totalEvents: 0,
          eventTypes: {},
          severityCounts: {},
          agentNameCounts: {},
          ipAddressCounts: {}
        },
        anomalies: [],
        threatPatterns: [],
        alertLevel: 'NONE'
      },
      actions: {
        automated: [],
        manual: [],
        notificationTargets: [],
        summary: 'Failed to process security monitoring'
      },
      overallStatus: 'FAILED',
      issues: [`Security monitoring process error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      recommendations: ['Contact system administrator']
    };
  }
}
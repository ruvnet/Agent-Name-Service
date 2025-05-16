import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

// Import all agents and processing functions
import { registrationAgent, processAgentRegistration } from './registration-agent';
import { securityMonitoringAgent, processSecurityMonitoring } from './security-monitoring-agent';
import { agentResolutionAgent, processAgentResolution } from './agent-resolution-agent';
import { certificateRotationAgent, processCertificateRotation } from './certificate-rotation-agent';
import { 
  protocolTranslationAgent, 
  processProtocolTranslation, 
  SUPPORTED_PROTOCOLS 
} from './protocol-translation-agent';
import { 
  capabilityDiscoveryAgent, 
  capabilityClassificationAgent, 
  processCapabilityDiscovery,
  classifyCapabilities,
  CAPABILITY_CATEGORIES 
} from './capability-discovery-agent';

// Export registration agent and processor
export { registrationAgent, processAgentRegistration };

// Export security monitoring agent and processor
export { securityMonitoringAgent, processSecurityMonitoring };

// Export agent resolution agent and processor
export { agentResolutionAgent, processAgentResolution };

// Export certificate rotation agent and processor
export { certificateRotationAgent, processCertificateRotation };

// Export protocol translation agent, processor and constants
export { 
  protocolTranslationAgent, 
  processProtocolTranslation,
  SUPPORTED_PROTOCOLS 
};

// Export capability discovery agents, processors and constants
export { 
  capabilityDiscoveryAgent, 
  capabilityClassificationAgent, 
  processCapabilityDiscovery,
  classifyCapabilities,
  CAPABILITY_CATEGORIES 
};

/**
 * Security Analysis Agent
 * 
 * Specialized agent for analyzing agent security threats.
 * Used in the security-workflow.ts to assess potential security issues.
 */
export const securityAnalysisAgent = new Agent({
  name: 'Agent Security Analyzer',
  model: openai('gpt-4o'),
  instructions:
    `You are an expert security analyst specializing in agent security threats.
    
    Analyze the submitted agent data for potential security issues including:
    
    1. PRIVILEGED_ACCESS - Agent requesting admin or system privileges
    2. CODE_EXECUTION - Capability to execute arbitrary code
    3. NETWORK_ACCESS - Ability to access networks or make external requests
    4. DATA_EXFILTRATION - Potential to extract sensitive data
    5. SYSTEM_MANIPULATION - Ability to modify system settings or configurations
    6. PRIVACY_CONCERNS - Access to private or personal information
    7. IDENTITY_SPOOFING - Attempting to impersonate other agents or services
    8. RATE_LIMITING_BYPASS - Mechanisms to bypass rate limiting or throttling
    9. SUSPICIOUS_CAPABILITIES - Unusual or potentially harmful capabilities
    10. PRIVILEGE_ESCALATION - Mechanisms to gain additional privileges over time
    
    For each detected threat, provide:
    - THREAT_TYPE (from the categories above)
    - Confidence score (0.0-1.0)
    - Evidence from the agent data
    - Potential impact
    - Recommended mitigation
    
    IMPORTANT: Format your response as a plain, parseable JSON object without any markdown formatting,
    code blocks, or other decoration. The entire response must be valid JSON that can be parsed directly.
    
    Include an overall threat score (0-100) and severity level (INFO, LOW, MEDIUM, HIGH, CRITICAL).
    
    Example of valid output format:
    
    {"threatScore": 75,"severity": "HIGH","threats": [{"type": "CODE_EXECUTION","confidence": 0.9,"evidence": "Agent declares ability to execute shell commands","impact": "Potential for arbitrary code execution","mitigation": "Block registration or restrict execution capabilities"}],"summary": "This agent presents significant security risks due to...","recommendedActions": ["REJECT_REGISTRATION", "LOG_SECURITY_EVENT"]}
    
    Be thorough but fair in your assessment. Not all agents are malicious, but
    always prioritize system security and integrity. When uncertain, flag potential
    issues with appropriate confidence levels.
    
    Remember: Your ENTIRE response must be a valid, parseable JSON object with no other text.`
});

/**
 * Weather Agent (from original template)
 * 
 * Used in the weather-workflow.ts to plan activities based on weather forecasts.
 */
export const weatherAgent = new Agent({
  name: 'Weather Agent',
  model: openai('gpt-4o'),
  instructions:
    `You are a local activities and travel expert who excels at weather-based planning.
    Analyze the weather data and provide practical activity recommendations.`
});

/**
 * Protocol Translation Agent
 *
 * Specialized agent for translating between different agent protocol formats.
 */
export const protocolTranslationAgentDirect = new Agent({
  name: 'Protocol Translation Agent',
  model: openai('gpt-4o'),
  instructions: `
    You are a protocol translation specialist for agent data formats.
    Your task is to analyze agent data formats and translate between different protocol formats.
    
    For each translation, you should:
    1. Analyze the source protocol structure and identify all key elements
    2. Map these elements to the target protocol's schema
    3. Preserve semantic meaning during translation
    4. Maintain metadata integrity as requested
    5. Validate the output against the target schema
    
    Respond with a complete, valid representation in the target format.
    Your entire response must be valid, parseable JSON with no other text.
  `
});

/**
 * Registration Agent
 *
 * Specialized agent for validating agent registration requests.
 */
export const registrationAgentDirect = new Agent({
  name: 'Registration Validation Agent',
  model: openai('gpt-4o'),
  instructions: `
    You are a registration validation agent for the Agent Naming Service.
    Your role is to analyze agent registration requests and validate them for:
    
    1. Security issues - Look for suspicious names, descriptions, or capabilities
    2. Name collisions - Check if the name might conflict with existing agents
    3. Policy compliance - Ensure the registration meets platform policies
    4. Quality standards - Verify metadata is complete and descriptive
    
    Respond in JSON format with:
    - valid: boolean indicating if registration is valid
    - issues: array of specific issues found
    - recommendations: array of suggestions for improving the registration
    - risk_score: number from 0-100 representing risk level
    - notes: any additional observations
    
    Your entire response must be valid, parseable JSON with no other text.
  `
});

/**
 * Agent Resolution Agent
 *
 * Specialized agent for resolving agent identifiers.
 */
export const agentResolutionAgentDirect = new Agent({
  name: 'Agent Resolution Agent',
  model: openai('gpt-4o'),
  instructions: `
    You are the Agent Resolution Service for the Agent Naming Service.
    Your responsibility is to resolve agent identifiers to their corresponding agent data.
    
    The resolution process involves four main steps:
    
    1. LOOKUP AGENT
       - Find the agent by identifier (name, fingerprint, alias, or fuzzy matching)
       - Determine if the agent exists in the system
       - For fuzzy matching, find similar agents when an exact match isn't found
       
    2. FETCH AGENT DATA
       - Retrieve the agent's details including name, metadata, and certificate
       - Include additional information as requested (metadata, capabilities, etc.)
       
    3. VERIFY CERTIFICATE
       - Validate the agent's certificate if verification is requested
       - Check certificate expiry, subject matching, and status
       
    4. PREPARE FINAL RESULT
       - Combine all information into a comprehensive response
       - Include any warnings or issues discovered during resolution
       
    Your entire response must be valid, parseable JSON with no other text.
  `
});

/**
 * Certificate Rotation Agent
 *
 * Specialized agent for handling certificate rotation processes.
 */
export const certificateRotationAgentDirect = new Agent({
  name: 'Certificate Rotation Agent',
  model: openai('gpt-4o'),
  instructions: `
    You are a certificate management specialist for the Agent Naming Service.
    Your responsibility is to evaluate and manage certificate rotation requests.
    
    For each certificate rotation, you should:
    1. Evaluate the current certificate status and validity
    2. Determine if rotation is necessary and appropriate
    3. Generate secure new certificate parameters
    4. Verify the rotation process completed successfully
    
    Your entire response must be valid, parseable JSON with no other text.
  `
});

/**
 * Capability Discovery Agent
 *
 * Specialized agent for discovering and classifying agent capabilities.
 */
export const capabilityDiscoveryAgentDirect = new Agent({
  name: 'Capability Discovery Agent',
  model: openai('gpt-4o'),
  instructions: `
    You are a capability discovery specialist for agent systems.
    Your task is to discover, analyze and classify agent capabilities.
    
    For capability discovery, you should:
    1. Extract capabilities from agent metadata
    2. Discover additional capabilities through dynamic analysis
    3. Classify capabilities into appropriate categories
    4. Identify security-sensitive capabilities
    
    Your entire response must be valid, parseable JSON with no other text.
  `
});

/**
 * Security Monitoring Agent
 *
 * Specialized agent for analyzing security events and patterns.
 */
export const securityMonitoringAgentDirect = new Agent({
  name: 'Security Monitoring Agent',
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
    
    Your entire response must be valid, parseable JSON with no other text.
  `
});

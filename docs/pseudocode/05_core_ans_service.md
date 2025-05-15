# Core ANS Service Pseudocode

This document outlines the pseudocode for the core Agent Name Service (ANS) server component. The core service integrates all other components (database, certificate generation, protocol formatting, and threat modeling) to provide the main functionality of the ANS server: agent registration, resolution, and MCP integration.

## ANS Service Interface

```typescript
// ANSService class pseudocode

class ANSService {
    private databaseService: DatabaseService;
    private certificateService: CertificateService;
    private protocolService: ProtocolService;
    private threatModelService: ThreatModelService;
    private initialized: boolean = false;
    private serverId: string;
    
    /**
     * Initialize the ANS service
     */
    async initialize(): Promise<void> {
        // TEST: ANS service initialization initializes all required components
        
        if (this.initialized) {
            return;
        }
        
        try {
            // Generate server ID if not exists
            this.serverId = process.env.ANS_SERVER_ID || uuidv4();
            
            // Initialize component services
            this.databaseService = await DatabaseServiceFactory.getInstance();
            this.certificateService = await CertificateServiceFactory.getInstance();
            this.protocolService = await ProtocolServiceFactory.getInstance();
            this.threatModelService = await ThreatModelServiceFactory.getInstance();
            
            // Verify all components are ready
            await this.verifyComponentsReady();
            
            this.initialized = true;
            
            console.log(`ANS Server (${this.serverId}) initialized successfully`);
        } catch (error) {
            throw new Error(`Failed to initialize ANS service: ${error.message}`);
        }
    }
    
    /**
     * Process an incoming ANS message
     */
    async processMessage(messageJson: string): Promise<string> {
        // TEST: Valid request messages return appropriate responses
        // TEST: Invalid messages return appropriate error responses
        
        this.ensureInitialized();
        
        try {
            // Parse and validate incoming message
            const parseResult = await this.protocolService.parseMessage(messageJson);
            
            if (!parseResult.valid || !parseResult.message) {
                // Return protocol error for invalid message
                const errorMessage = this.protocolService.formatError(
                    null,
                    ANSStatus.BAD_REQUEST,
                    'INVALID_MESSAGE',
                    parseResult.error || 'Invalid message format',
                    undefined,
                    this.serverId,
                    'ANS'
                );
                
                return JSON.stringify(errorMessage);
            }
            
            const message = parseResult.message;
            
            // Log the incoming message (for security and debugging)
            await this.logIncomingMessage(message);
            
            // Process security checks
            const securityCheck = await this.performSecurityCheck(message);
            if (!securityCheck.pass) {
                // Return security error
                const errorMessage = this.protocolService.formatError(
                    message,
                    securityCheck.status || ANSStatus.FORBIDDEN,
                    securityCheck.code || 'SECURITY_CHECK_FAILED',
                    securityCheck.message || 'Security check failed',
                    securityCheck.details,
                    this.serverId,
                    'ANS'
                );
                
                return JSON.stringify(errorMessage);
            }
            
            // Process the message based on type and operation
            if (message.messageType === ANSMessageType.REQUEST) {
                // Process request and generate response
                const response = await this.processRequest(message);
                return JSON.stringify(response);
            } else {
                // We only handle request messages
                const errorMessage = this.protocolService.formatError(
                    message,
                    ANSStatus.BAD_REQUEST,
                    'INVALID_MESSAGE_TYPE',
                    'Only request messages are accepted',
                    undefined,
                    this.serverId,
                    'ANS'
                );
                
                return JSON.stringify(errorMessage);
            }
        } catch (error) {
            // Return server error for unexpected errors
            console.error(`Error processing message: ${error.message}`);
            
            const errorMessage = this.protocolService.formatError(
                null,
                ANSStatus.SERVER_ERROR,
                'SERVER_ERROR',
                'An unexpected error occurred',
                { message: error.message },
                this.serverId,
                'ANS'
            );
            
            return JSON.stringify(errorMessage);
        }
    }
    
    /**
     * Process a request message
     */
    private async processRequest(request: ANSMessage): Promise<ANSMessage> {
        // TEST: Each operation type is handled correctly
        
        // Get operation handler based on operation type
        switch (request.operation) {
            case ANSOperation.REGISTER:
                return await this.handleRegisterRequest(request);
                
            case ANSOperation.UPDATE:
                return await this.handleUpdateRequest(request);
                
            case ANSOperation.DEREGISTER:
                return await this.handleDeregisterRequest(request);
                
            case ANSOperation.RESOLVE:
                return await this.handleResolveRequest(request);
                
            case ANSOperation.QUERY:
                return await this.handleQueryRequest(request);
                
            case ANSOperation.GET_CERTIFICATE:
                return await this.handleGetCertificateRequest(request);
                
            case ANSOperation.VALIDATE_CERTIFICATE:
                return await this.handleValidateCertificateRequest(request);
                
            case ANSOperation.RENEW_CERTIFICATE:
                return await this.handleRenewCertificateRequest(request);
                
            case ANSOperation.REVOKE_CERTIFICATE:
                return await this.handleRevokeCertificateRequest(request);
                
            case ANSOperation.REPORT_THREAT:
                return await this.handleReportThreatRequest(request);
                
            case ANSOperation.GET_THREATS:
                return await this.handleGetThreatsRequest(request);
                
            case ANSOperation.PING:
                return await this.handlePingRequest(request);
                
            case ANSOperation.HEALTH:
                return await this.handleHealthRequest(request);
                
            case ANSOperation.STATS:
                return await this.handleStatsRequest(request);
                
            default:
                // Unsupported operation
                return this.protocolService.formatError(
                    request,
                    ANSStatus.NOT_IMPLEMENTED,
                    'OPERATION_NOT_SUPPORTED',
                    `Operation '${request.operation}' is not supported`,
                    undefined,
                    this.serverId,
                    'ANS'
                );
        }
    }
}
```

## Key Operations Implementation

### Agent Registration

```typescript
/**
 * Handle agent registration request
 */
private async handleRegisterRequest(request: ANSMessage): Promise<ANSMessage> {
    // TEST: Valid registration request creates agent record and returns success
    // TEST: Registration with existing agent ID returns conflict error
    
    try {
        // Extract agent data from request
        const agentData = request.data?.agent;
        if (!agentData) {
            return this.protocolService.formatError(
                request,
                ANSStatus.BAD_REQUEST,
                'MISSING_AGENT_DATA',
                'Agent data is required for registration',
                undefined,
                this.serverId,
                'ANS'
            );
        }
        
        // Validate agent data
        const validationResult = this.validateAgentData(agentData);
        if (!validationResult.valid) {
            return this.protocolService.formatError(
                request,
                ANSStatus.BAD_REQUEST,
                'INVALID_AGENT_DATA',
                validationResult.message || 'Invalid agent data',
                validationResult.details,
                this.serverId,
                'ANS'
            );
        }
        
        // Create agent ID if not provided
        const agentId = agentData.id || uuidv4();
        
        // Check if agent already exists
        const existingAgent = await this.databaseService.getAgent(agentId);
        if (existingAgent) {
            return this.protocolService.formatError(
                request,
                ANSStatus.CONFLICT,
                'AGENT_ALREADY_EXISTS',
                `Agent with ID ${agentId} already exists`,
                undefined,
                this.serverId,
                'ANS'
            );
        }
        
        // Generate or validate certificate
        let certificateResult;
        if (agentData.publicKey) {
            // Use provided public key
            certificateResult = await this.certificateService.generateAgentCertificate(
                agentId,
                agentData.name,
                agentData.publicKey
            );
        } else {
            // Generate new key pair
            certificateResult = await this.certificateService.generateAgentCertificate(
                agentId,
                agentData.name
            );
        }
        
        // Create agent record
        const agent: AgentRecord = {
            id: agentId,
            name: agentData.name,
            publicKey: certificateResult.certificate.publicKey,
            certificateId: certificateResult.certificate.id,
            endpoints: agentData.endpoints || [],
            defaultEndpoint: agentData.defaultEndpoint,
            capabilities: agentData.capabilities || [],
            version: agentData.version || '1.0.0',
            description: agentData.description || '',
            metadata: agentData.metadata || {},
            createdAt: new Date(),
            updatedAt: new Date(),
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year expiration
            status: 'ACTIVE',
            owner: request.sender.id
        };
        
        // Save agent to database
        await this.databaseService.createAgent(agent);
        
        // Prepare response data
        const responseData = {
            agentId,
            name: agent.name,
            certificate: certificateResult.certificate.certificate,
            certificateFingerprint: certificateResult.certificate.fingerprint,
            privateKey: certificateResult.privateKey, // Only included if we generated the key pair
            expiresAt: agent.expiresAt.toISOString()
        };
        
        // Record security event for agent registration
        await this.recordRegistrationEvent(agent, request.sender);
        
        // Format and return success response
        return this.protocolService.formatResponse(
            request,
            ANSStatus.CREATED,
            responseData,
            this.serverId,
            'ANS'
        );
    } catch (error) {
        console.error(`Error handling registration: ${error.message}`);
        
        return this.protocolService.formatError(
            request,
            ANSStatus.SERVER_ERROR,
            'REGISTRATION_ERROR',
            'Failed to register agent',
            { message: error.message },
            this.serverId,
            'ANS'
        );
    }
}
```

### Agent Resolution

```typescript
/**
 * Handle agent resolution request
 */
private async handleResolveRequest(request: ANSMessage): Promise<ANSMessage> {
    // TEST: Valid resolution request returns agent details
    // TEST: Resolution for non-existent agent returns not found error
    
    try {
        // Extract agent ID from request
        const agentId = request.data?.agentId;
        if (!agentId) {
            return this.protocolService.formatError(
                request,
                ANSStatus.BAD_REQUEST,
                'MISSING_AGENT_ID',
                'Agent ID is required for resolution',
                undefined,
                this.serverId,
                'ANS'
            );
        }
        
        // Check if agent exists
        const agent = await this.databaseService.getAgent(agentId);
        if (!agent) {
            return this.protocolService.formatError(
                request,
                ANSStatus.NOT_FOUND,
                'AGENT_NOT_FOUND',
                `Agent with ID ${agentId} not found`,
                undefined,
                this.serverId,
                'ANS'
            );
        }
        
        // Check if agent is active
        if (agent.status !== 'ACTIVE') {
            return this.protocolService.formatError(
                request,
                ANSStatus.FORBIDDEN,
                'AGENT_INACTIVE',
                `Agent with ID ${agentId} is not active`,
                { status: agent.status },
                this.serverId,
                'ANS'
            );
        }
        
        // Get certificate for agent
        const certificate = await this.databaseService.getCertificate(agent.certificateId);
        if (!certificate) {
            return this.protocolService.formatError(
                request,
                ANSStatus.SERVER_ERROR,
                'CERTIFICATE_NOT_FOUND',
                `Certificate for agent ${agentId} not found`,
                undefined,
                this.serverId,
                'ANS'
            );
        }
        
        // Prepare response data
        const responseData = {
            agent: {
                id: agent.id,
                name: agent.name,
                description: agent.description,
                endpoints: agent.endpoints,
                capabilities: agent.capabilities,
                version: agent.version,
                certificateFingerprint: certificate.fingerprint,
                expiresAt: agent.expiresAt.toISOString()
            }
        };
        
        // Record resolution event for analytics
        await this.recordResolutionEvent(agent, request.sender);
        
        // Format and return success response
        return this.protocolService.formatResponse(
            request,
            ANSStatus.SUCCESS,
            responseData,
            this.serverId,
            'ANS'
        );
    } catch (error) {
        console.error(`Error handling resolution: ${error.message}`);
        
        return this.protocolService.formatError(
            request,
            ANSStatus.SERVER_ERROR,
            'RESOLUTION_ERROR',
            'Failed to resolve agent',
            { message: error.message },
            this.serverId,
            'ANS'
        );
    }
}
```

## MCP Integration

The ANS server provides special endpoints and functionality for integration with Management Control Panel (MCP) servers:

```typescript
/**
 * Handle MCP batch registration request
 * This allows MCP servers to register multiple agents in a single request
 */
private async handleMCPBatchRegistrationRequest(request: ANSMessage): Promise<ANSMessage> {
    // TEST: Valid batch registration request registers multiple agents
    // TEST: MCP-specific authentication is verified
    
    // Check MCP authentication and authorization
    if (!this.verifyMCPAuthentication(request)) {
        return this.protocolService.formatError(
            request,
            ANSStatus.UNAUTHORIZED,
            'MCP_AUTH_FAILED',
            'MCP authentication failed',
            undefined,
            this.serverId,
            'ANS'
        );
    }
    
    // Process batch registration
    try {
        const agents = request.data?.agents || [];
        if (!Array.isArray(agents) || agents.length === 0) {
            return this.protocolService.formatError(
                request,
                ANSStatus.BAD_REQUEST,
                'MISSING_AGENTS',
                'Agents array is required for batch registration',
                undefined,
                this.serverId,
                'ANS'
            );
        }
        
        // Process each agent
        const results = [];
        let successCount = 0;
        
        for (const agentData of agents) {
            try {
                // Validate agent data
                const validationResult = this.validateAgentData(agentData);
                if (!validationResult.valid) {
                    results.push({
                        success: false,
                        name: agentData.name,
                        error: validationResult.message || 'Invalid agent data'
                    });
                    continue;
                }
                
                // Create agent ID if not provided
                const agentId = agentData.id || uuidv4();
                
                // Check if agent already exists
                const existingAgent = await this.databaseService.getAgent(agentId);
                if (existingAgent) {
                    results.push({
                        success: false,
                        id: agentId,
                        name: agentData.name,
                        error: `Agent with ID ${agentId} already exists`
                    });
                    continue;
                }
                
                // Generate certificate
                const certificateResult = await this.certificateService.generateAgentCertificate(
                    agentId,
                    agentData.name,
                    agentData.publicKey
                );
                
                // Create agent record
                const agent: AgentRecord = {
                    id: agentId,
                    name: agentData.name,
                    publicKey: certificateResult.certificate.publicKey,
                    certificateId: certificateResult.certificate.id,
                    endpoints: agentData.endpoints || [],
                    defaultEndpoint: agentData.defaultEndpoint,
                    capabilities: agentData.capabilities || [],
                    version: agentData.version || '1.0.0',
                    description: agentData.description || '',
                    metadata: {
                        ...agentData.metadata || {},
                        mcpRegistered: true,
                        mcpId: request.sender.id
                    },
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                    status: 'ACTIVE',
                    owner: request.sender.id
                };
                
                // Save agent to database
                await this.databaseService.createAgent(agent);
                
                // Track success
                successCount++;
                
                // Add to results
                results.push({
                    success: true,
                    id: agentId,
                    name: agent.name,
                    certificateFingerprint: certificateResult.certificate.fingerprint
                });
                
            } catch (error) {
                // Handle individual agent errors
                results.push({
                    success: false,
                    name: agentData.name,
                    error: `Registration error: ${error.message}`
                });
            }
        }
        
        // Format and return response
        return this.protocolService.formatResponse(
            request,
            ANSStatus.SUCCESS,
            {
                results,
                totalCount: agents.length,
                successCount,
                failureCount: agents.length - successCount
            },
            this.serverId,
            'ANS'
        );
    } catch (error) {
        console.error(`Error handling MCP batch registration: ${error.message}`);
        
        return this.protocolService.formatError(
            request,
            ANSStatus.SERVER_ERROR,
            'BATCH_REGISTRATION_ERROR',
            'Failed to process batch registration',
            { message: error.message },
            this.serverId,
            'ANS'
        );
    }
}
```

## Security Implementation

```typescript
/**
 * Perform security check on incoming message
 */
private async performSecurityCheck(message: ANSMessage): Promise<{
    pass: boolean;
    status?: ANSStatus;
    code?: string;
    message?: string;
    details?: any;
}> {
    // TEST: Security checks detect potential threats
    
    try {
        // Create security event data
        const eventData: SecurityEventData = {
            eventType: 'MESSAGE_RECEIVED',
            severity: SecuritySeverity.INFO,
            source: {
                type: message.sender.type,
                identifier: message.sender.id,
                metadata: {
                    certificateFingerprint: message.sender.certificateFingerprint
                }
            },
            target: {
                type: 'SERVICE',
                identifier: this.serverId,
                resource: message.operation ? `OPERATION:${message.operation}` : 'UNKNOWN'
            },
            description: `Received ${message.messageType} message${message.operation ? ` for operation ${message.operation}` : ''}`,
            metadata: {
                messageId: message.messageId,
                timestamp: message.timestamp
            }
        };
        
        // Process security event through threat model service
        const result = await this.threatModelService.processSecurityEvent(eventData);
        
        // Check if threat was detected
        if (result.threatDetected) {
            console.warn(`Security threat detected: ${result.threatAnalysis.threatType}`);
            
            // Return security check failure
            return {
                pass: false,
                status: this.getStatusForThreatSeverity(result.threatAnalysis.severity),
                code: `SECURITY_THREAT_${result.threatAnalysis.threatType}`,
                message: `Security threat detected: ${result.threatAnalysis.threatType}`,
                details: {
                    severity: result.threatAnalysis.severity,
                    confidence: result.threatAnalysis.confidence
                }
            };
        }
        
        // Passed security check
        return {
            pass: true
        };
    } catch (error) {
        console.error(`Error performing security check: ${error.message}`);
        
        // Default to passing the check if there's an error in the security system
        // This prevents the security system from blocking legitimate traffic if it malfunctions
        return {
            pass: true
        };
    }
}

/**
 * Get HTTP status code based on threat severity
 */
private getStatusForThreatSeverity(severity: SecuritySeverity): ANSStatus {
    switch (severity) {
        case SecuritySeverity.CRITICAL:
        case SecuritySeverity.HIGH:
            return ANSStatus.FORBIDDEN;
            
        case SecuritySeverity.MEDIUM:
            return ANSStatus.RATE_LIMITED;
            
        case SecuritySeverity.LOW:
        case SecuritySeverity.INFO:
        default:
            return ANSStatus.BAD_REQUEST;
    }
}
```

## REST API Implementation

The ANS server exposes its functionality through a REST API that transforms HTTP requests into ANS protocol messages:

```typescript
/**
 * Handle HTTP REST request and translate to ANS protocol
 */
async handleHttpRequest(req: HttpRequest): Promise<HttpResponse> {
    try {
        // Map HTTP method/path to ANS operation
        const operation = this.mapHttpRequestToOperation(req);
        if (!operation) {
            return {
                status: 404,
                body: {
                    error: 'Not Found',
                    message: 'Requested endpoint not found'
                }
            };
        }
        
        // Extract request data from HTTP request
        const data = this.extractDataFromHttpRequest(req, operation);
        
        // Create sender info from authentication headers
        const sender = await this.extractSenderFromHttpRequest(req);
        if (!sender.id) {
            return {
                status: 401,
                body: {
                    error: 'Unauthorized',
                    message: 'Authentication required'
                }
            };
        }
        
        // Create ANS protocol request message
        const requestMessage = this.protocolService.formatRequest(
            operation,
            data,
            sender.id,
            sender.type,
            sender.certificateFingerprint
        );
        
        // Process the message
        const responseJson = await this.processMessage(JSON.stringify(requestMessage));
        
        // Parse the response
        const response: ANSMessage = JSON.parse(responseJson);
        
        // Map ANS response to HTTP response
        return this.mapAnsResponseToHttpResponse(response);
    } catch (error) {
        console.error(`Error handling HTTP request: ${error.message}`);
        
        // Return HTTP 500 for unexpected errors
        return {
            status: 500,
            body: {
                error: 'Internal Server Error',
                message: 'An unexpected error occurred'
            }
        };
    }
}
```

## System Architecture

The ANS server is built with a modular, layered architecture:

1. **REST API Layer**: Translates HTTP requests to ANS protocol messages
2. **Protocol Layer**: Handles message formatting, parsing, and validation
3. **Service Layer**: Implements business logic for operations
4. **Security Layer**: Provides threat detection and prevention
5. **Data Access Layer**: Manages database operations
6. **Certificate Layer**: Handles certificate generation and validation

Each layer has well-defined interfaces, allowing for:
- Clear separation of concerns
- Easy unit testing
- Future extensibility
- Component reusability

This modular design ensures that the ANS server can evolve to meet future requirements while maintaining a clean and maintainable codebase.

## Integration with External Systems

The ANS server integrates with several external systems:

1. **MCP Servers**: For agent management and administrative operations
2. **Mastra.ai**: For threat modeling and security intelligence
3. **Agent Clients**: For registration and resolution
4. **A2A Communication**: Facilitating agent-to-agent discovery and connection

Each integration uses standardized protocols and well-defined interfaces, ensuring that the ANS server can work with a variety of external systems.
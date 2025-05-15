# Protocol Formatting Pseudocode

This document outlines the pseudocode for the protocol formatting component of the Agent Name Service (ANS) server. The protocol formatting component is responsible for standardizing the request/response format for ANS operations, ensuring consistent communication between agents, ANS servers, and MCP platforms.

## Protocol Overview

The ANS protocol is designed to be:
- Simple and human-readable (JSON-based)
- Versioned to support future extensions
- Secure through TLS and authentication
- Consistent across all operations
- Well-defined with clear error handling

## Message Structure

```typescript
/**
 * Base message interface for all ANS protocol messages
 */
interface ANSMessage {
    // Protocol metadata
    protocolVersion: string;        // e.g., "1.0"
    messageId: string;              // UUID for message tracking
    timestamp: string;              // ISO 8601 timestamp
    
    // Message type and content
    messageType: ANSMessageType;    // Type of message
    operation?: ANSOperation;       // Operation (for requests)
    status?: ANSStatus;             // Status (for responses)
    data?: any;                     // Message payload
    
    // Security
    sender: {                       // Message sender information
        id: string;                 // Sender identifier
        type: "AGENT" | "ANS" | "MCP"; // Sender type
        certificateFingerprint?: string; // Sender certificate fingerprint
    };
    signature?: string;             // Detached signature of message
}

/**
 * Message types in the ANS protocol
 */
enum ANSMessageType {
    REQUEST = "REQUEST",
    RESPONSE = "RESPONSE",
    EVENT = "EVENT",
    ERROR = "ERROR"
}

/**
 * Operation types in the ANS protocol
 */
enum ANSOperation {
    // Registration operations
    REGISTER = "REGISTER",
    UPDATE = "UPDATE",
    DEREGISTER = "DEREGISTER",
    
    // Resolution operations
    RESOLVE = "RESOLVE",
    QUERY = "QUERY",
    
    // Certificate operations
    GET_CERTIFICATE = "GET_CERTIFICATE",
    VALIDATE_CERTIFICATE = "VALIDATE_CERTIFICATE",
    RENEW_CERTIFICATE = "RENEW_CERTIFICATE",
    REVOKE_CERTIFICATE = "REVOKE_CERTIFICATE",
    
    // Security operations
    REPORT_THREAT = "REPORT_THREAT",
    GET_THREATS = "GET_THREATS",
    
    // Administrative operations
    PING = "PING",
    HEALTH = "HEALTH",
    STATS = "STATS"
}

/**
 * Status codes for ANS responses
 */
enum ANSStatus {
    // Success codes (200-299)
    SUCCESS = 200,
    CREATED = 201,
    ACCEPTED = 202,
    NO_CONTENT = 204,
    
    // Client error codes (400-499)
    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    CONFLICT = 409,
    RATE_LIMITED = 429,
    
    // Server error codes (500-599)
    SERVER_ERROR = 500,
    NOT_IMPLEMENTED = 501,
    SERVICE_UNAVAILABLE = 503
}

/**
 * Error structure for ANS error responses
 */
interface ANSError {
    code: string;               // Machine-readable error code
    message: string;            // Human-readable error message
    details?: any;              // Additional error details
    requestId?: string;         // Original request ID
}
```

## Protocol Service Interface

```typescript
// ProtocolService class pseudocode

class ProtocolService {
    private initialized: boolean = false;
    private protocolVersion: string = "1.0";
    private certificateService: CertificateService;
    
    /**
     * Initialize the protocol service
     */
    async initialize(): Promise<void> {
        // TEST: Protocol service initialization connects to required services
        
        if (this.initialized) {
            return;
        }
        
        try {
            this.certificateService = await CertificateServiceFactory.getInstance();
            this.initialized = true;
        } catch (error) {
            throw new Error(`Failed to initialize protocol service: ${error.message}`);
        }
    }
    
    /**
     * Format a request message
     */
    formatRequest<T extends object>(
        operation: ANSOperation,
        data: T,
        senderId: string,
        senderType: "AGENT" | "ANS" | "MCP",
        certificateFingerprint?: string,
        privateKey?: string
    ): ANSMessage {
        // TEST: Request formatting includes all required fields
        // TEST: Request with privateKey includes valid signature
        
        this.ensureInitialized();
        
        const messageId = uuidv4();
        const timestamp = new Date().toISOString();
        
        const message: ANSMessage = {
            protocolVersion: this.protocolVersion,
            messageId,
            timestamp,
            messageType: ANSMessageType.REQUEST,
            operation,
            data,
            sender: {
                id: senderId,
                type: senderType,
                certificateFingerprint
            }
        };
        
        // Add signature if private key is provided
        if (privateKey) {
            message.signature = this.signMessage(message, privateKey);
        }
        
        return message;
    }
    
    /**
     * Format a response message
     */
    formatResponse<T extends object>(
        requestMessage: ANSMessage,
        status: ANSStatus,
        data: T,
        senderId: string,
        senderType: "AGENT" | "ANS" | "MCP",
        certificateFingerprint?: string,
        privateKey?: string
    ): ANSMessage {
        // TEST: Response formatting includes all required fields
        // TEST: Response includes original request messageId
        
        this.ensureInitialized();
        
        const messageId = uuidv4();
        const timestamp = new Date().toISOString();
        
        const message: ANSMessage = {
            protocolVersion: this.protocolVersion,
            messageId,
            timestamp,
            messageType: ANSMessageType.RESPONSE,
            status,
            data: {
                ...data,
                requestMessageId: requestMessage.messageId
            },
            sender: {
                id: senderId,
                type: senderType,
                certificateFingerprint
            }
        };
        
        // Add signature if private key is provided
        if (privateKey) {
            message.signature = this.signMessage(message, privateKey);
        }
        
        return message;
    }
    
    /**
     * Format an error message
     */
    formatError(
        requestMessage: ANSMessage | null,
        status: ANSStatus,
        errorCode: string,
        errorMessage: string,
        details?: any,
        senderId?: string,
        senderType?: "AGENT" | "ANS" | "MCP",
        certificateFingerprint?: string,
        privateKey?: string
    ): ANSMessage {
        // TEST: Error formatting includes all required fields
        // TEST: Error includes original request messageId if available
        
        this.ensureInitialized();
        
        const messageId = uuidv4();
        const timestamp = new Date().toISOString();
        
        const error: ANSError = {
            code: errorCode,
            message: errorMessage,
            details,
            requestId: requestMessage?.messageId
        };
        
        const message: ANSMessage = {
            protocolVersion: this.protocolVersion,
            messageId,
            timestamp,
            messageType: ANSMessageType.ERROR,
            status,
            data: error,
            sender: {
                id: senderId || "ans-server",
                type: senderType || "ANS",
                certificateFingerprint
            }
        };
        
        // Add signature if private key is provided
        if (privateKey) {
            message.signature = this.signMessage(message, privateKey);
        }
        
        return message;
    }
    
    /**
     * Parse and validate an incoming message
     */
    async parseMessage(
        messageJson: string,
        validateSignature: boolean = true
    ): Promise<{ valid: boolean, message?: ANSMessage, error?: string }> {
        // TEST: Valid JSON message is parsed successfully
        // TEST: Invalid JSON returns parse error
        // TEST: Message with invalid signature fails validation when validateSignature=true
        
        this.ensureInitialized();
        
        try {
            // Parse JSON message
            let message: ANSMessage;
            try {
                message = JSON.parse(messageJson);
            } catch (error) {
                return {
                    valid: false,
                    error: `Invalid JSON format: ${error.message}`
                };
            }
            
            // Validate message structure
            if (!this.validateMessageStructure(message)) {
                return {
                    valid: false,
                    error: "Invalid message structure"
                };
            }
            
            // Validate signature if required
            if (validateSignature && message.signature) {
                // Get sender's certificate
                const fingerprint = message.sender.certificateFingerprint;
                if (!fingerprint) {
                    return {
                        valid: false,
                        error: "Missing certificate fingerprint for signed message"
                    };
                }
                
                // Verify signature
                const isValid = await this.verifyMessageSignature(message);
                if (!isValid) {
                    return {
                        valid: false,
                        error: "Invalid message signature"
                    };
                }
            }
            
            return {
                valid: true,
                message
            };
        } catch (error) {
            return {
                valid: false,
                error: `Failed to parse message: ${error.message}`
            };
        }
    }
    
    /**
     * Sign a message with a private key
     */
    private signMessage(message: ANSMessage, privateKey: string): string {
        // TEST: Message signature is deterministic for same message and key
        
        // Create a copy of the message without the signature field
        const messageToSign = { ...message };
        delete messageToSign.signature;
        
        // Convert message to canonical JSON
        const canonicalJson = this.toCanonicalJson(messageToSign);
        
        // Sign the canonical JSON
        const sign = crypto.createSign('SHA256');
        sign.update(canonicalJson);
        const signature = sign.sign(privateKey, 'base64');
        
        return signature;
    }
    
    /**
     * Verify a message signature
     */
    private async verifyMessageSignature(message: ANSMessage): Promise<boolean> {
        // TEST: Valid signature verification returns true
        // TEST: Invalid signature verification returns false
        
        try {
            // Get sender's certificate
            const fingerprint = message.sender.certificateFingerprint;
            if (!fingerprint) {
                return false;
            }
            
            // Get certificate from database
            const certificate = await this.certificateService.getCertificateByFingerprint(fingerprint);
            if (!certificate) {
                return false;
            }
            
            // Create a copy of the message without the signature field
            const messageToVerify = { ...message };
            const signature = messageToVerify.signature;
            delete messageToVerify.signature;
            
            // Convert message to canonical JSON
            const canonicalJson = this.toCanonicalJson(messageToVerify);
            
            // Verify the signature
            const verify = crypto.createVerify('SHA256');
            verify.update(canonicalJson);
            return verify.verify(certificate.publicKey, signature, 'base64');
        } catch (error) {
            console.error(`Signature verification error: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Convert an object to canonical JSON format for signing
     */
    private toCanonicalJson(obj: any): string {
        // TEST: Canonical JSON is deterministic for equivalent objects
        
        // Helper function to sort object keys
        const sortKeys = (obj: any): any => {
            if (typeof obj !== 'object' || obj === null) {
                return obj;
            }
            
            if (Array.isArray(obj)) {
                return obj.map(sortKeys);
            }
            
            const sortedObj: any = {};
            const sortedKeys = Object.keys(obj).sort();
            
            for (const key of sortedKeys) {
                sortedObj[key] = sortKeys(obj[key]);
            }
            
            return sortedObj;
        };
        
        // Sort keys and stringify without whitespace
        return JSON.stringify(sortKeys(obj));
    }
    
    /**
     * Validate the structure of a message
     */
    private validateMessageStructure(message: any): boolean {
        // TEST: Valid message structure returns true
        // TEST: Message missing required fields returns false
        
        // Check required fields
        if (!message.protocolVersion || typeof message.protocolVersion !== 'string') {
            return false;
        }
        
        if (!message.messageId || typeof message.messageId !== 'string') {
            return false;
        }
        
        if (!message.timestamp || typeof message.timestamp !== 'string') {
            return false;
        }
        
        if (!message.messageType || !Object.values(ANSMessageType).includes(message.messageType)) {
            return false;
        }
        
        // Validate sender information
        if (!message.sender || typeof message.sender !== 'object') {
            return false;
        }
        
        if (!message.sender.id || typeof message.sender.id !== 'string') {
            return false;
        }
        
        if (!message.sender.type || !["AGENT", "ANS", "MCP"].includes(message.sender.type)) {
            return false;
        }
        
        // Validate message type specific fields
        if (message.messageType === ANSMessageType.REQUEST) {
            if (!message.operation || !Object.values(ANSOperation).includes(message.operation)) {
                return false;
            }
        } else if (message.messageType === ANSMessageType.RESPONSE || message.messageType === ANSMessageType.ERROR) {
            if (typeof message.status !== 'number') {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Ensure the service is initialized
     */
    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new Error('Protocol service is not initialized');
        }
    }
}
```

## Request/Response Examples

### Agent Registration Request

```json
{
  "protocolVersion": "1.0",
  "messageId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2025-05-15T12:00:00.000Z",
  "messageType": "REQUEST",
  "operation": "REGISTER",
  "data": {
    "agent": {
      "name": "Example Agent",
      "description": "An example agent for testing",
      "endpoints": [
        {
          "protocol": "https",
          "address": "example-agent.domain.com",
          "port": 443
        }
      ],
      "capabilities": ["search", "compute", "storage"],
      "version": "1.0.0",
      "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkq...\n-----END PUBLIC KEY-----"
    }
  },
  "sender": {
    "id": "agent-client-123",
    "type": "AGENT"
  }
}
```

### Agent Registration Response

```json
{
  "protocolVersion": "1.0",
  "messageId": "550e8400-e29b-41d4-a716-446655440001",
  "timestamp": "2025-05-15T12:00:01.000Z",
  "messageType": "RESPONSE",
  "status": 201,
  "data": {
    "requestMessageId": "550e8400-e29b-41d4-a716-446655440000",
    "agentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "name": "Example Agent",
    "certificate": "-----BEGIN CERTIFICATE-----\nMIIDeTCCmGgAw...\n-----END CERTIFICATE-----",
    "certificateFingerprint": "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99",
    "expiresAt": "2026-05-15T12:00:01.000Z"
  },
  "sender": {
    "id": "ans-server-001",
    "type": "ANS",
    "certificateFingerprint": "12:34:56:78:9A:BC:DE:F0:12:34:56:78:9A:BC:DE:F0"
  },
  "signature": "Base64EncodedSignature=="
}
```

### Agent Resolution Request

```json
{
  "protocolVersion": "1.0",
  "messageId": "550e8400-e29b-41d4-a716-446655440002",
  "timestamp": "2025-05-15T12:30:00.000Z",
  "messageType": "REQUEST",
  "operation": "RESOLVE",
  "data": {
    "agentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  },
  "sender": {
    "id": "agent-client-456",
    "type": "AGENT",
    "certificateFingerprint": "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99"
  },
  "signature": "Base64EncodedSignature=="
}
```

### Agent Resolution Response

```json
{
  "protocolVersion": "1.0",
  "messageId": "550e8400-e29b-41d4-a716-446655440003",
  "timestamp": "2025-05-15T12:30:01.000Z",
  "messageType": "RESPONSE",
  "status": 200,
  "data": {
    "requestMessageId": "550e8400-e29b-41d4-a716-446655440002",
    "agent": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Example Agent",
      "description": "An example agent for testing",
      "endpoints": [
        {
          "protocol": "https",
          "address": "example-agent.domain.com",
          "port": 443,
          "health": {
            "status": "HEALTHY",
            "lastChecked": "2025-05-15T12:25:00.000Z"
          }
        }
      ],
      "capabilities": ["search", "compute", "storage"],
      "version": "1.0.0",
      "certificateFingerprint": "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99",
      "expiresAt": "2026-05-15T12:00:01.000Z"
    }
  },
  "sender": {
    "id": "ans-server-001",
    "type": "ANS",
    "certificateFingerprint": "12:34:56:78:9A:BC:DE:F0:12:34:56:78:9A:BC:DE:F0"
  },
  "signature": "Base64EncodedSignature=="
}
```

### Error Response Example

```json
{
  "protocolVersion": "1.0",
  "messageId": "550e8400-e29b-41d4-a716-446655440004",
  "timestamp": "2025-05-15T12:31:00.000Z",
  "messageType": "ERROR",
  "status": 404,
  "data": {
    "code": "AGENT_NOT_FOUND",
    "message": "The requested agent could not be found",
    "details": {
      "agentId": "non-existent-agent-id"
    },
    "requestId": "550e8400-e29b-41d4-a716-446655440002"
  },
  "sender": {
    "id": "ans-server-001",
    "type": "ANS",
    "certificateFingerprint": "12:34:56:78:9A:BC:DE:F0:12:34:56:78:9A:BC:DE:F0"
  },
  "signature": "Base64EncodedSignature=="
}
```

## Protocol Versioning

The ANS protocol includes version information in every message, enabling backward compatibility as the protocol evolves:

1. **Major Version Changes**: Incompatible changes that require client updates
2. **Minor Version Changes**: Backward-compatible additions or changes

The server supports multiple protocol versions simultaneously during transition periods, with clear deprecation policies for older versions.

## Protocol Security

The protocol incorporates several security measures:

1. **Transport Security**: All communications use TLS 1.3+
2. **Message Signatures**: Optional but recommended for all messages
3. **Certificate-Based Authentication**: Sender identity verified through certificates
4. **Timestamps**: Protection against replay attacks
5. **Canonicalization**: Deterministic JSON formatting for signatures

## Error Handling

The protocol defines a comprehensive error handling approach:

1. **Standardized Error Format**: Consistent structure for all errors
2. **Error Codes**: Machine-readable codes for programmatic handling
3. **Human-Readable Messages**: Clear explanations for each error
4. **Additional Details**: Context-specific information for debugging
5. **Original Request Reference**: Link to the originating request
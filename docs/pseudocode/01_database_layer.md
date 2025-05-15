# Database Layer Pseudocode (SQLite)

This document outlines the pseudocode for the database layer of the Agent Name Service (ANS) server. The database layer is responsible for storing and retrieving agent records, certificates, and security events.

## Database Schema

```sql
-- Agent Records Table
CREATE TABLE agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    public_key TEXT NOT NULL,
    certificate_id TEXT NOT NULL,
    default_endpoint_id TEXT,
    version TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    status TEXT NOT NULL,
    owner TEXT NOT NULL,
    FOREIGN KEY (certificate_id) REFERENCES certificates(id)
);

-- Create indexes for common queries
CREATE INDEX idx_agents_name ON agents(name);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_agents_owner ON agents(owner);
CREATE INDEX idx_agents_expires_at ON agents(expires_at);

-- Agent Endpoints Table
CREATE TABLE endpoints (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    protocol TEXT NOT NULL,
    address TEXT NOT NULL,
    port INTEGER NOT NULL,
    health_status TEXT NOT NULL,
    last_checked INTEGER NOT NULL,
    health_message TEXT,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX idx_endpoints_agent_id ON endpoints(agent_id);

-- Agent Capabilities Table (many-to-many)
CREATE TABLE capabilities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE agent_capabilities (
    agent_id TEXT NOT NULL,
    capability_id TEXT NOT NULL,
    PRIMARY KEY (agent_id, capability_id),
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    FOREIGN KEY (capability_id) REFERENCES capabilities(id) ON DELETE CASCADE
);

CREATE INDEX idx_agent_capabilities_agent_id ON agent_capabilities(agent_id);
CREATE INDEX idx_agent_capabilities_capability_id ON agent_capabilities(capability_id);

-- Agent Metadata Table (key-value store for extensible metadata)
CREATE TABLE agent_metadata (
    agent_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (agent_id, key),
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX idx_agent_metadata_agent_id ON agent_metadata(agent_id);
CREATE INDEX idx_agent_metadata_key ON agent_metadata(key);

-- Certificates Table
CREATE TABLE certificates (
    id TEXT PRIMARY KEY,
    subject TEXT NOT NULL,
    issuer TEXT NOT NULL,
    not_before INTEGER NOT NULL,
    not_after INTEGER NOT NULL,
    public_key TEXT NOT NULL,
    certificate TEXT NOT NULL,
    fingerprint TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX idx_certificates_fingerprint ON certificates(fingerprint);
CREATE INDEX idx_certificates_status ON certificates(status);
CREATE INDEX idx_certificates_not_after ON certificates(not_after);

-- Certificate Metadata Table
CREATE TABLE certificate_metadata (
    certificate_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (certificate_id, key),
    FOREIGN KEY (certificate_id) REFERENCES certificates(id) ON DELETE CASCADE
);

CREATE INDEX idx_certificate_metadata_certificate_id ON certificate_metadata(certificate_id);

-- Security Events Table
CREATE TABLE security_events (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    source TEXT NOT NULL,
    target TEXT NOT NULL,
    description TEXT NOT NULL,
    mitigation_applied BOOLEAN NOT NULL,
    mitigation_details TEXT
);

CREATE INDEX idx_security_events_timestamp ON security_events(timestamp);
CREATE INDEX idx_security_events_event_type ON security_events(event_type);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_source ON security_events(source);
CREATE INDEX idx_security_events_target ON security_events(target);

-- Security Event Metadata Table
CREATE TABLE security_event_metadata (
    event_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (event_id, key),
    FOREIGN KEY (event_id) REFERENCES security_events(id) ON DELETE CASCADE
);

CREATE INDEX idx_security_event_metadata_event_id ON security_event_metadata(event_id);
```

## Database Interface

The database layer will provide the following interface for interacting with the database.

```typescript
// DatabaseService class pseudocode

class DatabaseService {
    private db: SQLiteDatabase;
    private initialized: boolean = false;
    
    /**
     * Initialize the database connection and schema
     */
    async initialize(): Promise<void> {
        // TEST: Database initialization creates all required tables
        if (this.initialized) {
            return;
        }
        
        try {
            this.db = await openDatabase('./ans_database.sqlite');
            await this.createTablesIfNotExist();
            this.initialized = true;
        } catch (error) {
            throw new Error(`Failed to initialize database: ${error.message}`);
        }
    }
    
    /**
     * Create database tables if they don't exist
     */
    private async createTablesIfNotExist(): Promise<void> {
        // Execute the SQL schema defined above
        await this.db.execute(SCHEMA_SQL);
    }
    
    /**
     * Close the database connection
     */
    async close(): Promise<void> {
        if (!this.initialized) {
            return;
        }
        
        await this.db.close();
        this.initialized = false;
    }
    
    // ====================
    // Agent CRUD Operations
    // ====================
    
    /**
     * Create a new agent record
     */
    async createAgent(agent: AgentRecord): Promise<string> {
        // TEST: Agent creation with valid data succeeds
        // TEST: Agent creation with duplicate ID fails
        
        this.ensureInitialized();
        
        const {
            id, name, publicKey, certificateId, 
            defaultEndpoint, version, description,
            status, owner
        } = agent;
        
        const now = Date.now();
        const expiresAt = agent.expiresAt?.getTime() || (now + 30 * 24 * 60 * 60 * 1000); // Default 30 days
        
        try {
            await this.db.run(
                `INSERT INTO agents
                (id, name, public_key, certificate_id, default_endpoint_id, 
                version, description, created_at, updated_at, expires_at, status, owner)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, name, publicKey, certificateId,
                    defaultEndpoint?.id, version, description,
                    now, now, expiresAt,
                    status || 'ACTIVE', owner
                ]
            );
            
            // Insert endpoints
            if (agent.endpoints) {
                for (const endpoint of agent.endpoints) {
                    await this.createEndpoint(id, endpoint);
                }
            }
            
            // Insert capabilities
            if (agent.capabilities) {
                await this.setAgentCapabilities(id, agent.capabilities);
            }
            
            // Insert metadata
            if (agent.metadata) {
                await this.setAgentMetadata(id, agent.metadata);
            }
            
            return id;
        } catch (error) {
            throw new Error(`Failed to create agent: ${error.message}`);
        }
    }
    
    /**
     * Get an agent record by ID
     */
    async getAgent(id: string): Promise<AgentRecord | null> {
        // TEST: Get agent with valid ID returns correct agent
        // TEST: Get agent with non-existent ID returns null
        
        this.ensureInitialized();
        
        try {
            // Get basic agent data
            const agent = await this.db.get(
                `SELECT * FROM agents WHERE id = ?`,
                [id]
            );
            
            if (!agent) {
                return null;
            }
            
            // Get endpoints
            const endpoints = await this.getEndpointsByAgentId(id);
            
            // Get capabilities
            const capabilities = await this.getAgentCapabilities(id);
            
            // Get metadata
            const metadata = await this.getAgentMetadata(id);
            
            // Build and return complete agent record
            return this.buildAgentRecord(agent, endpoints, capabilities, metadata);
        } catch (error) {
            throw new Error(`Failed to get agent: ${error.message}`);
        }
    }
    
    /**
     * Update an existing agent record
     */
    async updateAgent(agent: AgentRecord): Promise<boolean> {
        // TEST: Update agent with valid data succeeds
        // TEST: Update agent with non-existent ID fails
        
        this.ensureInitialized();
        
        const {
            id, name, publicKey, certificateId,
            defaultEndpoint, version, description,
            status, owner
        } = agent;
        
        const now = Date.now();
        const expiresAt = agent.expiresAt?.getTime();
        
        try {
            // Check if agent exists
            const existingAgent = await this.getAgent(id);
            if (!existingAgent) {
                return false;
            }
            
            // Update agent record
            await this.db.run(
                `UPDATE agents
                SET name = ?, public_key = ?, certificate_id = ?,
                default_endpoint_id = ?, version = ?, description = ?,
                updated_at = ?, expires_at = ?, status = ?, owner = ?
                WHERE id = ?`,
                [
                    name, publicKey, certificateId,
                    defaultEndpoint?.id, version, description,
                    now, expiresAt || existingAgent.expiresAt.getTime(),
                    status || existingAgent.status,
                    owner || existingAgent.owner,
                    id
                ]
            );
            
            // Update endpoints if provided
            if (agent.endpoints) {
                // Delete existing endpoints
                await this.deleteEndpointsByAgentId(id);
                
                // Insert new endpoints
                for (const endpoint of agent.endpoints) {
                    await this.createEndpoint(id, endpoint);
                }
            }
            
            // Update capabilities if provided
            if (agent.capabilities) {
                await this.setAgentCapabilities(id, agent.capabilities);
            }
            
            // Update metadata if provided
            if (agent.metadata) {
                await this.setAgentMetadata(id, agent.metadata);
            }
            
            return true;
        } catch (error) {
            throw new Error(`Failed to update agent: ${error.message}`);
        }
    }
    
    /**
     * Delete an agent record
     */
    async deleteAgent(id: string): Promise<boolean> {
        // TEST: Delete agent with valid ID succeeds
        // TEST: Delete agent with non-existent ID returns false
        
        this.ensureInitialized();
        
        try {
            // Check if agent exists
            const existingAgent = await this.getAgent(id);
            if (!existingAgent) {
                return false;
            }
            
            // Delete agent record
            // Note: Endpoints, capabilities, and metadata will be deleted via CASCADE
            await this.db.run(
                `DELETE FROM agents WHERE id = ?`,
                [id]
            );
            
            return true;
        } catch (error) {
            throw new Error(`Failed to delete agent: ${error.message}`);
        }
    }
    
    /**
     * Query agents based on criteria
     */
    async queryAgents(query: ResolutionQuery): Promise<AgentRecord[]> {
        // TEST: Query with valid filters returns matching agents
        // TEST: Query with no matches returns empty array
        
        this.ensureInitialized();
        
        try {
            let sql = `SELECT DISTINCT a.* FROM agents a`;
            const params = [];
            
            // Join with capabilities table if searching by capabilities
            if (query.capabilities && query.capabilities.length > 0) {
                sql += `
                JOIN agent_capabilities ac ON a.id = ac.agent_id
                JOIN capabilities c ON ac.capability_id = c.id`;
            }
            
            // Build WHERE clause
            const whereConditions = [];
            
            // Filter by ID
            if (query.id) {
                whereConditions.push(`a.id = ?`);
                params.push(query.id);
            }
            
            // Filter by name
            if (query.name) {
                whereConditions.push(`a.name LIKE ?`);
                params.push(`%${query.name}%`);
            }
            
            // Filter by fingerprint
            if (query.fingerprint) {
                sql += ` JOIN certificates cert ON a.certificate_id = cert.id`;
                whereConditions.push(`cert.fingerprint = ?`);
                params.push(query.fingerprint);
            }
            
            // Filter by status
            if (query.status && query.status.length > 0) {
                const placeholders = query.status.map(() => '?').join(', ');
                whereConditions.push(`a.status IN (${placeholders})`);
                params.push(...query.status);
            }
            
            // Filter by owner
            if (query.owner) {
                whereConditions.push(`a.owner = ?`);
                params.push(query.owner);
            }
            
            // Filter by capabilities
            if (query.capabilities && query.capabilities.length > 0) {
                if (query.allCapabilities) {
                    // Must have all specified capabilities
                    whereConditions.push(`
                        c.name IN (${query.capabilities.map(() => '?').join(', ')})
                        GROUP BY a.id
                        HAVING COUNT(DISTINCT c.name) = ?
                    `);
                    params.push(...query.capabilities, query.capabilities.length);
                } else {
                    // Must have any of the specified capabilities
                    whereConditions.push(`c.name IN (${query.capabilities.map(() => '?').join(', ')})`);
                    params.push(...query.capabilities);
                }
            }
            
            // Add WHERE clause if conditions exist
            if (whereConditions.length > 0) {
                sql += ` WHERE ${whereConditions.join(' AND ')}`;
            }
            
            // Add ORDER BY clause
            if (query.orderBy) {
                const direction = query.orderDirection === 'desc' ? 'DESC' : 'ASC';
                sql += ` ORDER BY a.${query.orderBy} ${direction}`;
            } else {
                sql += ` ORDER BY a.updated_at DESC`;
            }
            
            // Add LIMIT and OFFSET for pagination
            if (query.limit) {
                sql += ` LIMIT ?`;
                params.push(query.limit);
                
                if (query.offset) {
                    sql += ` OFFSET ?`;
                    params.push(query.offset);
                }
            }
            
            // Execute query
            const agentRows = await this.db.all(sql, params);
            
            // Build complete agent records
            const agents: AgentRecord[] = [];
            
            for (const agentRow of agentRows) {
                const endpoints = await this.getEndpointsByAgentId(agentRow.id);
                const capabilities = await this.getAgentCapabilities(agentRow.id);
                const metadata = await this.getAgentMetadata(agentRow.id);
                
                agents.push(this.buildAgentRecord(agentRow, endpoints, capabilities, metadata));
            }
            
            return agents;
        } catch (error) {
            throw new Error(`Failed to query agents: ${error.message}`);
        }
    }
    
    // ====================
    // Certificate CRUD Operations
    // ====================
    
    /**
     * Create a new certificate
     */
    async createCertificate(certificate: Certificate): Promise<string> {
        // TEST: Certificate creation with valid data succeeds
        // TEST: Certificate creation with duplicate fingerprint fails
        
        this.ensureInitialized();
        
        const {
            id, subject, issuer, notBefore, notAfter,
            publicKey, certificate: certPEM, fingerprint, status
        } = certificate;
        
        const now = Date.now();
        
        try {
            await this.db.run(
                `INSERT INTO certificates
                (id, subject, issuer, not_before, not_after,
                public_key, certificate, fingerprint, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id, subject, issuer,
                    notBefore.getTime(), notAfter.getTime(),
                    publicKey, certPEM, fingerprint,
                    status || 'VALID', now
                ]
            );
            
            // Insert metadata
            if (certificate.metadata) {
                await this.setCertificateMetadata(id, certificate.metadata);
            }
            
            return id;
        } catch (error) {
            throw new Error(`Failed to create certificate: ${error.message}`);
        }
    }
    
    /**
     * Get a certificate by ID
     */
    async getCertificate(id: string): Promise<Certificate | null> {
        // TEST: Get certificate with valid ID returns correct certificate
        // TEST: Get certificate with non-existent ID returns null
        
        this.ensureInitialized();
        
        try {
            // Get basic certificate data
            const cert = await this.db.get(
                `SELECT * FROM certificates WHERE id = ?`,
                [id]
            );
            
            if (!cert) {
                return null;
            }
            
            // Get metadata
            const metadata = await this.getCertificateMetadata(id);
            
            // Build and return complete certificate
            return this.buildCertificate(cert, metadata);
        } catch (error) {
            throw new Error(`Failed to get certificate: ${error.message}`);
        }
    }
    
    /**
     * Get a certificate by fingerprint
     */
    async getCertificateByFingerprint(fingerprint: string): Promise<Certificate | null> {
        // TEST: Get certificate with valid fingerprint returns correct certificate
        // TEST: Get certificate with non-existent fingerprint returns null
        
        this.ensureInitialized();
        
        try {
            // Get basic certificate data
            const cert = await this.db.get(
                `SELECT * FROM certificates WHERE fingerprint = ?`,
                [fingerprint]
            );
            
            if (!cert) {
                return null;
            }
            
            // Get metadata
            const metadata = await this.getCertificateMetadata(cert.id);
            
            // Build and return complete certificate
            return this.buildCertificate(cert, metadata);
        } catch (error) {
            throw new Error(`Failed to get certificate by fingerprint: ${error.message}`);
        }
    }
    
    /**
     * Update certificate status
     */
    async updateCertificateStatus(id: string, status: CertificateStatus): Promise<boolean> {
        // TEST: Update certificate status with valid ID succeeds
        // TEST: Update certificate status with non-existent ID fails
        
        this.ensureInitialized();
        
        try {
            // Check if certificate exists
            const existingCert = await this.getCertificate(id);
            if (!existingCert) {
                return false;
            }
            
            // Update certificate status
            await this.db.run(
                `UPDATE certificates SET status = ? WHERE id = ?`,
                [status, id]
            );
            
            return true;
        } catch (error) {
            throw new Error(`Failed to update certificate status: ${error.message}`);
        }
    }
    
    // ====================
    // Security Event Operations
    // ====================
    
    /**
     * Record a security event
     */
    async recordSecurityEvent(event: SecurityEvent): Promise<string> {
        // TEST: Security event creation with valid data succeeds
        
        this.ensureInitialized();
        
        const {
            id, timestamp, eventType, severity,
            source, target, description,
            mitigationApplied, mitigationDetails
        } = event;
        
        try {
            await this.db.run(
                `INSERT INTO security_events
                (id, timestamp, event_type, severity,
                source, target, description,
                mitigation_applied, mitigation_details)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    timestamp.getTime(),
                    eventType,
                    severity,
                    source,
                    target,
                    description,
                    mitigationApplied ? 1 : 0,
                    mitigationDetails || null
                ]
            );
            
            // Insert metadata
            if (event.metadata) {
                await this.setSecurityEventMetadata(id, event.metadata);
            }
            
            return id;
        } catch (error) {
            throw new Error(`Failed to record security event: ${error.message}`);
        }
    }
    
    /**
     * Query security events
     */
    async querySecurityEvents(
        startTime?: Date,
        endTime?: Date,
        eventTypes?: SecurityEventType[],
        severities?: SecuritySeverity[],
        source?: string,
        target?: string,
        limit?: number,
        offset?: number
    ): Promise<SecurityEvent[]> {
        // TEST: Query security events with filters returns matching events
        
        this.ensureInitialized();
        
        try {
            let sql = `SELECT * FROM security_events`;
            const params = [];
            
            // Build WHERE clause
            const whereConditions = [];
            
            // Filter by time range
            if (startTime) {
                whereConditions.push(`timestamp >= ?`);
                params.push(startTime.getTime());
            }
            
            if (endTime) {
                whereConditions.push(`timestamp <= ?`);
                params.push(endTime.getTime());
            }
            
            // Filter by event types
            if (eventTypes && eventTypes.length > 0) {
                const placeholders = eventTypes.map(() => '?').join(', ');
                whereConditions.push(`event_type IN (${placeholders})`);
                params.push(...eventTypes);
            }
            
            // Filter by severities
            if (severities && severities.length > 0) {
                const placeholders = severities.map(() => '?').join(', ');
                whereConditions.push(`severity IN (${placeholders})`);
                params.push(...severities);
            }
            
            // Filter by source
            if (source) {
                whereConditions.push(`source = ?`);
                params.push(source);
            }
            
            // Filter by target
            if (target) {
                whereConditions.push(`target = ?`);
                params.push(target);
            }
            
            // Add WHERE clause if conditions exist
            if (whereConditions.length > 0) {
                sql += ` WHERE ${whereConditions.join(' AND ')}`;
            }
            
            // Add ORDER BY clause
            sql += ` ORDER BY timestamp DESC`;
            
            // Add LIMIT and OFFSET for pagination
            if (limit) {
                sql += ` LIMIT ?`;
                params.push(limit);
                
                if (offset) {
                    sql += ` OFFSET ?`;
                    params.push(offset);
                }
            }
            
            // Execute query
            const eventRows = await this.db.all(sql, params);
            
            // Build complete security events
            const events: SecurityEvent[] = [];
            
            for (const eventRow of eventRows) {
                const metadata = await this.getSecurityEventMetadata(eventRow.id);
                events.push(this.buildSecurityEvent(eventRow, metadata));
            }
            
            return events;
        } catch (error) {
            throw new Error(`Failed to query security events: ${error.message}`);
        }
    }
    
    // ====================
    // Helper Methods
    // ====================
    
    /**
     * Ensure the database is initialized
     */
    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new Error('Database is not initialized');
        }
    }
    
    /**
     * Build an agent record from database rows
     */
    private buildAgentRecord(
        agent: any,
        endpoints: any[],
        capabilities: string[],
        metadata: Record<string, any>
    ): AgentRecord {
        return {
            id: agent.id,
            name: agent.name,
            publicKey: agent.public_key,
            certificateId: agent.certificate_id,
            endpoints: endpoints.map(ep => ({
                id: ep.id,
                protocol: ep.protocol,
                address: ep.address,
                port: ep.port,
                health: {
                    status: ep.health_status,
                    lastChecked: new Date(ep.last_checked),
                    message: ep.health_message
                }
            })),
            defaultEndpoint: agent.default_endpoint_id,
            capabilities,
            version: agent.version,
            description: agent.description,
            metadata,
            createdAt: new Date(agent.created_at),
            updatedAt: new Date(agent.updated_at),
            expiresAt: new Date(agent.expires_at),
            status: agent.status,
            owner: agent.owner
        };
    }
    
    /**
     * Build a certificate from database rows
     */
    private buildCertificate(
        cert: any,
        metadata: Record<string, any>
    ): Certificate {
        return {
            id: cert.id,
            subject: cert.subject,
            issuer: cert.issuer,
            notBefore: new Date(cert.not_before),
            notAfter: new Date(cert.not_after),
            publicKey: cert.public_key,
            certificate: cert.certificate,
            fingerprint: cert.fingerprint,
            status: cert.status,
            metadata
        };
    }
    
    /**
     * Build a security event from database rows
     */
    private buildSecurityEvent(
        event: any,
        metadata: Record<string, any>
    ): SecurityEvent {
        return {
            id: event.id,
            timestamp: new Date(event.timestamp),
            eventType: event.event_type,
            severity: event.severity,
            source: event.source,
            target: event.target,
            description: event.description,
            metadata,
            mitigationApplied: Boolean(event.mitigation_applied),
            mitigationDetails: event.mitigation_details
        };
    }
    
    // Methods for handling endpoints
    private async createEndpoint(agentId: string, endpoint: Endpoint): Promise<void> { /* ... */ }
    private async getEndpointsByAgentId(agentId: string): Promise<any[]> { /* ... */ }
    private async deleteEndpointsByAgentId(agentId: string): Promise<void> { /* ... */ }
    
    // Methods for handling capabilities
    private async ensureCapabilityExists(name: string): Promise<string> { /* ... */ }
    private async setAgentCapabilities(agentId: string, capabilities: string[]): Promise<void> { /* ... */ }
    private async getAgentCapabilities(agentId: string): Promise<string[]> { /* ... */ }
    
    // Methods for handling metadata
    private async setAgentMetadata(agentId: string, metadata: Record<string, any>): Promise<void> { /* ... */ }
    private async getAgentMetadata(agentId: string): Promise<Record<string, any>> { /* ... */ }
    private async setCertificateMetadata(certId: string, metadata: Record<string, any>): Promise<void> { /* ... */ }
    private async getCertificateMetadata(certId: string): Promise<Record<string, any>> { /* ... */ }
    private async setSecurityEventMetadata(eventId: string, metadata: Record<string, any>): Promise<void> { /* ... */ }
    private async getSecurityEventMetadata(eventId: string): Promise<Record<string, any>> { /* ... */ }
}
```

## Database Service Factory

```typescript
// DatabaseServiceFactory pseudocode

class DatabaseServiceFactory {
    private static instance: DatabaseService | null = null;
    
    /**
     * Get a singleton instance of the database service
     */
    static async getInstance(): Promise<DatabaseService> {
        // TEST: Singleton pattern returns the same instance on multiple calls
        
        if (!this.instance) {
            this.instance = new DatabaseService();
            await this.instance.initialize();
        }
        
        return this.instance;
    }
    
    /**
     * Reset the database (for testing)
     */
    static async resetDatabase(): Promise<void> {
        // TEST: Database reset clears all tables
        
        if (this.instance) {
            await this.instance.close();
            this.instance = null;
        }
        
        // Delete database file
        await fs.unlink('./ans_database.sqlite').catch(() => {});
    }
}
```

## Key Considerations

### Transaction Support

The database layer will use transactions for operations that involve multiple tables to ensure data consistency.

```typescript
// Transaction example pseudocode
async createAgentWithTransaction(agent: AgentRecord): Promise<string> {
    this.ensureInitialized();
    
    try {
        await this.db.run('BEGIN TRANSACTION');
        
        // Perform all database operations...
        
        await this.db.run('COMMIT');
        return agent.id;
    } catch (error) {
        await this.db.run('ROLLBACK');
        throw new Error(`Transaction failed: ${error.message}`);
    }
}
```

### Migration Support

The database layer will include support for schema migrations to handle future changes.

```typescript
// Migration pseudocode
async migrateDatabase(): Promise<void> {
    this.ensureInitialized();
    
    try {
        // Check current schema version
        const version = await this.getCurrentSchemaVersion();
        
        // Apply migrations based on version
        if (version < 2) {
            await this.applyMigrationV2();
        }
        
        if (version < 3) {
            await this.applyMigrationV3();
        }
        
        // Update schema version
        await this.updateSchemaVersion(LATEST_VERSION);
    } catch (error) {
        throw new Error(`Migration failed: ${error.message}`);
    }
}
```

### Performance Optimizations

The database layer includes several performance optimizations:

1. **Indexes**: Critical columns have indexes to speed up common queries
2. **Caching**: Frequently accessed data could be cached in memory
3. **Query Optimization**: Queries are designed to use indexes effectively
4. **Batch Operations**: Support for batch inserts and updates
5. **Connection Pooling**: For high-concurrency environments

### Error Handling

The database layer provides comprehensive error handling:

1. **Specific Error Types**: Different error types for different database errors
2. **Detailed Error Messages**: Clear error messages for debugging
3. **Error Logging**: All database errors are logged
4. **Retry Logic**: For transient errors
5. **Graceful Degradation**: Fallback strategies for database failures
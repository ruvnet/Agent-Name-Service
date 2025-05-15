import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { AgentRecord, Certificate, SecurityEvent, ResolutionQuery, CertificateStatus, SecurityEventType, SecuritySeverity } from '../types';

const SCHEMA_SQL = `
-- Agent Records Table
CREATE TABLE IF NOT EXISTS agents (
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
CREATE INDEX IF NOT EXISTS idx_agents_name ON agents(name);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_owner ON agents(owner);
CREATE INDEX IF NOT EXISTS idx_agents_expires_at ON agents(expires_at);

-- Agent Endpoints Table
CREATE TABLE IF NOT EXISTS endpoints (
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

CREATE INDEX IF NOT EXISTS idx_endpoints_agent_id ON endpoints(agent_id);

-- Agent Capabilities Table (many-to-many)
CREATE TABLE IF NOT EXISTS capabilities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS agent_capabilities (
    agent_id TEXT NOT NULL,
    capability_id TEXT NOT NULL,
    PRIMARY KEY (agent_id, capability_id),
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    FOREIGN KEY (capability_id) REFERENCES capabilities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_capabilities_agent_id ON agent_capabilities(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_capabilities_capability_id ON agent_capabilities(capability_id);

-- Agent Metadata Table (key-value store for extensible metadata)
CREATE TABLE IF NOT EXISTS agent_metadata (
    agent_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (agent_id, key),
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_metadata_agent_id ON agent_metadata(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_metadata_key ON agent_metadata(key);

-- Certificates Table
CREATE TABLE IF NOT EXISTS certificates (
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

CREATE INDEX IF NOT EXISTS idx_certificates_fingerprint ON certificates(fingerprint);
CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status);
CREATE INDEX IF NOT EXISTS idx_certificates_not_after ON certificates(not_after);

-- Certificate Metadata Table
CREATE TABLE IF NOT EXISTS certificate_metadata (
    certificate_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (certificate_id, key),
    FOREIGN KEY (certificate_id) REFERENCES certificates(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_certificate_metadata_certificate_id ON certificate_metadata(certificate_id);

-- Security Events Table
CREATE TABLE IF NOT EXISTS security_events (
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

CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_source ON security_events(source);
CREATE INDEX IF NOT EXISTS idx_security_events_target ON security_events(target);

-- Security Event Metadata Table
CREATE TABLE IF NOT EXISTS security_event_metadata (
    event_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (event_id, key),
    FOREIGN KEY (event_id) REFERENCES security_events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_security_event_metadata_event_id ON security_event_metadata(event_id);
\`;

class DatabaseService {
    private db: any;
    private initialized: boolean = false;

    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        try {
            this.db = await open({
                filename: './ans_database.sqlite',
                driver: sqlite3.Database
            });
            await this.createTablesIfNotExist();
            this.initialized = true;
        } catch (error) {
            throw new Error(\`Failed to initialize database: \${error.message}\`);
        }
    }

    private async createTablesIfNotExist(): Promise<void> {
        await this.db.exec(SCHEMA_SQL);
    }

    async close(): Promise<void> {
        if (!this.initialized) {
            return;
        }

        await this.db.close();
        this.initialized = false;
    }

    // Additional CRUD operations and helper methods will be implemented here
}

`;
export { DatabaseService };
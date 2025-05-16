import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';

// Define schema for certificate rotation
const certificateRotationSchema = z.object({
  agentName: z.string().describe('The name of the agent requiring certificate rotation'),
  rotationType: z.enum(['SCHEDULED', 'REQUESTED', 'FORCED']).describe('The type of certificate rotation'),
  reason: z.string().optional().describe('Reason for certificate rotation'),
  oldCertificate: z.any().optional().describe('The existing certificate data if available'),
  notifyOwner: z.boolean().default(true).describe('Whether to notify the agent owner about rotation'),
});

// Define output schemas for steps
const certificateVerificationSchema = z.object({
  agentName: z.string(),
  agentExists: z.boolean(),
  currentCertificate: z.any().nullable(),
  certificateStatus: z.string(),
  expiryDate: z.string().nullable(),
  daysUntilExpiry: z.number().nullable(),
  needsRotation: z.boolean(),
  reason: z.string(),
  verificationStatus: z.string(),
  issues: z.array(z.string()),
});

const certificateGenerationSchema = z.object({
  agentName: z.string(),
  oldCertificate: z.any().nullable(),
  newCertificate: z.any().nullable(),
  backupCreated: z.boolean(),
  generationStatus: z.string(),
  revocationStatus: z.string().optional(),
  issues: z.array(z.string()),
});

const certificateUpdateSchema = z.object({
  agentName: z.string(),
  newCertificate: z.any(),
  updateStatus: z.string(),
  agentCardUpdated: z.boolean(),
  notificationSent: z.boolean(),
  issues: z.array(z.string()),
});

// Step 1: Verify Certificate Status
const verifyCertificateStatus = new Step({
  id: 'verify-certificate-status',
  description: 'Verifies the current certificate status and determines if rotation is needed',
  inputSchema: certificateRotationSchema,
  outputSchema: certificateVerificationSchema,
  execute: async ({ context }) => {
    // Get trigger data
    const rotationData = context.getStepResult('trigger');
    
    if (!rotationData) {
      throw new Error('Certificate rotation data not found in trigger');
    }
    
    // Extract data
    const { agentName, rotationType, reason, oldCertificate } = rotationData;
    
    // Initialize verification result
    const verificationResult = {
      agentName,
      agentExists: false,
      currentCertificate: null,
      certificateStatus: 'UNKNOWN',
      expiryDate: null,
      daysUntilExpiry: null,
      needsRotation: false,
      reason: reason || '',
      verificationStatus: 'PENDING',
      issues: [] as string[],
    };
    
    try {
      // In a real implementation, this would check the agent database
      // This is a simplified mock implementation
      
      // Simulate checking if agent exists
      verificationResult.agentExists = true;
      
      // Get current certificate (either from input or by querying)
      let certificate;
      if (oldCertificate) {
        certificate = oldCertificate;
      } else {
        // Simulate fetching certificate from database
        certificate = {
          serialNumber: 'abc123def456',
          subject: `/CN=${agentName}/O=Agent Naming Service`,
          issuer: '/CN=ANS Root CA/O=Agent Naming Service',
          validFrom: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(), // 180 days ago
          validTo: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(), // 180 days from now
          fingerprint: 'aabbccddeeff00112233445566778899',
          status: 'VALID',
        };
      }
      
      verificationResult.currentCertificate = certificate;
      
      // Check certificate status
      if (certificate) {
        verificationResult.certificateStatus = certificate.status;
        verificationResult.expiryDate = certificate.validTo;
        
        // Calculate days until expiry
        const expiryDate = new Date(certificate.validTo);
        const now = new Date();
        const daysUntilExpiry = Math.round((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        verificationResult.daysUntilExpiry = daysUntilExpiry;
        
        // Determine if rotation is needed
        if (certificate.status !== 'VALID') {
          verificationResult.needsRotation = true;
          verificationResult.reason = 'Certificate is not valid';
        } else if (daysUntilExpiry < 30) {
          verificationResult.needsRotation = true;
          verificationResult.reason = `Certificate expires in ${daysUntilExpiry} days`;
        } else if (rotationType === 'FORCED') {
          verificationResult.needsRotation = true;
          verificationResult.reason = reason || 'Forced rotation requested';
        } else if (rotationType === 'REQUESTED') {
          verificationResult.needsRotation = true;
          verificationResult.reason = reason || 'Rotation requested by owner';
        } else if (rotationType === 'SCHEDULED' && daysUntilExpiry < 90) {
          verificationResult.needsRotation = true;
          verificationResult.reason = `Scheduled rotation for certificate expiring in ${daysUntilExpiry} days`;
        }
      } else {
        verificationResult.certificateStatus = 'MISSING';
        verificationResult.needsRotation = true;
        verificationResult.reason = 'No valid certificate found';
      }
      
      verificationResult.verificationStatus = 'COMPLETED';
      return verificationResult;
    } catch (error) {
      verificationResult.verificationStatus = 'FAILED';
      verificationResult.issues.push(`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return verificationResult;
    }
  },
});

// Step 2: Generate New Certificate
const generateNewCertificate = new Step({
  id: 'generate-new-certificate',
  description: 'Generates a new certificate and revokes the old one',
  execute: async ({ context }) => {
    // Get verification result
    const verificationResult = context.getStepResult(verifyCertificateStatus);
    
    if (!verificationResult) {
      throw new Error('Certificate verification result not found');
    }
    
    // Cast to expected type
    const typedVerificationResult = verificationResult as {
      agentName: string;
      agentExists: boolean;
      currentCertificate: any;
      needsRotation: boolean;
      reason: string;
      issues: string[];
    };
    
    // Extract key information
    const { agentName, agentExists, currentCertificate, needsRotation, reason, issues } = typedVerificationResult;
    
    // Initialize generation result
    const generationResult = {
      agentName,
      oldCertificate: currentCertificate,
      newCertificate: null as any,
      backupCreated: false,
      generationStatus: 'PENDING',
      revocationStatus: 'PENDING',
      issues: [...issues],
    };
    
    // Skip certificate generation if not needed
    if (!agentExists) {
      generationResult.generationStatus = 'FAILED';
      generationResult.issues.push('Agent does not exist');
      return generationResult;
    }
    
    if (!needsRotation) {
      generationResult.generationStatus = 'SKIPPED';
      generationResult.issues.push('Certificate rotation not needed');
      return generationResult;
    }
    
    try {
      // In a real implementation, this would create a backup of the old certificate
      generationResult.backupCreated = true;
      
      // In a real implementation, this would revoke the old certificate
      if (currentCertificate) {
        // Simulate revoking old certificate
        generationResult.revocationStatus = 'REVOKED';
      } else {
        generationResult.revocationStatus = 'NOT_NEEDED';
      }
      
      // Generate new certificate
      // In a real implementation, this would generate a proper X.509 certificate
      // This is a simplified mock implementation
      
      // Generate certificate properties
      const now = new Date();
      const expirationDate = new Date(now);
      expirationDate.setFullYear(expirationDate.getFullYear() + 1); // 1 year validity
      
      const serialNumber = Math.random().toString(16).substring(2, 18); // Random serial number
      const fingerprint = Math.random().toString(16).substring(2, 34); // Random fingerprint
      
      // Create the certificate object
      const newCertificate = {
        serialNumber,
        subject: `/CN=${agentName}/O=Agent Naming Service`,
        issuer: '/CN=ANS Root CA/O=Agent Naming Service',
        validFrom: now.toISOString(),
        validTo: expirationDate.toISOString(),
        fingerprint,
        publicKey: `-----BEGIN PUBLIC KEY-----\nMC4CAQACBQDnGQc3AgMBAAECBQCcvBa5AgMA/icCAwDX3QIDANu/AgIHYQIDAJ8l\n-----END PUBLIC KEY-----`,
        status: 'VALID',
      };
      
      generationResult.newCertificate = newCertificate;
      generationResult.generationStatus = 'GENERATED';
      
      return generationResult;
    } catch (error) {
      generationResult.generationStatus = 'FAILED';
      generationResult.issues.push(`Certificate generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return generationResult;
    }
  },
});

// Step 3: Update Agent Certificate
const updateAgentCertificate = new Step({
  id: 'update-agent-certificate',
  description: 'Updates the agent with the new certificate',
  execute: async ({ context }) => {
    // Get generation result
    const generationResult = context.getStepResult(generateNewCertificate);
    
    if (!generationResult) {
      throw new Error('Certificate generation result not found');
    }
    
    // Cast to expected type
    const typedGenerationResult = generationResult as {
      agentName: string;
      newCertificate: any;
      generationStatus: string;
      issues: string[];
    };
    
    // Get original trigger data for notification settings
    const triggerData = context.getStepResult('trigger') as {
      notifyOwner: boolean;
    };
    
    // Extract key information
    const { agentName, newCertificate, generationStatus, issues } = typedGenerationResult;
    const notifyOwner = triggerData?.notifyOwner !== false; // Default to true if not specified
    
    // Initialize update result
    const updateResult = {
      agentName,
      newCertificate,
      updateStatus: 'PENDING',
      agentCardUpdated: false,
      notificationSent: false,
      issues: [...issues],
    };
    
    // Skip update if generation failed
    if (generationStatus !== 'GENERATED' || !newCertificate) {
      updateResult.updateStatus = 'SKIPPED';
      updateResult.issues.push('Certificate update skipped due to generation failure');
      return updateResult;
    }
    
    try {
      // In a real implementation, this would update the agent's certificate in the database
      // This is a simplified mock implementation
      
      // Simulate updating agent card
      updateResult.agentCardUpdated = true;
      
      // Simulate sending notification if requested
      if (notifyOwner) {
        // In a real implementation, this would send an email or notification to the agent owner
        updateResult.notificationSent = true;
      }
      
      updateResult.updateStatus = 'COMPLETED';
      return updateResult;
    } catch (error) {
      updateResult.updateStatus = 'FAILED';
      updateResult.issues.push(`Certificate update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return updateResult;
    }
  },
});

// Create the certificate rotation workflow
const certificateRotationWorkflow = new Workflow({
  name: 'certificate-rotation-workflow',
  triggerSchema: certificateRotationSchema,
})
  .step(verifyCertificateStatus)
  .then(generateNewCertificate)
  .then(updateAgentCertificate);

// Commit the workflow to make it active
certificateRotationWorkflow.commit();

// Export the workflow
export { certificateRotationWorkflow };

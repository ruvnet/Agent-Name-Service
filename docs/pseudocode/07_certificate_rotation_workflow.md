# Certificate Rotation Workflow

## Overview

The Certificate Rotation Workflow handles the process of renewing or rotating certificates for registered agents. Certificate rotation is a critical security practice that ensures certificates are regularly updated before expiration, maintaining the security and integrity of the agent authentication system.

## Workflow Components

### Input Schema

```typescript
// Define the schema for certificate rotation data
const certificateRotationSchema = z.object({
  agentName: z.string().describe('The name of the registered agent'),
  rotationReason: z.enum(['EXPIRING', 'SECURITY_POLICY', 'MANUAL', 'COMPROMISED']).describe('Reason for certificate rotation'),
  currentCertificateSerialNumber: z.string().optional().describe('Serial number of the current certificate'),
  forceRotation: z.boolean().default(false).describe('Whether to force rotation even if not near expiration'),
  notifyEmail: z.string().email().optional().describe('Email to notify about the rotation'),
});
```

### Steps

#### 1. Validate Certificate Status

```typescript
const validateCertificateStatus = new Step({
  id: 'validate-certificate-status',
  description: 'Validates the current certificate status and rotation eligibility',
  inputSchema: certificateRotationSchema,
  outputSchema: z.object({
    agentName: z.string(),
    currentCertificate: z.any().nullable(),
    eligibleForRotation: z.boolean(),
    rotationReason: z.string(),
    forceRotation: z.boolean(),
    validationDetails: z.object({
      certificateFound: z.boolean(),
      daysToExpiration: z.number().optional(),
      certificateStatus: z.string().optional(),
      issues: z.array(z.string()),
    }),
  }),
  execute: async ({ context }) => {
    // Get the trigger data for certificate rotation
    const triggerData = context.getStepResult('trigger');
    
    if (!triggerData) {
      throw new Error('Certificate rotation data not found in trigger');
    }
    
    // Extract rotation details
    const { agentName, rotationReason, currentCertificateSerialNumber, forceRotation } = triggerData;
    
    // Initialize validation results
    const validationDetails = {
      certificateFound: false,
      daysToExpiration: undefined,
      certificateStatus: undefined,
      issues: [],
    };
    
    try {
      // In a real implementation, this would retrieve the agent's certificate from storage
      // Mock implementation for design purposes
      let currentCertificate = null;
      
      // Check if the agent exists and has a certificate
      // This would normally query a database
      const agentExists = true; // Placeholder - would check registry
      
      if (!agentExists) {
        validationDetails.issues.push(`Agent '${agentName}' not found in the registry`);
      } else {
        // Retrieve current certificate
        // In production, this would get the certificate from a database
        currentCertificate = {
          serialNumber: currentCertificateSerialNumber || `sample-serial-${Date.now()}`,
          subject: `CN=${agentName},O=Agent Name Service`,
          issuer: 'CN=ANS Root CA,O=Agent Name Service',
          validFrom: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days ago
          validTo: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days in future
          status: 'VALID',
        };
        
        validationDetails.certificateFound = true;
        validationDetails.certificateStatus = currentCertificate.status;
        
        // Calculate days until expiration
        const expirationDate = new Date(currentCertificate.validTo);
        const now = new Date();
        const millisecondsPerDay = 24 * 60 * 60 * 1000;
        validationDetails.daysToExpiration = Math.round((expirationDate.getTime() - now.getTime()) / millisecondsPerDay);
        
        // Check if certificate is already expired
        if (validationDetails.daysToExpiration < 0) {
          validationDetails.issues.push('Certificate has already expired');
          currentCertificate.status = 'EXPIRED';
          validationDetails.certificateStatus = 'EXPIRED';
        }
      }
      
      // Determine if eligible for rotation
      let eligibleForRotation = false;
      
      if (!validationDetails.certificateFound) {
        // Cannot rotate a non-existent certificate
        eligibleForRotation = false;
      } else if (forceRotation) {
        // Force rotation takes precedence over other checks
        eligibleForRotation = true;
      } else if (rotationReason === 'COMPROMISED') {
        // Always allow rotation for compromised certificates
        eligibleForRotation = true;
      } else if (rotationReason === 'EXPIRING') {
        // Check if certificate is close to expiration (less than 30 days)
        eligibleForRotation = validationDetails.daysToExpiration !== undefined && 
                             validationDetails.daysToExpiration <= 30;
        
        if (!eligibleForRotation && validationDetails.daysToExpiration !== undefined) {
          validationDetails.issues.push(`Certificate is not near expiration (${validationDetails.daysToExpiration} days remaining)`);
        }
      } else if (rotationReason === 'SECURITY_POLICY') {
        // Security policy rotations are always eligible
        eligibleForRotation = true;
      } else if (rotationReason === 'MANUAL') {
        // Manual rotations are always eligible
        eligibleForRotation = true;
      }
      
      // Return validation result
      return {
        agentName,
        currentCertificate,
        eligibleForRotation,
        rotationReason,
        forceRotation,
        validationDetails,
      };
    } catch (error) {
      validationDetails.issues.push(`Error validating certificate: ${error.message || 'Unknown error'}`);
      
      return {
        agentName,
        currentCertificate: null,
        eligibleForRotation: false,
        rotationReason,
        forceRotation,
        validationDetails,
      };
    }
  },
});

// TEST: Should identify certificates within 30 days of expiration
// TEST: Should allow rotation for COMPROMISED certificates regardless of expiration
// TEST: Should enforce forceRotation flag properly
// TEST: Should identify already expired certificates
// TEST: Should reject rotation for non-existent agents
// TEST: Should handle certificate retrieval errors gracefully
```

#### 2. Revoke Old Certificate

```typescript
const revokeOldCertificate = new Step({
  id: 'revoke-old-certificate',
  description: 'Revokes the current certificate if it exists',
  execute: async ({ context }) => {
    // Get validated certificate data from previous step
    const validationResult = context.getStepResult(validateCertificateStatus);
    
    if (!validationResult) {
      throw new Error('Certificate validation result not found');
    }
    
    // Initialize revocation result
    const revocationResult = {
      agentName: validationResult.agentName,
      revocationSuccessful: false,
      previousSerialNumber: null,
      revocationTime: null,
      revocationReason: validationResult.rotationReason,
      issues: [],
    };
    
    // Skip revocation if not eligible for rotation
    if (!validationResult.eligibleForRotation) {
      revocationResult.issues.push('Not eligible for certificate rotation');
      return {
        ...revocationResult,
        currentCertificate: validationResult.currentCertificate,
        proceedWithRotation: false,
      };
    }
    
    // Skip revocation if no current certificate exists
    if (!validationResult.currentCertificate) {
      revocationResult.issues.push('No existing certificate to revoke');
      return {
        ...revocationResult,
        currentCertificate: null,
        proceedWithRotation: true, // Can still issue a new certificate
      };
    }
    
    try {
      // In a real implementation, this would update the certificate status in a CRL
      // and potentially publish the updated CRL
      
      // Extract information from the current certificate
      const { serialNumber } = validationResult.currentCertificate;
      revocationResult.previousSerialNumber = serialNumber;
      
      // Mock revocation process
      // In production, this would update a certificate revocation list
      const revocationTime = new Date();
      revocationResult.revocationTime = revocationTime.toISOString();
      revocationResult.revocationSuccessful = true;
      
      // Log the revocation
      console.log(`Certificate ${serialNumber} for ${validationResult.agentName} revoked at ${revocationTime.toISOString()}`);
      
      return {
        ...revocationResult,
        currentCertificate: validationResult.currentCertificate,
        proceedWithRotation: true,
      };
    } catch (error) {
      // Handle revocation errors
      revocationResult.issues.push(`Failed to revoke certificate: ${error.message || 'Unknown error'}`);
      
      // Determine if we should proceed based on rotation reason
      const proceedDespiteError = 
        validationResult.rotationReason === 'COMPROMISED' || 
        validationResult.forceRotation;
      
      return {
        ...revocationResult,
        currentCertificate: validationResult.currentCertificate,
        proceedWithRotation: proceedDespiteError,
      };
    }
  },
});

// TEST: Should successfully revoke valid certificates
// TEST: Should record revocation time and reason
// TEST: Should proceed with rotation if revocation succeeds
// TEST: Should proceed despite errors for COMPROMISED certificates
// TEST: Should proceed despite errors when forceRotation is true
// TEST: Should handle revocation process errors gracefully
```

#### 3. Issue New Certificate

```typescript
const issueNewCertificate = new Step({
  id: 'issue-new-certificate',
  description: 'Issues a new certificate for the agent',
  execute: async ({ context }) => {
    // Get revocation result from previous step
    const revocationResult = context.getStepResult(revokeOldCertificate);
    
    if (!revocationResult) {
      throw new Error('Certificate revocation result not found');
    }
    
    // Skip issuance if not proceeding with rotation
    if (!revocationResult.proceedWithRotation) {
      return {
        agentName: revocationResult.agentName,
        status: 'SKIPPED',
        reason: 'Certificate rotation not required or allowed',
        newCertificate: null,
        issues: revocationResult.issues,
      };
    }
    
    try {
      // Generate a new certificate
      // In a real implementation, this would use proper crypto libraries
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setFullYear(now.getFullYear() + 1); // 1 year validity
      
      // Generate a unique serial number
      const serialNumber = `${Date.now()}-${Math.floor(Math.random() * 10000000000).toString(16)}`;
      
      // Create the new certificate
      const newCertificate = {
        serialNumber,
        subject: `CN=${revocationResult.agentName},O=Agent Name Service`,
        issuer: 'CN=ANS Root CA,O=Agent Name Service',
        validFrom: now.toISOString(),
        validTo: expiresAt.toISOString(),
        publicKey: `MOCK_PUBLIC_KEY_${Date.now()}`, // Mock public key
        fingerprint: `MOCK_FINGERPRINT_${Date.now()}`, // Mock fingerprint
        status: 'VALID',
        previousSerialNumber: revocationResult.previousSerialNumber,
      };
      
      // In a real implementation, this would store the certificate in a database
      
      return {
        agentName: revocationResult.agentName,
        status: 'SUCCESS',
        reason: revocationResult.revocationReason,
        newCertificate,
        oldCertificate: revocationResult.currentCertificate,
        issues: [],
      };
    } catch (error) {
      return {
        agentName: revocationResult.agentName,
        status: 'FAILED',
        reason: revocationResult.revocationReason,
        newCertificate: null,
        oldCertificate: revocationResult.currentCertificate,
        issues: [`Failed to issue new certificate: ${error.message || 'Unknown error'}`],
      };
    }
  },
});

// TEST: Should issue a new certificate with proper validity period
// TEST: Should include a reference to the previous certificate
// TEST: Should generate unique serial numbers
// TEST: Should skip issuance when rotation is not approved
// TEST: Should handle certificate generation errors gracefully
```

#### 4. Update Agent Card

```typescript
const updateAgentCard = new Step({
  id: 'update-agent-card',
  description: 'Updates the agent card with the new certificate',
  execute: async ({ context }) => {
    // Get certificate issuance result from previous step
    const issuanceResult = context.getStepResult(issueNewCertificate);
    
    if (!issuanceResult) {
      throw new Error('Certificate issuance result not found');
    }
    
    // Skip update if certificate issuance was skipped or failed
    if (issuanceResult.status !== 'SUCCESS') {
      return {
        agentName: issuanceResult.agentName,
        status: issuanceResult.status,
        updated: false,
        reason: issuanceResult.reason,
        issues: issuanceResult.issues,
      };
    }
    
    try {
      // In a real implementation, this would retrieve the current agent card
      // from the database, update it, and save it back
      
      // Update the agent card with the new certificate
      const updatedAgentCard = {
        name: issuanceResult.agentName,
        certificate: issuanceResult.newCertificate,
        certificateHistory: [
          {
            serialNumber: issuanceResult.oldCertificate?.serialNumber,
            rotationTime: new Date().toISOString(),
            rotationReason: issuanceResult.reason,
          }
        ],
        lastUpdated: new Date().toISOString(),
      };
      
      // Format the agent card as a string for storage/transmission
      const formattedAgentCard = `Agent Card for ${issuanceResult.agentName}: ${JSON.stringify(updatedAgentCard, null, 2)}`;
      
      // In a real implementation, this would save the updated card to a database
      
      return {
        agentName: issuanceResult.agentName,
        status: 'SUCCESS',
        updated: true,
        reason: issuanceResult.reason,
        agentCard: formattedAgentCard,
        rotationComplete: true,
        issues: [],
      };
    } catch (error) {
      return {
        agentName: issuanceResult.agentName,
        status: 'PARTIAL_SUCCESS',
        updated: false,
        reason: issuanceResult.reason,
        newCertificate: issuanceResult.newCertificate, // Include the certificate even though card update failed
        rotationComplete: false,
        issues: [`Failed to update agent card: ${error.message || 'Unknown error'}`],
      };
    }
  },
});

// TEST: Should update agent card with new certificate
// TEST: Should maintain certificate history in the agent card
// TEST: Should track rotation reason and time in the certificate history
// TEST: Should skip updates when certificate issuance failed
// TEST: Should handle database update errors gracefully
```

#### 5. Send Notifications

```typescript
const sendNotifications = new Step({
  id: 'send-notifications',
  description: 'Sends notifications about the certificate rotation',
  execute: async ({ context }) => {
    // Get agent card update result from previous step
    const updateResult = context.getStepResult(updateAgentCard);
    
    if (!updateResult) {
      throw new Error('Agent card update result not found');
    }
    
    // Get the original trigger data for notification settings
    const triggerData = context.getStepResult('trigger');
    const notifyEmail = triggerData?.notifyEmail;
    
    // Initialize notification results
    const notificationResults = {
      agentName: updateResult.agentName,
      notificationsSent: false,
      notificationChannels: [],
      issues: [],
    };
    
    try {
      // Skip notifications if rotation was not completed
      if (!updateResult.rotationComplete) {
        notificationResults.issues.push('Certificate rotation was not completed successfully');
        return {
          ...notificationResults,
          status: updateResult.status,
          reason: updateResult.reason,
        };
      }
      
      // Build notification message
      const notificationMessage = {
        subject: `Certificate Rotation Completed for ${updateResult.agentName}`,
        body: `
          Certificate rotation has been completed for agent ${updateResult.agentName}
          Rotation reason: ${updateResult.reason}
          Rotation time: ${new Date().toISOString()}
          
          Please update your systems accordingly.
        `,
        rotationSummary: {
          agentName: updateResult.agentName,
          status: updateResult.status,
          reason: updateResult.reason,
          completionTime: new Date().toISOString(),
        }
      };
      
      // Send email notification if email is provided
      if (notifyEmail) {
        // In a real implementation, this would send an actual email
        console.log(`MOCK: Sending email notification to ${notifyEmail}`);
        notificationResults.notificationChannels.push('email');
      }
      
      // Log the rotation in the system (this would go to a logging service)
      console.log(`Certificate rotation completed for ${updateResult.agentName}`);
      notificationResults.notificationChannels.push('system_log');
      
      // Update notification results
      notificationResults.notificationsSent = notificationResults.notificationChannels.length > 0;
      
      return {
        ...notificationResults,
        status: updateResult.status,
        reason: updateResult.reason,
        rotationComplete: updateResult.rotationComplete,
      };
    } catch (error) {
      notificationResults.issues.push(`Failed to send notifications: ${error.message || 'Unknown error'}`);
      
      return {
        ...notificationResults,
        status: updateResult.status,
        reason: updateResult.reason,
        rotationComplete: updateResult.rotationComplete,
      };
    }
  },
});

// TEST: Should send email notifications when email is provided
// TEST: Should log rotation events to system logs
// TEST: Should include rotation details in notifications
// TEST: Should skip notifications for incomplete rotations
// TEST: Should handle notification delivery errors gracefully
```

### Complete Workflow

```typescript
// Create the certificate rotation workflow
export const certificateRotationWorkflow = new Workflow({
  name: 'certificate-rotation-workflow',
  triggerSchema: certificateRotationSchema,
})
  .step(validateCertificateStatus)
  .then(revokeOldCertificate)
  .then(issueNewCertificate)
  .then(updateAgentCard)
  .then(sendNotifications);

// Commit the workflow
certificateRotationWorkflow.commit();
```

## Sequence Diagram

```
┌──────────────┐    ┌───────────────────┐    ┌───────────────┐    ┌────────────────┐    ┌──────────────┐    ┌───────────────┐
│    Client    │    │validateCertificate│    │revokeCertificate│    │issueNewCertificate│    │updateAgentCard│    │ notifications │
└──────┬───────┘    └─────────┬─────────┘    └───────┬───────┘    └─────────┬────────┘    └───────┬──────┘    └───────┬───────┘
       │                      │                      │                      │                     │                   │
       │ Rotate Certificate   │                      │                      │                     │                   │
       │─────────────────────>│                      │                      │                     │                   │
       │                      │                      │                      │                     │                   │
       │                      │ Check eligibility    │                      │                     │                   │
       │                      │─────────────────────>│                      │                     │                   │
       │                      │                      │                      │                     │                   │
       │                      │                      │ Revoke old cert      │                     │                   │
       │                      │                      │─────────────────────>│                     │                   │
       │                      │                      │                      │                     │                   │
       │                      │                      │                      │ Issue new cert      │                   │
       │                      │                      │                      │─────────────────────>                   │
       │                      │                      │                      │                     │                   │
       │                      │                      │                      │                     │ Update card       │
       │                      │                      │                      │                     │─────────────────>│
       │                      │                      │                      │                     │                   │
       │                      │                      │                      │                     │                   │ Send 
       │                      │                      │                      │                     │                   │ notifications
       │                      │                      │                      │                     │                   │──────────┐
       │                      │                      │                      │                     │                   │          │
       │                      │                      │                      │                     │                   │<─────────┘
       │                      │                      │                      │                     │                   │
       │ Return Rotation      │                      │                      │                     │                   │
       │ Result               │                      │                      │                     │                   │
       │<─────────────────────────────────────────────────────────────────────────────────────────────────────────────│
       │                      │                      │                      │                     │                   │
```

## Error Handling

The workflow includes robust error handling at each stage of the certificate rotation process:

1. **Validation Errors**: Issues with agent existence, certificate status, or eligibility for rotation are captured in the validation step.

2. **Revocation Failures**: Failed attempts to revoke old certificates are handled, with options to proceed in critical scenarios (e.g., compromised certificates).

3. **Issuance Failures**: Problems with generating new certificates are detected and reported.

4. **Card Update Failures**: The workflow handles cases where agent card updates fail despite successful certificate issuance.

5. **Notification Failures**: Issues with sending notifications do not impact the core rotation process.

## Security Considerations

1. **Certificate Lifecycle**: The workflow enforces proper certificate lifecycle management by validating expiration dates and handling revocation.

2. **Revocation Records**: Maintains a history of revoked certificates for audit and security purposes.

3. **Forced Rotation**: Provides an emergency mechanism for immediate certificate rotation in case of compromise.

4. **Secure Key Generation**: New certificates should use strong cryptographic algorithms and key sizes.

5. **Audit Trail**: Maintains a complete audit trail of certificate rotations, including reasons and timing.

6. **Notification Security**: Ensures that sensitive certificate details are properly secured in notifications.

## Implementation Guidelines

1. **Certificate Authority Integration**: The production implementation should integrate with a proper Certificate Authority (CA) system.

2. **CRL Updates**: Certificate revocations should update Certificate Revocation Lists (CRLs) or OCSP responders.

3. **Key Material Handling**: Ensure secure generation, storage, and destruction of key material.

4. **Rate Limiting**: Implement rate limiting to prevent abuse of the rotation mechanism.

5. **Certificate Transparency**: Consider publishing certificates to Certificate Transparency logs.
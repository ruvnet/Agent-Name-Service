# Agent Resolution Workflow

## Overview

The Agent Resolution Workflow manages the process of resolving agent names to their corresponding agent cards. This workflow provides a standardized and secure method for discovering and verifying agent identities, handling caching, validation, and fallback mechanisms for agent resolution.

## Workflow Components

### Input Schema

```typescript
// Define the schema for agent resolution data
const agentResolutionSchema = z.object({
  agentName: z.string().describe('The name of the agent to resolve'),
  resolveOptions: z.object({
    cacheResults: z.boolean().default(true).describe('Whether to cache resolution results'),
    bypassCache: z.boolean().default(false).describe('Whether to bypass the cache for this request'),
    maxAttempts: z.number().int().min(1).max(5).default(3).describe('Maximum resolution attempts'),
    timeoutMs: z.number().int().min(100).max(10000).default(5000).describe('Resolution timeout in milliseconds'),
    includeDetails: z.boolean().default(false).describe('Whether to include detailed agent information'),
  }).optional(),
});
```

### Steps

#### 1. Validate Resolution Request

```typescript
const validateResolutionRequest = new Step({
  id: 'validate-resolution-request',
  description: 'Validates the agent name and resolution options',
  inputSchema: agentResolutionSchema,
  outputSchema: z.object({
    agentName: z.string(),
    resolveOptions: z.object({
      cacheResults: z.boolean(),
      bypassCache: z.boolean(),
      maxAttempts: z.number(),
      timeoutMs: z.number(),
      includeDetails: z.boolean(),
    }),
    validationResults: z.object({
      isValid: z.boolean(),
      issues: z.array(z.string()),
    }),
  }),
  execute: async ({ context }) => {
    // Get the trigger data for resolution
    const triggerData = context.getStepResult('trigger');
    
    if (!triggerData) {
      throw new Error('Agent resolution data not found in trigger');
    }
    
    // Extract resolution details
    const { agentName, resolveOptions = {} } = triggerData;
    
    // Apply default options if not provided
    const resolveOptionsWithDefaults = {
      cacheResults: resolveOptions.cacheResults ?? true,
      bypassCache: resolveOptions.bypassCache ?? false,
      maxAttempts: resolveOptions.maxAttempts ?? 3,
      timeoutMs: resolveOptions.timeoutMs ?? 5000,
      includeDetails: resolveOptions.includeDetails ?? false,
    };
    
    // Initialize validation results
    const validationResults = {
      isValid: true,
      issues: [],
    };
    
    // Validate agent name (alphanumeric, hyphens, underscores, dots)
    if (!agentName || typeof agentName !== 'string') {
      validationResults.isValid = false;
      validationResults.issues.push('Agent name is required and must be a string');
    } else if (agentName.length < 3 || agentName.length > 64) {
      validationResults.isValid = false;
      validationResults.issues.push('Agent name must be between 3 and 64 characters');
    } else if (!/^[a-zA-Z0-9._-]+$/.test(agentName)) {
      validationResults.isValid = false;
      validationResults.issues.push('Agent name can only contain letters, numbers, dots, hyphens, and underscores');
    }
    
    // Validate resolution options
    if (resolveOptionsWithDefaults.maxAttempts < 1 || resolveOptionsWithDefaults.maxAttempts > 5) {
      validationResults.isValid = false;
      validationResults.issues.push('Maximum attempts must be between 1 and 5');
    }
    
    if (resolveOptionsWithDefaults.timeoutMs < 100 || resolveOptionsWithDefaults.timeoutMs > 10000) {
      validationResults.isValid = false;
      validationResults.issues.push('Timeout must be between 100ms and 10000ms');
    }
    
    // Return validated data with results
    return {
      agentName,
      resolveOptions: resolveOptionsWithDefaults,
      validationResults,
    };
  },
});

// TEST: Should validate a correctly formatted agent name
// TEST: Should reject agent names with invalid characters
// TEST: Should reject agent names that are too short or too long
// TEST: Should apply default options when not provided
// TEST: Should validate resolution options for maxAttempts and timeoutMs
```

#### 2. Check Resolution Cache

```typescript
const checkResolutionCache = new Step({
  id: 'check-resolution-cache',
  description: 'Checks the cache for previously resolved agent data',
  execute: async ({ context }) => {
    // Get validation result from previous step
    const validationResult = context.getStepResult(validateResolutionRequest);
    
    if (!validationResult) {
      throw new Error('Validation result not found');
    }
    
    // If validation failed, skip cache check
    if (!validationResult.validationResults.isValid) {
      return {
        agentName: validationResult.agentName,
        cacheStatus: 'SKIPPED',
        cachedAgent: null,
        resolveOptions: validationResult.resolveOptions,
        proceedToResolution: true,
        cacheHit: false,
        reasons: ['Validation failed'],
      };
    }
    
    // Extract agent name and options
    const { agentName, resolveOptions } = validationResult;
    
    // Skip cache if bypassCache is true
    if (resolveOptions.bypassCache) {
      return {
        agentName,
        cacheStatus: 'BYPASSED',
        cachedAgent: null,
        resolveOptions,
        proceedToResolution: true,
        cacheHit: false,
        reasons: ['Cache bypass requested'],
      };
    }
    
    try {
      // In a real implementation, this would check a cache system
      // Mock implementation for design purposes
      
      // Simulate cache lookup
      const cachedAgent = null; // Placeholder for cache hit
      const cacheHit = false;   // Placeholder - would be true if found in cache
      
      if (cacheHit) {
        // Check if cache entry is fresh enough (within last hour)
        const cacheTime = new Date(); // Placeholder - would be actual cache time
        const now = new Date();
        const cacheAgeMs = now.getTime() - cacheTime.getTime();
        const maxCacheAgeMs = 60 * 60 * 1000; // 1 hour
        
        if (cacheAgeMs <= maxCacheAgeMs) {
          // Cache is fresh, use it
          return {
            agentName,
            cacheStatus: 'HIT',
            cachedAgent,
            resolveOptions,
            proceedToResolution: false, // No need to resolve, use cache
            cacheHit: true,
            reasons: ['Fresh cache entry found'],
          };
        } else {
          // Cache is stale, proceed to resolution but keep cache for fallback
          return {
            agentName,
            cacheStatus: 'STALE',
            cachedAgent,
            resolveOptions,
            proceedToResolution: true,
            cacheHit: true,
            reasons: ['Cache entry is stale'],
          };
        }
      } else {
        // No cache hit, proceed to resolution
        return {
          agentName,
          cacheStatus: 'MISS',
          cachedAgent: null,
          resolveOptions,
          proceedToResolution: true,
          cacheHit: false,
          reasons: ['No cache entry found'],
        };
      }
    } catch (error) {
      // If cache check fails, proceed to direct resolution
      return {
        agentName,
        cacheStatus: 'ERROR',
        cachedAgent: null,
        resolveOptions,
        proceedToResolution: true,
        cacheHit: false,
        reasons: [`Cache check failed: ${error.message || 'Unknown error'}`],
      };
    }
  },
});

// TEST: Should return cached agent when valid entry exists
// TEST: Should mark stale cache entries and trigger resolution
// TEST: Should respect bypassCache option
// TEST: Should handle cache lookup errors gracefully
// TEST: Should correctly classify cache hits, misses, and errors
```

#### 3. Resolve Agent

```typescript
const resolveAgent = new Step({
  id: 'resolve-agent',
  description: 'Resolves the agent name to an agent card',
  execute: async ({ context }) => {
    // Get cache check result from previous step
    const cacheResult = context.getStepResult(checkResolutionCache);
    
    if (!cacheResult) {
      throw new Error('Cache check result not found');
    }
    
    // If we don't need to proceed (fresh cache hit), return the cached agent
    if (!cacheResult.proceedToResolution && cacheResult.cachedAgent) {
      return {
        agentName: cacheResult.agentName,
        resolutionStatus: 'CACHED',
        agentCard: cacheResult.cachedAgent,
        resolveOptions: cacheResult.resolveOptions,
        attemptsMade: 0,
        sources: ['cache'],
        issues: [],
      };
    }
    
    // Extract agent name and options
    const { agentName, resolveOptions, cachedAgent } = cacheResult;
    
    // Initialize resolution result
    const resolutionResult = {
      agentName,
      resolutionStatus: 'PENDING',
      agentCard: null,
      resolveOptions,
      attemptsMade: 0,
      sources: [] as string[],
      issues: [] as string[],
    };
    
    // Track start time for timeout purposes
    const startTime = Date.now();
    
    // Try to resolve the agent
    for (let attempt = 1; attempt <= resolveOptions.maxAttempts; attempt++) {
      resolutionResult.attemptsMade = attempt;
      
      // Check if we've exceeded the timeout
      if (Date.now() - startTime > resolveOptions.timeoutMs) {
        resolutionResult.issues.push(`Resolution timed out after ${attempt - 1} attempts`);
        break;
      }
      
      try {
        // In a real implementation, this would query the registry database
        // Mock implementation for design purposes
        
        // Simulate query to registry
        const registryResult = { 
          found: false, 
          card: null 
        }; // Placeholder - would be real query result
        
        if (registryResult.found && registryResult.card) {
          // Agent found in registry
          resolutionResult.agentCard = registryResult.card;
          resolutionResult.resolutionStatus = 'RESOLVED';
          resolutionResult.sources.push('registry');
          return resolutionResult;
        }
        
        // If this was the last attempt and we still haven't found the agent,
        // add an issue
        if (attempt === resolveOptions.maxAttempts) {
          resolutionResult.issues.push(`Agent '${agentName}' not found in registry after ${attempt} attempts`);
        }
        
        // Add a small delay before the next attempt
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        // Log the error but continue with next attempt
        resolutionResult.issues.push(`Attempt ${attempt} failed: ${error.message || 'Unknown error'}`);
        
        // If this was the last attempt, set the status to FAILED
        if (attempt === resolveOptions.maxAttempts) {
          resolutionResult.resolutionStatus = 'FAILED';
        }
      }
    }
    
    // If we've exhausted all attempts but have a cached version, use it as fallback
    if (resolutionResult.resolutionStatus !== 'RESOLVED' && cachedAgent) {
      resolutionResult.agentCard = cachedAgent;
      resolutionResult.resolutionStatus = 'CACHED_FALLBACK';
      resolutionResult.sources.push('stale_cache');
      resolutionResult.issues.push('Using stale cache as fallback after resolution failed');
    } else if (resolutionResult.resolutionStatus !== 'RESOLVED') {
      // If we still don't have a resolved agent and no cache fallback
      resolutionResult.resolutionStatus = 'NOT_FOUND';
    }
    
    return resolutionResult;
  },
});

// TEST: Should resolve agent correctly when found in registry
// TEST: Should retry resolution up to maxAttempts times
// TEST: Should respect the timeout configuration
// TEST: Should fallback to cached data when resolution fails
// TEST: Should handle resolution errors gracefully
```

#### 4. Update Resolution Cache

```typescript
const updateResolutionCache = new Step({
  id: 'update-resolution-cache',
  description: 'Updates the cache with the resolved agent data',
  execute: async ({ context }) => {
    // Get resolution result from previous step
    const resolutionResult = context.getStepResult(resolveAgent);
    
    if (!resolutionResult) {
      throw new Error('Resolution result not found');
    }
    
    // Get the resolution options
    const { agentName, resolveOptions, agentCard, resolutionStatus } = resolutionResult;
    
    // Skip cache update if caching is disabled or no agent was resolved
    if (!resolveOptions.cacheResults || !agentCard) {
      return {
        agentName,
        cacheUpdateStatus: 'SKIPPED',
        reason: !resolveOptions.cacheResults 
          ? 'Caching disabled by configuration' 
          : 'No agent data to cache',
        resolutionStatus,
        agentCard,
      };
    }
    
    // Skip cache update for cached fallbacks (don't cache already cached data)
    if (resolutionStatus === 'CACHED_FALLBACK') {
      return {
        agentName,
        cacheUpdateStatus: 'SKIPPED',
        reason: 'Cannot cache a cached fallback',
        resolutionStatus,
        agentCard,
      };
    }
    
    try {
      // In a real implementation, this would update a cache system
      // Mock implementation for design purposes
      
      // Simulate cache update
      const cacheUpdateTime = new Date();
      
      // Update the cache (placeholder)
      console.log(`MOCK: Cached agent '${agentName}' at ${cacheUpdateTime.toISOString()}`);
      
      return {
        agentName,
        cacheUpdateStatus: 'UPDATED',
        reason: 'Cache updated successfully',
        cacheTime: cacheUpdateTime.toISOString(),
        resolutionStatus,
        agentCard,
      };
    } catch (error) {
      // If cache update fails, log but continue
      return {
        agentName,
        cacheUpdateStatus: 'ERROR',
        reason: `Failed to update cache: ${error.message || 'Unknown error'}`,
        resolutionStatus,
        agentCard,
      };
    }
  },
});

// TEST: Should update cache when resolution is successful
// TEST: Should skip cache update when caching is disabled
// TEST: Should skip cache update when no agent data was resolved
// TEST: Should skip cache update for cached fallbacks
// TEST: Should handle cache update errors gracefully
```

#### 5. Format Resolution Result

```typescript
const formatResolutionResult = new Step({
  id: 'format-resolution-result',
  description: 'Formats the final resolution result for the client',
  execute: async ({ context }) => {
    // Get cache update result from previous step
    const cacheUpdateResult = context.getStepResult(updateResolutionCache);
    
    if (!cacheUpdateResult) {
      throw new Error('Cache update result not found');
    }
    
    // Get the original resolution result for additional details
    const resolutionResult = context.getStepResult(resolveAgent);
    
    // Extract key information
    const { 
      agentName, 
      resolutionStatus, 
      agentCard, 
      cacheUpdateStatus,
    } = cacheUpdateResult;
    
    // Create the base response
    const response = {
      agentName,
      found: ['RESOLVED', 'CACHED', 'CACHED_FALLBACK'].includes(resolutionStatus),
      status: resolutionStatus,
      agentCard,
      metadata: {
        resolutionTime: new Date().toISOString(),
        cacheStatus: cacheUpdateStatus,
        attempts: resolutionResult?.attemptsMade || 0,
        sources: resolutionResult?.sources || [],
      },
    };
    
    // Add additional details if requested
    const resolveOptions = resolutionResult?.resolveOptions;
    if (resolveOptions?.includeDetails) {
      response.metadata = {
        ...response.metadata,
        issues: resolutionResult?.issues || [],
        options: resolveOptions,
      };
    }
    
    // Return formatted response
    return response;
  },
});

// TEST: Should correctly indicate when an agent was found
// TEST: Should include basic metadata about the resolution process
// TEST: Should include detailed information when includeDetails is true
// TEST: Should properly format agent card data
// TEST: Should handle missing resolution details gracefully
```

### Complete Workflow

```typescript
// Create the agent resolution workflow
export const agentResolutionWorkflow = new Workflow({
  name: 'agent-resolution-workflow',
  triggerSchema: agentResolutionSchema,
})
  .step(validateResolutionRequest)
  .then(checkResolutionCache)
  .then(resolveAgent)
  .then(updateResolutionCache)
  .then(formatResolutionResult);

// Commit the workflow
agentResolutionWorkflow.commit();
```

## Sequence Diagram

```
┌──────────────┐    ┌──────────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────────┐
│    Client    │    │validateResolution│    │  checkCache  │    │resolveAgent  │    │ updateCache  │    │formatResolution│
└──────┬───────┘    └────────┬─────────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └───────┬───────┘
       │                     │                     │                   │                   │                     │
       │ Resolve Agent       │                     │                   │                   │                     │
       │────────────────────>│                     │                   │                   │                     │
       │                     │                     │                   │                   │                     │
       │                     │ Validate name       │                   │                   │                     │
       │                     │ and options         │                   │                   │                     │
       │                     │────────────────────>│                   │                   │                     │
       │                     │                     │                   │                   │                     │
       │                     │                     │ Check cache       │                   │                     │
       │                     │                     │ for agent         │                   │                     │
       │                     │                     │──────────────────>│                   │                     │
       │                     │                     │                   │                   │                     │
       │                     │                     │                   │ Attempt           │                     │
       │                     │                     │                   │ resolution        │                     │
       │                     │                     │                   │──────────────────>│                     │
       │                     │                     │                   │                   │                     │
       │                     │                     │                   │                   │ Update cache        │
       │                     │                     │                   │                   │ with result         │
       │                     │                     │                   │                   │────────────────────>│
       │                     │                     │                   │                   │                     │
       │                     │                     │                   │                   │                     │ Format
       │                     │                     │                   │                   │                     │ response
       │                     │                     │                   │                   │                     │──────────┐
       │                     │                     │                   │                   │                     │          │
       │                     │                     │                   │                   │                     │<─────────┘
       │                     │                     │                   │                   │                     │
       │ Return Resolution   │                     │                   │                   │                     │
       │ Result              │                     │                   │                   │                     │
       │<────────────────────────────────────────────────────────────────────────────────────────────────────────│
       │                     │                     │                   │                   │                     │
```

## Error Handling

The workflow implements robust error handling throughout the resolution process:

1. **Validation Errors**: Issues with agent name format or invalid options are detected early.

2. **Cache Errors**: Problems with cache access are handled by proceeding to direct resolution.

3. **Resolution Failures**: The workflow implements retry logic with configurable attempts and timeouts.

4. **Fallback Mechanism**: When resolution fails but cached data exists, it can fall back to cached data.

5. **Cache Update Failures**: Issues updating the cache are logged but don't prevent returning results.

## Performance Considerations

1. **Caching**: The workflow uses caching to improve performance for frequently resolved agents.

2. **Configurable Timeouts**: Clients can specify timeouts to balance reliability with responsiveness.

3. **Early Returns**: The workflow returns cached results immediately when appropriate, avoiding unnecessary processing.

4. **Retry Logic**: Configurable retry logic allows for recovery from transient failures.

5. **Minimal Response Format**: The response is formatted to include only necessary information unless details are requested.

## Security Considerations

1. **Input Validation**: Agent names are validated to prevent injection attacks.

2. **Parameter Validation**: Resolution options are validated to prevent abuse.

3. **Response Filtering**: Detailed error information is only included when explicitly requested.

4. **Cache Control**: Clients can bypass potentially outdated cache entries when security is a concern.

5. **Audit Trail**: Resolution sources and attempts are tracked for auditing purposes.

## Implementation Guidelines

1. **Distributed Cache**: For production environments, consider using a distributed cache service.

2. **Database Optimizations**: Ensure the agent registry database is optimized for fast lookups.

3. **Rate Limiting**: Implement rate limiting to prevent abuse of the resolution service.

4. **Metrics Collection**: Add performance monitoring to identify resolution bottlenecks.

5. **Cache Eviction Policies**: Implement appropriate cache eviction policies to manage memory use.
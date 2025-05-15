/**
 * examples/utils/quiet-logging.ts
 * 
 * This utility suppresses verbose console messages for cleaner example output.
 * It replaces certain console methods temporarily and can restore them when needed.
 */

// Store original console methods
const originalConsole = {
  warn: console.warn,
  error: console.error,
  log: console.log
};

/**
 * Suppresses console warnings and errors related to Mastra and other non-critical messages
 */
export function suppressVerboseLogging() {
  // Filter warning messages
  console.warn = function(...args: any[]) {
    const message = args.join(' ');
    // Only show warnings that aren't related to fallback mechanisms
    if (!message.includes('Mastra') && 
        !message.includes('fallback') && 
        !message.includes('workflow is not available')) {
      originalConsole.warn.apply(console, args);
    }
  };
  
  // Filter error messages
  console.error = function(...args: any[]) {
    const message = args.join(' ');
    // Filter out non-critical error messages
    if (!message.includes('Mastra') && 
        !message.includes('import failed') && 
        !message.includes('Cannot find module')) {
      originalConsole.error.apply(console, args);
    }
  };
  
  // Filter log messages
  console.log = function(...args: any[]) {
    const message = typeof args[0] === 'string' ? args[0] : args.join(' ');
    
    // Filter out specific verbose log messages
    if (!message.includes('[MOCK]') &&
        !message.includes('Securely storing private key') &&
        !message.includes('Fallback analysis completed') &&
        !message.includes('[SECURITY EVENT]') &&
        !message.includes('THREAT_DETECTED') &&
        !message.includes('SUSPICIOUS_QUERY') &&
        !message.includes('WARNING: Agent registration succeeded') &&
        !message.includes('Agent name cannot start with')) {
      originalConsole.log.apply(console, args);
    }
  };
}

/**
 * Restores console methods to their original behavior
 */
export function restoreConsoleLogging() {
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.log = originalConsole.log;
}
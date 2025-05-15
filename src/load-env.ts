/**
 * src/load-env.ts
 * A simple utility to load environment variables from .env file
 */

import fs from 'fs';
import path from 'path';

/**
 * Loads environment variables from a .env file at the root of the project
 */
export function loadEnvFile() {
  try {
    // Read the .env file from the project root
    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) {
      console.warn('No .env file found at project root. Using existing environment variables.');
      return;
    }

    const envContent = fs.readFileSync(envPath, 'utf-8');
    const envVars = parseEnv(envContent);

    // Set environment variables that aren't already set
    Object.keys(envVars).forEach(key => {
      if (!process.env[key]) {
        process.env[key] = envVars[key];
      }
    });

    console.log('Environment variables loaded from .env file');
  } catch (error) {
    console.error('Error loading .env file:', error);
  }
}

/**
 * Parses environment variables from a string
 * @param content Environment file content
 * @returns Object with key-value pairs
 */
function parseEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  
  // Split into lines and process each line
  const lines = content.split('\n');
  
  for (const line of lines) {
    // Skip empty lines and comments
    if (!line || line.trim().startsWith('#')) {
      continue;
    }
    
    // Split by the first equals sign
    const equalsIndex = line.indexOf('=');
    if (equalsIndex !== -1) {
      const key = line.substring(0, equalsIndex).trim();
      let value = line.substring(equalsIndex + 1).trim();
      
      // Remove quotes if they wrap the entire value
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.substring(1, value.length - 1);
      }
      
      result[key] = value;
    }
  }
  
  return result;
}

// Auto-load if this file is imported directly
loadEnvFile();
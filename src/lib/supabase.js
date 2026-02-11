/**
 * Supabase Client Configuration — YATRA 2026
 * 
 * Initializes the Supabase client for database operations.
 * All ticket verification calls go through this client.
 */

import { createClient } from '@supabase/supabase-js';

// Read from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY)?.trim();

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('   Required: VITE_SUPABASE_URL and either VITE_SUPABASE_ANON_KEY or VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY');
  throw new Error('Missing required Supabase environment variables. Check your .env file.');
}

// Create client
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/**
 * Get gate type from environment
 * @returns {string} "CONFERENCE" or "EVENT_<event_id>"
 */
export function getGateType() {
  const gateType = import.meta.env.VITE_GATE_TYPE?.trim();
  if (!gateType) {
    return 'CONFERENCE'; // Default to conference gate
  }
  // Validate format
  if (gateType !== 'CONFERENCE' && !gateType.startsWith('EVENT_')) {
    console.warn(`⚠️ Invalid VITE_GATE_TYPE: "${gateType}". Must be "CONFERENCE" or "EVENT_<id>". Defaulting to CONFERENCE.`);
    return 'CONFERENCE';
  }
  return gateType;
}

/**
 * Get scanner device name from environment
 * @returns {string}
 */
export function getScannerDevice() {
  return import.meta.env.VITE_SCANNER_DEVICE?.trim() || 'Scanner-1';
}

/**
 * Get gate password from environment
 * @returns {string}
 */
export function getGatePassword() {
  const password = import.meta.env.VITE_GATE_PASSWORD;
  if (!password) {
    console.warn('⚠️ VITE_GATE_PASSWORD not set. Using default "demo123"');
    return 'demo123';
  }
  return password;
}

/**
 * Get admin PIN from environment
 * @returns {string}
 */
export function getAdminPin() {
  const pin = import.meta.env.VITE_ADMIN_PIN;
  if (!pin) {
    console.warn('⚠️ VITE_ADMIN_PIN not set. Using default "9999"');
    return '9999';
  }
  return pin;
}

/**
 * Ticket Verification Logic
 * 
 * This module handles all ticket verification operations.
 * 
 * CRITICAL: The actual atomic verification happens in the Postgres function
 * `verify_and_mark_ticket`. This ensures that even if two volunteers scan
 * the same ticket at the exact same moment, only ONE will succeed.
 * 
 * The row-level lock (FOR UPDATE) in the SQL function prevents race conditions.
 */

import { supabase } from './supabase';

/**
 * Result codes for ticket verification
 */
export const VerificationResult = {
  VALID: 'VALID',           // Entry allowed
  ALREADY_USED: 'ALREADY_USED', // Ticket already scanned (within 14-hour cooldown)
  INVALID_TICKET: 'INVALID_TICKET', // Ticket not found
  ERROR: 'ERROR',           // System error
};

/**
 * Verify a ticket by UUID (from QR code)
 * 
 * Single ticket type valid for both days.
 * Auto-refreshes after 14 hours (12-16 hour range midpoint).
 * 
 * @param {string} ticketId - UUID from QR code
 * @param {number} currentDay - Optional day parameter (kept for compatibility, not used in verification)
 * @returns {Promise<{
 *   allowed: boolean,
 *   reason: string,
 *   message: string,
 *   ticketType?: string,
 *   name?: string
 * }>}
 */
export async function verifyTicketById(ticketId, currentDay) {
  try {
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(ticketId)) {
      return {
        allowed: false,
        reason: VerificationResult.INVALID_TICKET,
        message: 'Invalid QR code format',
      };
    }

    // Call the atomic verification function from Supabase
    // This function checks ticket_status and updates it if valid
    // Note: The database function should check ticket_status and set it to 'used' when verified
    const { data, error } = await supabase.rpc('verify_and_mark_ticket', {
      p_ticket_id: ticketId,
    });

    if (error) {
      console.error('Verification error:', error);
      return {
        allowed: false,
        reason: VerificationResult.ERROR,
        message: 'Verification failed. Please try again.',
      };
    }

    // Return the result from the database function
    // data.allowed = true if ticket is valid (ticket_status = 'valid')
    // data.allowed = false if ticket is already used (ticket_status = 'used')
    return {
      allowed: data.allowed || false,
      reason: data.reason || VerificationResult.ERROR,
      message: data.message || 'Verification failed',
      name: data.name,
    };
  } catch (err) {
    console.error('Unexpected error:', err);
    return {
      allowed: false,
      reason: VerificationResult.ERROR,
      message: 'Connection error. Check your network.',
    };
  }
}

/**
 * Verify a ticket by 6-digit code (manual entry)
 * 
 * Single ticket type valid for both days.
 * Auto-refreshes after 14 hours (12-16 hour range midpoint).
 * 
 * @param {string} code - 6-digit code
 * @param {number} currentDay - Optional day parameter (kept for compatibility, not used in verification)
 * @returns {Promise<{
 *   allowed: boolean,
 *   reason: string,
 *   message: string,
 *   ticketType?: string,
 *   name?: string
 * }>}
 */
export async function verifyTicketByCode(code, currentDay) {
  try {
    // Validate code format - must be exactly 6 digits
    if (!/^\d{6}$/.test(code)) {
      return {
        allowed: false,
        reason: VerificationResult.INVALID_TICKET,
        message: 'Code must be 6 digits',
      };
    }

    // Look up ticket by 6-digit code in the tickets table
    // Try code_6_digit first (actual database column), then fallback to six_digit_code
    let ticketData, lookupError, ticketId;
    
    // First try with code_6_digit (actual database column)
    const query1 = supabase
      .from('tickets')
      .select('id')
      .eq('code_6_digit', code)
      .single();
    
    const result1 = await query1;
    ticketData = result1.data;
    lookupError = result1.error;
    ticketId = ticketData?.id;

    // If error suggests column doesn't exist, try with six_digit_code
    if (lookupError && (lookupError.message?.includes('column') || lookupError.message?.includes('does not exist'))) {
      console.log('⚠️ [verifyTicketByCode] Trying with six_digit_code...');
      const query2 = supabase
        .from('tickets')
        .select('id')
        .eq('six_digit_code', code)
        .single();
      
      const result2 = await query2;
      ticketData = result2.data;
      lookupError = result2.error;
      ticketId = ticketData?.id;
    }

    if (lookupError) {
      console.error('Lookup error:', lookupError);
      return {
        allowed: false,
        reason: VerificationResult.ERROR,
        message: 'Lookup failed. Please try again.',
      };
    }

    // If no ticket found, return invalid
    if (!ticketId) {
      return {
        allowed: false,
        reason: VerificationResult.INVALID_TICKET,
        message: 'Invalid code - ticket not found',
      };
    }

    // Now verify the ticket using its UUID
    // This will check ticket_status and update it if valid
    return verifyTicketById(ticketId, currentDay);
  } catch (err) {
    console.error('Unexpected error:', err);
    return {
      allowed: false,
      reason: VerificationResult.ERROR,
      message: 'Connection error. Check your network.',
    };
  }
}

/**
 * Search tickets by email or code (for fallback verification)
 * 
 * @param {string} query - Search query (email or code)
 * @returns {Promise<Array<{
 *   id: string,
 *   six_digit_code: string,
 *   email: string,
 *   name: string,
 *   college: string,
 *   ticket_status: string
 * }>>}
 */
export async function searchTickets(query) {
  try {
    if (!query || query.length < 3) {
      return [];
    }

    const searchQuery = query.trim();
    console.log('🔍 [searchTickets] Searching for:', searchQuery);

    // Use direct query to match actual database schema
    // Try different column combinations based on what exists in the database
    let data, error;
    
    // First try with six_digit_code (new schema) - without registration_id
    const query1 = supabase
      .from('tickets')
      .select('id, email, name, college, six_digit_code, ticket_status')
      .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,six_digit_code.eq.${searchQuery},college.ilike.%${searchQuery}%`)
      .limit(20);
    
    const result1 = await query1;
    data = result1.data;
    error = result1.error;

    // If error suggests column doesn't exist, try with code_6_digit (old schema)
    if (error && (error.message?.includes('column') || error.message?.includes('does not exist'))) {
      console.log('⚠️ [searchTickets] Trying with code_6_digit (old schema)...');
      const query2 = supabase
        .from('tickets')
        .select('id, email, name, college, code_6_digit, ticket_status')
        .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,code_6_digit.eq.${searchQuery},college.ilike.%${searchQuery}%`)
        .limit(20);
      
      const result2 = await query2;
      data = result2.data;
      error = result2.error;
      
      // Map code_6_digit to six_digit_code for consistency
      if (data) {
        data = data.map(ticket => ({
          ...ticket,
          six_digit_code: ticket.code_6_digit || ticket.six_digit_code
        }));
      }
    }

    console.log('🔍 [searchTickets] Query result:', { 
      data, 
      error, 
      dataLength: data?.length,
      query: searchQuery,
      errorMessage: error?.message 
    });

    if (error) {
      console.error('❌ [searchTickets] Query Error:', error);
      console.error('❌ [searchTickets] Error details:', JSON.stringify(error, null, 2));
      
      // If it's an RLS error, provide helpful message
      if (error.message?.includes('row-level security') || error.message?.includes('policy')) {
        console.error('🚨 [searchTickets] RLS Policy Error - Need to allow anon SELECT on tickets table');
      }
      
      return [];
    }

    console.log('✅ [searchTickets] Found tickets:', data?.length || 0);
    if (data && data.length > 0) {
      console.log('✅ [searchTickets] First result:', data[0]);
    }
    return data || [];
  } catch (err) {
    console.error('❌ [searchTickets] Unexpected error:', err);
    console.error('❌ [searchTickets] Error stack:', err.stack);
    return [];
  }
}

/**
 * Get ticket status without marking as used (for display only)
 * 
 * @param {string} ticketId - UUID of ticket
 * @returns {Promise<{
 *   found: boolean,
 *   ticket?: object
 * }>}
 */
export async function getTicketStatus(ticketId) {
  try {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (error || !data) {
      return { found: false };
    }

    return { found: true, ticket: data };
  } catch (err) {
    console.error('Status lookup error:', err);
    return { found: false };
  }
}

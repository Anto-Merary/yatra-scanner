/**
 * Ticket Verification Logic — YATRA 2026
 * 
 * Uses the `validate_scan` PostgreSQL RPC function for all verification.
 * This function implements a 7-step validation pipeline:
 *   1. Lookup ticket by qr_token
 *   2. Anti-abuse (5s replay guard)
 *   3. Status check (active/revoked)
 *   4. Day validity check
 *   5. Time restriction (Cat 3/4 → after 3PM only)
 *   6. Gate validity (CONFERENCE vs EVENT_<id>)
 *   7. Usage check + mark used
 *
 * The RPC is SECURITY DEFINER so it bypasses RLS.
 */

import { supabase } from './supabase';

/**
 * All possible result codes from the validate_scan RPC
 */
export const ResultCodes = {
  VALID: 'VALID',
  TICKET_NOT_FOUND: 'TICKET_NOT_FOUND',
  TICKET_REVOKED: 'TICKET_REVOKED',
  INVALID_DAY: 'INVALID_DAY',
  TOO_EARLY_ENTRY: 'TOO_EARLY_ENTRY',
  WRONG_GATE: 'WRONG_GATE',
  EVENT_ONLY_TICKET: 'EVENT_ONLY_TICKET',
  ALREADY_USED_TODAY: 'ALREADY_USED_TODAY',
  REPLAY_ATTACK: 'REPLAY_ATTACK',
  ERROR: 'ERROR',
};

/**
 * Human-readable display text for each result code
 */
export const ResultDisplayText = {
  VALID: 'ENTRY ALLOWED',
  TICKET_NOT_FOUND: 'INVALID TICKET',
  TICKET_REVOKED: 'TICKET REVOKED',
  INVALID_DAY: 'WRONG DAY',
  TOO_EARLY_ENTRY: 'TOO EARLY',
  WRONG_GATE: 'WRONG GATE',
  EVENT_ONLY_TICKET: 'EVENT GATE ONLY',
  ALREADY_USED_TODAY: 'ALREADY USED',
  REPLAY_ATTACK: 'DUPLICATE SCAN',
  ERROR: 'SYSTEM ERROR',
};

/**
 * Category display names
 */
export const CategoryNames = {
  1: 'Institution Pass',
  2: 'Event Ticket',
  3: 'General (1-Day)',
  4: 'General Combo',
};

/**
 * Verify a ticket by QR token (from QR code scan)
 * 
 * The QR code contains a qr_token string: "{UUID}.{HMAC_hex}"
 * This is passed directly to the validate_scan RPC.
 * 
 * @param {string} qrToken - The raw string decoded from QR code
 * @param {string} gateType - Gate type: "CONFERENCE" or "EVENT_<event_id>"
 * @param {string} scannerDevice - Device identifier for audit trail
 * @returns {Promise<object>} Validation result
 */
export async function verifyTicketByQRToken(qrToken, gateType, scannerDevice) {
  try {
    if (!qrToken || typeof qrToken !== 'string' || qrToken.trim().length < 5) {
      return {
        success: false,
        allowed: false,
        reason: ResultCodes.TICKET_NOT_FOUND,
        message: 'Invalid QR code format',
      };
    }

    const { data, error } = await supabase.rpc('validate_scan', {
      p_qr_token: qrToken.trim(),
      p_gate_type: gateType,
      p_scanner_device: scannerDevice || null,
    });

    if (error) {
      console.error('validate_scan RPC error:', error);
      return {
        success: false,
        allowed: false,
        reason: ResultCodes.ERROR,
        message: 'Verification failed. Please try again.',
      };
    }

    // data is already the JSONB result from the RPC
    return data;
  } catch (err) {
    console.error('Unexpected error:', err);
    return {
      success: false,
      allowed: false,
      reason: ResultCodes.ERROR,
      message: 'Connection error. Check your network.',
    };
  }
}

/**
 * Verify a ticket by 6-digit code (manual entry)
 * 
 * Looks up the ticket by code_6_digit, retrieves its qr_token,
 * then runs validate_scan with that token.
 * 
 * @param {string} code - 6-digit code
 * @param {string} gateType - Gate type
 * @param {string} scannerDevice - Device identifier
 * @returns {Promise<object>} Validation result
 */
export async function verifyTicketByCode(code, gateType, scannerDevice) {
  try {
    // Validate code format
    if (!/^\d{6}$/.test(code)) {
      return {
        success: false,
        allowed: false,
        reason: ResultCodes.TICKET_NOT_FOUND,
        message: 'Code must be 6 digits',
      };
    }

    // Look up ticket by 6-digit code to get the qr_token
    const { data: ticket, error: lookupError } = await supabase
      .from('tickets')
      .select('qr_token, id')
      .eq('code_6_digit', code)
      .single();

    if (lookupError || !ticket) {
      return {
        success: false,
        allowed: false,
        reason: ResultCodes.TICKET_NOT_FOUND,
        message: 'Invalid code — ticket not found',
      };
    }

    // If ticket has a qr_token, use validate_scan
    if (ticket.qr_token) {
      return verifyTicketByQRToken(ticket.qr_token, gateType, scannerDevice);
    }

    // Fallback: ticket exists but no qr_token (legacy ticket without HMAC token)
    // This shouldn't happen for properly issued tickets, but handle gracefully
    return {
      success: false,
      allowed: false,
      reason: ResultCodes.ERROR,
      message: 'Ticket has no QR token. Please contact admin.',
    };
  } catch (err) {
    console.error('Unexpected error:', err);
    return {
      success: false,
      allowed: false,
      reason: ResultCodes.ERROR,
      message: 'Connection error. Check your network.',
    };
  }
}

/**
 * Search tickets by name, email, code, or college
 * 
 * @param {string} query - Search query (min 3 chars)
 * @returns {Promise<Array>} Array of ticket objects
 */
export async function searchTickets(query) {
  try {
    if (!query || query.length < 3) {
      return [];
    }

    const searchQuery = query.trim();

    const { data, error } = await supabase
      .from('tickets')
      .select('id, email, name, college, phone, code_6_digit, qr_token, status, category, event_id, valid_days, usage_day1, usage_day2, usage_event, ticket_type, is_rit_student, last_used_at')
      .or(`name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,code_6_digit.eq.${searchQuery},college.ilike.%${searchQuery}%`)
      .limit(20);

    if (error) {
      console.error('Search error:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Search unexpected error:', err);
    return [];
  }
}

/**
 * Get ticket status without marking as used (display only)
 * 
 * @param {string} ticketId - UUID of ticket
 * @returns {Promise<{found: boolean, ticket?: object}>}
 */
export async function getTicketStatus(ticketId) {
  try {
    const { data, error } = await supabase
      .from('tickets')
      .select('id, name, email, college, phone, code_6_digit, status, category, event_id, valid_days, usage_day1, usage_day2, usage_event, ticket_type, is_rit_student, last_used_at, qr_token')
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

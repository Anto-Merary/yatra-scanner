/**
 * Admin Override Service — YATRA 2026
 * 
 * Handles admin-only operations:
 * - Force allow entry (with day selection)
 * - Reset entry (with day selection)
 * - Override logging
 * 
 * p_day values:
 *   0 = Reset ALL (day1 + day2 + event)
 *   1 = Day 1 / Event (depending on category)
 *   2 = Day 2 / Event (depending on category)
 */

import { supabase } from './supabase';

/**
 * Admin action to force allow entry for a ticket
 * 
 * @param {string} ticketId - UUID of ticket
 * @param {number} day - Day to force: 1 or 2
 * @param {string} reason - Admin's reason for override
 * @param {string} adminIdentifier - Admin name/ID for audit
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function adminForceAllow(ticketId, day, reason, adminIdentifier) {
  try {
    if (!reason || reason.trim().length < 10) {
      return {
        success: false,
        message: 'Reason must be at least 10 characters'
      };
    }

    const { data, error } = await supabase.rpc('admin_force_allow', {
      p_ticket_id: ticketId,
      p_day: day || 1,
      p_reason: reason.trim(),
      p_admin_identifier: adminIdentifier.trim()
    });

    if (error) {
      console.error('Admin force allow error:', error);
      return {
        success: false,
        message: 'Override failed. Check connection.'
      };
    }

    return data;
  } catch (err) {
    console.error('Unexpected error:', err);
    return {
      success: false,
      message: 'System error during override'
    };
  }
}

/**
 * Admin action to reset entry for a ticket
 * 
 * @param {string} ticketId - UUID of ticket
 * @param {number} day - Day to reset: 0 (all), 1, or 2
 * @param {string} reason - Admin's reason for reset
 * @param {string} adminIdentifier - Admin name/ID for audit
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function adminResetEntry(ticketId, day, reason, adminIdentifier) {
  try {
    if (!reason || reason.trim().length < 10) {
      return {
        success: false,
        message: 'Reason must be at least 10 characters'
      };
    }

    const { data, error } = await supabase.rpc('admin_reset_entry', {
      p_ticket_id: ticketId,
      p_day: typeof day === 'number' ? day : 0,
      p_reason: reason.trim(),
      p_admin_identifier: adminIdentifier.trim()
    });

    if (error) {
      console.error('Admin reset entry error:', error);
      return {
        success: false,
        message: 'Reset failed. Check connection.'
      };
    }

    return data;
  } catch (err) {
    console.error('Unexpected error:', err);
    return {
      success: false,
      message: 'System error during reset'
    };
  }
}

/**
 * Get override logs for a specific ticket
 * 
 * @param {string} ticketId - UUID of ticket
 * @returns {Promise<Array>}
 */
export async function getOverrideLogs(ticketId) {
  try {
    const { data, error } = await supabase.rpc('get_ticket_override_logs', {
      p_ticket_id: ticketId
    });

    if (error) {
      console.error('Get override logs error:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Unexpected error:', err);
    return [];
  }
}

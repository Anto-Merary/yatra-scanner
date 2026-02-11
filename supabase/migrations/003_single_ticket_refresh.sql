-- ============================================
-- Migration: Single Ticket with Auto-Refresh
-- ============================================
-- Changes:
-- 1. Remove DAY1/DAY2 ticket types - only SINGLE type
-- 2. Remove day1_used/day2_used columns
-- 3. Add last_used_at timestamp for auto-refresh logic
-- 4. Tickets refresh after 14 hours (12-16 hour range midpoint)
-- ============================================

-- Step 1: Add last_used_at column (nullable, for tickets never used)
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

-- Step 2: Migrate existing data (set last_used_at based on day1_used/day2_used)
-- If either day was used, set last_used_at to updated_at (approximate)
UPDATE tickets 
SET last_used_at = updated_at 
WHERE (day1_used = TRUE OR day2_used = TRUE) 
  AND last_used_at IS NULL;

-- Step 3: Drop old columns (in reverse order to avoid constraint issues)
ALTER TABLE tickets DROP COLUMN IF EXISTS day2_used;
ALTER TABLE tickets DROP COLUMN IF EXISTS day1_used;

-- Step 4: Update ticket_type constraint to only allow 'SINGLE'
-- First, update existing ticket types to 'SINGLE'
UPDATE tickets SET ticket_type = 'SINGLE' WHERE ticket_type IN ('DAY1', 'DAY2', 'COMBO');

-- Drop the old constraint
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_ticket_type_check;

-- Add new constraint
ALTER TABLE tickets 
ADD CONSTRAINT tickets_ticket_type_check 
CHECK (ticket_type = 'SINGLE');

-- ============================================
-- Updated: Atomic Ticket Verification Function
-- ============================================
-- Single ticket type valid for both days
-- Auto-refreshes after 14 hours (12-16 hour range midpoint)
-- ============================================

CREATE OR REPLACE FUNCTION verify_and_mark_ticket(
    p_ticket_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_ticket RECORD;
    v_hours_since_use NUMERIC;
BEGIN
    -- Lock the row FOR UPDATE to prevent concurrent modifications
    SELECT * INTO v_ticket
    FROM tickets
    WHERE id = p_ticket_id
    FOR UPDATE;

    -- Ticket not found
    IF v_ticket IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'allowed', false,
            'reason', 'INVALID_TICKET',
            'message', 'Ticket not found'
        );
    END IF;

    -- Check if ticket was used within the last 14 hours
    -- If last_used_at is NULL, ticket has never been used (allow)
    IF v_ticket.last_used_at IS NOT NULL THEN
        -- Calculate hours since last use
        v_hours_since_use := EXTRACT(EPOCH FROM (NOW() - v_ticket.last_used_at)) / 3600;
        
        -- If used within last 14 hours, reject
        IF v_hours_since_use < 14 THEN
            RETURN jsonb_build_object(
                'success', true,
                'allowed', false,
                'reason', 'ALREADY_USED',
                'message', 'Ticket was recently used. Please wait before reusing.',
                'ticket_type', v_ticket.ticket_type,
                'name', v_ticket.name
            );
        END IF;
    END IF;

    -- Ticket is valid - mark as used (update last_used_at)
    UPDATE tickets 
    SET last_used_at = NOW(), updated_at = NOW() 
    WHERE id = p_ticket_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'allowed', true,
        'reason', 'VALID',
        'message', 'Entry allowed',
        'ticket_type', v_ticket.ticket_type,
        'name', v_ticket.name
    );
END;
$$;

-- ============================================
-- Updated: Function to search tickets
-- ============================================
CREATE OR REPLACE FUNCTION search_tickets(p_query VARCHAR(255))
RETURNS TABLE (
    id UUID,
    code_6_digit VARCHAR(6),
    email VARCHAR(255),
    name VARCHAR(255),
    ticket_type VARCHAR(10),
    last_used_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.code_6_digit, t.email, t.name, t.ticket_type, t.last_used_at
    FROM tickets t
    WHERE t.code_6_digit = p_query
       OR t.email ILIKE '%' || p_query || '%'
       OR t.name ILIKE '%' || p_query || '%'
    LIMIT 20;
END;
$$;

-- ============================================
-- Updated: Admin Override Functions
-- ============================================

-- Update override_logs table to remove day constraint
ALTER TABLE override_logs DROP CONSTRAINT IF EXISTS override_logs_day_check;

-- Update admin_force_allow function
CREATE OR REPLACE FUNCTION admin_force_allow(
    p_ticket_id UUID,
    p_reason TEXT,
    p_admin_identifier TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_ticket RECORD;
BEGIN
    -- Lock the row to prevent concurrent modifications
    SELECT * INTO v_ticket
    FROM tickets
    WHERE id = p_ticket_id
    FOR UPDATE;

    -- Ticket not found
    IF v_ticket IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Ticket not found'
        );
    END IF;

    -- Mark as used (set last_used_at to now)
    UPDATE tickets SET last_used_at = NOW(), updated_at = NOW() WHERE id = p_ticket_id;

    -- Log the override action (day is now just a text field for historical reference)
    INSERT INTO override_logs (ticket_id, admin_action, day, reason, admin_identifier)
    VALUES (p_ticket_id, 'ALLOW', 'SINGLE', p_reason, p_admin_identifier);

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Entry forced successfully',
        'ticket_code', v_ticket.code_6_digit,
        'name', v_ticket.name
    );
END;
$$;

-- Update admin_reset_entry function
CREATE OR REPLACE FUNCTION admin_reset_entry(
    p_ticket_id UUID,
    p_reason TEXT,
    p_admin_identifier TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_ticket RECORD;
BEGIN
    -- Lock the row to prevent concurrent modifications
    SELECT * INTO v_ticket
    FROM tickets
    WHERE id = p_ticket_id
    FOR UPDATE;

    -- Ticket not found
    IF v_ticket IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Ticket not found'
        );
    END IF;

    -- Reset usage (set last_used_at to NULL)
    UPDATE tickets SET last_used_at = NULL, updated_at = NOW() WHERE id = p_ticket_id;

    -- Log the override action
    INSERT INTO override_logs (ticket_id, admin_action, day, reason, admin_identifier)
    VALUES (p_ticket_id, 'RESET', 'SINGLE', p_reason, p_admin_identifier);

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Entry reset successfully',
        'ticket_code', v_ticket.code_6_digit,
        'name', v_ticket.name
    );
END;
$$;

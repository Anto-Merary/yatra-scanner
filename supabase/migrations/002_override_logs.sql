-- ============================================
-- YATRA Scanner - Override Logging System
-- ============================================

-- Create override logs table
CREATE TABLE IF NOT EXISTS override_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id),
    admin_action VARCHAR(20) NOT NULL CHECK (admin_action IN ('ALLOW', 'RESET')),
    day VARCHAR(10) NOT NULL CHECK (day IN ('DAY1', 'DAY2')),
    reason TEXT NOT NULL,
    admin_identifier TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_override_logs_ticket_id ON override_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_override_logs_created_at ON override_logs(created_at DESC);

-- ============================================
-- ADMIN OVERRIDE: Force Allow Entry
-- ============================================
-- This function allows admin to manually mark a ticket as used
-- Used when: legitimate attendee but system issue occurred
-- ============================================
CREATE OR REPLACE FUNCTION admin_force_allow(
    p_ticket_id UUID,
    p_day INTEGER,
    p_reason TEXT,
    p_admin_identifier TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_ticket RECORD;
    v_day_column TEXT;
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

    -- Determine which day column to update
    IF p_day = 1 THEN
        -- Mark Day 1 as used
        UPDATE tickets SET day1_used = TRUE, updated_at = NOW() WHERE id = p_ticket_id;
        v_day_column := 'DAY1';
    ELSIF p_day = 2 THEN
        -- Mark Day 2 as used
        UPDATE tickets SET day2_used = TRUE, updated_at = NOW() WHERE id = p_ticket_id;
        v_day_column := 'DAY2';
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Invalid day parameter'
        );
    END IF;

    -- Log the override action
    INSERT INTO override_logs (ticket_id, admin_action, day, reason, admin_identifier)
    VALUES (p_ticket_id, 'ALLOW', v_day_column, p_reason, p_admin_identifier);

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Entry forced successfully',
        'ticket_code', v_ticket.code_6_digit,
        'name', v_ticket.name
    );
END;
$$;

-- ============================================
-- ADMIN OVERRIDE: Reset Entry
-- ============================================
-- This function allows admin to manually reset a ticket usage
-- Used when: wrong ticket scanned, system error, need to undo
-- ============================================
CREATE OR REPLACE FUNCTION admin_reset_entry(
    p_ticket_id UUID,
    p_day INTEGER,
    p_reason TEXT,
    p_admin_identifier TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_ticket RECORD;
    v_day_column TEXT;
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

    -- Determine which day column to update
    IF p_day = 1 THEN
        -- Reset Day 1
        UPDATE tickets SET day1_used = FALSE, updated_at = NOW() WHERE id = p_ticket_id;
        v_day_column := 'DAY1';
    ELSIF p_day = 2 THEN
        -- Reset Day 2
        UPDATE tickets SET day2_used = FALSE, updated_at = NOW() WHERE id = p_ticket_id;
        v_day_column := 'DAY2';
    ELSE
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Invalid day parameter'
        );
    END IF;

    -- Log the override action
    INSERT INTO override_logs (ticket_id, admin_action, day, reason, admin_identifier)
    VALUES (p_ticket_id, 'RESET', v_day_column, p_reason, p_admin_identifier);

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Entry reset successfully',
        'ticket_code', v_ticket.code_6_digit,
        'name', v_ticket.name
    );
END;
$$;

-- ============================================
-- Get Override Logs for a Ticket
-- ============================================
CREATE OR REPLACE FUNCTION get_ticket_override_logs(p_ticket_id UUID)
RETURNS TABLE (
    id UUID,
    admin_action VARCHAR(20),
    day VARCHAR(10),
    reason TEXT,
    admin_identifier TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT ol.id, ol.admin_action, ol.day, ol.reason, ol.admin_identifier, ol.created_at
    FROM override_logs ol
    WHERE ol.ticket_id = p_ticket_id
    ORDER BY ol.created_at DESC;
END;
$$;

-- Grant permissions to anon role
GRANT EXECUTE ON FUNCTION admin_force_allow(UUID, INTEGER, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION admin_reset_entry(UUID, INTEGER, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_ticket_override_logs(UUID) TO anon;

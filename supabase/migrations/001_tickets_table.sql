-- ============================================
-- YATRA Event Entry Scanner - Database Schema
-- ============================================

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code_6_digit VARCHAR(6) UNIQUE NOT NULL,
    email VARCHAR(255),
    name VARCHAR(255),
    ticket_type VARCHAR(10) NOT NULL CHECK (ticket_type IN ('DAY1', 'DAY2', 'COMBO')),
    day1_used BOOLEAN DEFAULT FALSE,
    day2_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_tickets_code ON tickets(code_6_digit);
CREATE INDEX IF NOT EXISTS idx_tickets_email ON tickets(email);

-- ============================================
-- CRITICAL: Atomic Ticket Verification Function
-- ============================================
-- This function ensures ATOMIC verification:
-- 1. Locks the row to prevent race conditions
-- 2. Checks ticket validity
-- 3. Marks as used in single transaction
-- Two scans at the same time → only one succeeds
-- ============================================

CREATE OR REPLACE FUNCTION verify_and_mark_ticket(
    p_ticket_id UUID,
    p_current_day INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_ticket RECORD;
    v_result JSONB;
BEGIN
    -- Lock the row FOR UPDATE to prevent concurrent modifications
    -- This is the KEY to atomic verification
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

    -- Check ticket type and day validity
    IF v_ticket.ticket_type = 'DAY1' THEN
        IF p_current_day != 1 THEN
            RETURN jsonb_build_object(
                'success', true,
                'allowed', false,
                'reason', 'WRONG_DAY',
                'message', 'DAY1 ticket not valid on Day 2',
                'ticket_type', v_ticket.ticket_type,
                'name', v_ticket.name
            );
        END IF;
        
        IF v_ticket.day1_used THEN
            RETURN jsonb_build_object(
                'success', true,
                'allowed', false,
                'reason', 'ALREADY_USED',
                'message', 'Ticket already used on Day 1',
                'ticket_type', v_ticket.ticket_type,
                'name', v_ticket.name
            );
        END IF;

        -- Mark as used
        UPDATE tickets SET day1_used = TRUE, updated_at = NOW() WHERE id = p_ticket_id;
        
        RETURN jsonb_build_object(
            'success', true,
            'allowed', true,
            'reason', 'VALID',
            'message', 'Entry allowed',
            'ticket_type', v_ticket.ticket_type,
            'name', v_ticket.name
        );

    ELSIF v_ticket.ticket_type = 'DAY2' THEN
        IF p_current_day != 2 THEN
            RETURN jsonb_build_object(
                'success', true,
                'allowed', false,
                'reason', 'WRONG_DAY',
                'message', 'DAY2 ticket not valid on Day 1',
                'ticket_type', v_ticket.ticket_type,
                'name', v_ticket.name
            );
        END IF;
        
        IF v_ticket.day2_used THEN
            RETURN jsonb_build_object(
                'success', true,
                'allowed', false,
                'reason', 'ALREADY_USED',
                'message', 'Ticket already used on Day 2',
                'ticket_type', v_ticket.ticket_type,
                'name', v_ticket.name
            );
        END IF;

        -- Mark as used
        UPDATE tickets SET day2_used = TRUE, updated_at = NOW() WHERE id = p_ticket_id;
        
        RETURN jsonb_build_object(
            'success', true,
            'allowed', true,
            'reason', 'VALID',
            'message', 'Entry allowed',
            'ticket_type', v_ticket.ticket_type,
            'name', v_ticket.name
        );

    ELSIF v_ticket.ticket_type = 'COMBO' THEN
        IF p_current_day = 1 THEN
            IF v_ticket.day1_used THEN
                RETURN jsonb_build_object(
                    'success', true,
                    'allowed', false,
                    'reason', 'ALREADY_USED',
                    'message', 'COMBO ticket already used on Day 1',
                    'ticket_type', v_ticket.ticket_type,
                    'name', v_ticket.name,
                    'day1_used', v_ticket.day1_used,
                    'day2_used', v_ticket.day2_used
                );
            END IF;

            -- Mark Day 1 as used
            UPDATE tickets SET day1_used = TRUE, updated_at = NOW() WHERE id = p_ticket_id;
            
            RETURN jsonb_build_object(
                'success', true,
                'allowed', true,
                'reason', 'VALID',
                'message', 'Entry allowed (Day 1)',
                'ticket_type', v_ticket.ticket_type,
                'name', v_ticket.name
            );
        ELSE
            IF v_ticket.day2_used THEN
                RETURN jsonb_build_object(
                    'success', true,
                    'allowed', false,
                    'reason', 'ALREADY_USED',
                    'message', 'COMBO ticket already used on Day 2',
                    'ticket_type', v_ticket.ticket_type,
                    'name', v_ticket.name,
                    'day1_used', v_ticket.day1_used,
                    'day2_used', v_ticket.day2_used
                );
            END IF;

            -- Mark Day 2 as used
            UPDATE tickets SET day2_used = TRUE, updated_at = NOW() WHERE id = p_ticket_id;
            
            RETURN jsonb_build_object(
                'success', true,
                'allowed', true,
                'reason', 'VALID',
                'message', 'Entry allowed (Day 2)',
                'ticket_type', v_ticket.ticket_type,
                'name', v_ticket.name
            );
        END IF;
    END IF;

    -- Unknown ticket type
    RETURN jsonb_build_object(
        'success', false,
        'allowed', false,
        'reason', 'INVALID_TYPE',
        'message', 'Unknown ticket type'
    );
END;
$$;

-- ============================================
-- Function to lookup ticket by 6-digit code
-- ============================================
CREATE OR REPLACE FUNCTION get_ticket_by_code(p_code VARCHAR(6))
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_ticket_id UUID;
BEGIN
    SELECT id INTO v_ticket_id FROM tickets WHERE code_6_digit = p_code;
    RETURN v_ticket_id;
END;
$$;

-- ============================================
-- Function to search tickets (for fallback)
-- ============================================
CREATE OR REPLACE FUNCTION search_tickets(p_query VARCHAR(255))
RETURNS TABLE (
    id UUID,
    code_6_digit VARCHAR(6),
    email VARCHAR(255),
    name VARCHAR(255),
    ticket_type VARCHAR(10),
    day1_used BOOLEAN,
    day2_used BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.code_6_digit, t.email, t.name, t.ticket_type, t.day1_used, t.day2_used
    FROM tickets t
    WHERE t.code_6_digit = p_query
       OR t.email ILIKE '%' || p_query || '%'
       OR t.name ILIKE '%' || p_query || '%'
    LIMIT 20;
END;
$$;

-- ============================================
-- Sample data for testing (remove in production)
-- ============================================
-- INSERT INTO tickets (code_6_digit, email, name, ticket_type) VALUES
-- ('123456', 'test1@example.com', 'Test User 1', 'DAY1'),
-- ('234567', 'test2@example.com', 'Test User 2', 'DAY2'),
-- ('345678', 'test3@example.com', 'Test User 3', 'COMBO');

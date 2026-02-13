-- ============================================
-- YATRA 2026: Unified Scanner Logic
-- ============================================
-- Goal: Fix "not the valid day" errors and check all fallback tables.
-- ============================================

CREATE OR REPLACE FUNCTION validate_scan_unified(
    p_qr_token TEXT,
    p_gate_type TEXT,
    p_scanner_device TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ticket_id UUID;
    v_ticket RECORD;
    v_reg RECORD;
    v_new_ticket_id UUID;
    v_hours_since_use NUMERIC;
    v_ticket_type TEXT := 'SINGLE';
BEGIN
    -- 1. SEARCH IN TICKETS TABLE (Primary Source)
    -- Try to find by token OR fallback to 6-digit code lookup if token is format "UUID.HMAC"
    -- But here we assume p_qr_token is what we have.
    
    SELECT * INTO v_ticket
    FROM tickets
    WHERE qr_token = p_qr_token OR code_6_digit = p_qr_token
    FOR UPDATE;

    -- If found in tickets table, validate it
    IF v_ticket IS NOT NULL THEN
        -- Check if revoked
        IF v_ticket.status = 'revoked' THEN
             RETURN jsonb_build_object(
                'success', true,
                'allowed', false,
                'reason', 'TICKET_REVOKED',
                'message', 'Ticket has been revoked',
                'ticket', row_to_json(v_ticket)
            );
        END IF;

        -- Check 14-hour refresh logic
        IF v_ticket.last_used_at IS NOT NULL THEN
            v_hours_since_use := EXTRACT(EPOCH FROM (NOW() - v_ticket.last_used_at)) / 3600;
            
            IF v_hours_since_use < 14 THEN
                RETURN jsonb_build_object(
                    'success', true,
                    'allowed', false,
                    'reason', 'ALREADY_USED_TODAY',
                    'message', 'Ticket already used within 14 hours',
                    'ticket', row_to_json(v_ticket)
                );
            END IF;
        END IF;

        -- Valid! Update usage
        UPDATE tickets 
        SET last_used_at = NOW(), updated_at = NOW(), status = 'active'
        WHERE id = v_ticket.id;

        RETURN jsonb_build_object(
            'success', true,
            'allowed', true,
            'reason', 'VALID',
            'message', 'Entry allowed',
            'ticket', row_to_json(v_ticket)
        );
    END IF;

    -- 2. IF NOT FOUND IN TICKETS -> CHECK REGISTRATIONS (Legacy/Main)
    -- We assume p_qr_token might be the registration ID or something unique?
    -- Actually, usually the QR contains a specific payload. 
    -- If p_qr_token is a UUID, check ID. If it's a code, check that.
    
    -- Try standard registrations table
    SELECT * INTO v_reg FROM registrations WHERE id::text = p_qr_token OR email = p_qr_token LIMIT 1;

    IF v_reg IS NOT NULL THEN
         -- Found! Create a ticket for them
         INSERT INTO tickets (registration_id, email, name, college, ticket_type, status, last_used_at)
         VALUES (v_reg.id, v_reg.email, v_reg.name, v_reg.college, 'SINGLE', 'active', NOW())
         RETURNING id INTO v_new_ticket_id;
         
         SELECT * INTO v_ticket FROM tickets WHERE id = v_new_ticket_id;
         
         RETURN jsonb_build_object(
            'success', true,
            'allowed', true,
            'reason', 'VALID',
            'message', 'Entry allowed (Found in Registrations)',
            'ticket', row_to_json(v_ticket)
        );
    END IF;

     -- 3. CHECK registeration_recent
    -- Note: Schema might vary, strict check on existence
    BEGIN
        EXECUTE 'SELECT id, email, name, college, phone FROM registeration_recent WHERE id::text = $1 OR email = $1 LIMIT 1'
        INTO v_reg
        USING p_qr_token;

        IF v_reg IS NOT NULL THEN
             INSERT INTO tickets (email, name, college, phone, ticket_type, status, last_used_at)
             VALUES (v_reg.email, v_reg.name, v_reg.college, v_reg.phone, 'SINGLE', 'active', NOW())
             RETURNING id INTO v_new_ticket_id;
             
             SELECT * INTO v_ticket FROM tickets WHERE id = v_new_ticket_id;
             
             RETURN jsonb_build_object(
                'success', true,
                'allowed', true,
                'reason', 'VALID',
                'message', 'Entry allowed (Found in Recent)',
                'ticket', row_to_json(v_ticket)
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Table might not exist or schema mismatch, ignore
        NULL;
    END;

    -- 4. CHECK registeration_general_public
    BEGIN
        EXECUTE 'SELECT id, email, name, phone FROM registeration_general_public WHERE id::text = $1 OR email = $1 LIMIT 1'
        INTO v_reg
        USING p_qr_token;

        IF v_reg IS NOT NULL THEN
             INSERT INTO tickets (email, name, phone, ticket_type, status, last_used_at)
             VALUES (v_reg.email, v_reg.name, v_reg.phone, 'SINGLE', 'active', NOW())
             RETURNING id INTO v_new_ticket_id;
             
             SELECT * INTO v_ticket FROM tickets WHERE id = v_new_ticket_id;
             
             RETURN jsonb_build_object(
                'success', true,
                'allowed', true,
                'reason', 'VALID',
                'message', 'Entry allowed (Found in Gen Public)',
                'ticket', row_to_json(v_ticket)
            );
        END IF;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
    
    -- 5. INVALID
    RETURN jsonb_build_object(
        'success', false,
        'allowed', false,
        'reason', 'TICKET_NOT_FOUND',
        'message', 'Invalid Ticket'
    );
END;
$$;

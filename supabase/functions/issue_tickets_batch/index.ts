import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"
import QRCode from "https://esm.sh/qrcode@1.5.1"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function requireAdminEmail(req: Request): Promise<string> {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.startsWith('Bearer ')
        ? authHeader.slice('Bearer '.length)
        : authHeader
    if (!jwt) throw new Error('Missing Authorization bearer token')

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data, error } = await supabase.auth.getUser(jwt)
    if (error || !data?.user?.email) {
        throw new Error('Unauthorized: invalid user token')
    }

    const email = data.user.email.toLowerCase()
    const masterAdmin = (Deno.env.get('MASTER_ADMIN_EMAIL') ?? 'meraryanto@gmail.com').toLowerCase()
    if (email === masterAdmin) return email

    const { data: isAdmin, error: rpcError } = await supabase.rpc('check_is_admin', { user_email: email })
    if (rpcError) throw new Error('Unauthorized: admin check failed')
    if (!isAdmin) throw new Error('Unauthorized: not an admin')

    return email
}

// SMTP Configuration
const EMAIL_USER = Deno.env.get("EMAIL_USER");
const EMAIL_PASS = Deno.env.get("EMAIL_PASS");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "noreply@yatra2026.com";

// Helper: Send Email via SMTP
async function sendEmailViaSMTP(to: string, subject: string, html: string, text: string): Promise<void> {
    if (!EMAIL_USER || !EMAIL_PASS) {
        console.log("SMTP not configured. Mocking email send to:", to);
        return;
    }

    try {
        const hostname = "smtp.gmail.com";
        const port = 465;
        const conn = await Deno.connectTls({ hostname, port });
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        const write = async (cmd: string) => await conn.write(encoder.encode(cmd + "\r\n"));
        const read = async () => {
            const buf = new Uint8Array(4096);
            const n = await conn.read(buf);
            return n ? decoder.decode(buf.subarray(0, n)) : null;
        };

        // Handshake
        await read(); // Greeting
        await write("EHLO localhost"); await read();
        await write("AUTH LOGIN"); await read();
        await write(btoa(EMAIL_USER)); await read();
        await write(btoa(EMAIL_PASS));
        const authRes = await read();
        if (!authRes?.includes("235")) throw new Error(`SMTP Auth failed: ${authRes}`);

        await write(`MAIL FROM:<${FROM_EMAIL}>`); await read();
        await write(`RCPT TO:<${to}>`); await read();
        await write("DATA"); await read();

        const boundary = "----=_Part_" + Date.now().toString();
        const message = [
            `From: YATRA 2026 <${FROM_EMAIL}>`,
            `To: ${to}`,
            `Subject: ${subject}`,
            `MIME-Version: 1.0`,
            `Content-Type: multipart/alternative; boundary="${boundary}"`,
            "",
            `--${boundary}`,
            `Content-Type: text/plain; charset=utf-8`,
            "",
            text,
            "",
            `--${boundary}`,
            `Content-Type: text/html; charset=utf-8`,
            "",
            html,
            "",
            `--${boundary}--`,
            "."
        ].join("\r\n");

        await write(message);
        await read(); // Queue success
        await write("QUIT");
        conn.close();
    } catch (error) {
        console.error("SMTP Error:", error);
        throw error;
    }
}

// BRUTALIST EMAIL TEMPLATE
function generateBrutalistEmailHtml(reg: { name: string; email: string }, ticketCode: string, qrDataUrl: string, adminEmail: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YATRA 2026 // ENTRY PASS</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #000; font-family: 'Courier New', Courier, monospace;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border: 6px solid #000;">
    
    <!-- HEADER -->
    <div style="background: #000; padding: 30px 20px; text-align: center; border-bottom: 6px solid #ff0;">
      <h1 style="color: #fff; margin: 0; font-size: 48px; font-weight: 900; letter-spacing: 8px; text-transform: uppercase;">YATRA</h1>
      <div style="color: #ff0; font-size: 24px; font-weight: 700; margin-top: 5px; letter-spacing: 4px;">2026</div>
    </div>
    
    <!-- MAIN CONTENT -->
    <div style="padding: 30px 25px; background: #fff;">
      
      <!-- GREETING -->
      <div style="border: 4px solid #000; padding: 20px; margin-bottom: 25px; background: #f0f0f0;">
        <p style="margin: 0; font-size: 18px; font-weight: 700; text-transform: uppercase;">ATTENDEE:</p>
        <p style="margin: 8px 0 0 0; font-size: 28px; font-weight: 900; color: #000; text-transform: uppercase;">${reg.name}</p>
      </div>
      
      <!-- STATUS -->
      <div style="border: 4px solid #0a0; background: #0a0; padding: 15px 20px; margin-bottom: 25px;">
        <p style="margin: 0; color: #fff; font-weight: 700; font-size: 16px; text-transform: uppercase; letter-spacing: 2px;">// REGISTRATION CONFIRMED //</p>
      </div>
      
      <!-- TICKET SECTION -->
      <div style="border: 6px solid #000; background: #000; padding: 25px; margin-bottom: 25px;">
        <div style="text-align: center;">
          <p style="margin: 0 0 15px 0; color: #ff0; font-size: 14px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase;">// ENTRY CODE //</p>
          <div style="background: #fff; display: inline-block; padding: 20px 40px; border: 4px solid #ff0;">
            <span style="font-size: 48px; font-weight: 900; letter-spacing: 10px; color: #000;">${ticketCode}</span>
          </div>
        </div>
        
        <div style="text-align: center; margin-top: 25px; padding-top: 25px; border-top: 2px dashed #333;">
          <p style="margin: 0 0 15px 0; color: #fff; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">SCAN TO ENTER</p>
          <div style="background: #fff; display: inline-block; padding: 15px; border: 4px solid #ff0;">
            <img src="${qrDataUrl}" alt="QR" style="width: 180px; height: 180px; display: block;" />
          </div>
        </div>
      </div>
      
      <!-- WARNING -->
      <div style="border: 4px solid #f00; background: #f00; padding: 15px 20px; margin-bottom: 25px;">
        <p style="margin: 0; color: #fff; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">WARNING: BRING VALID ID + THIS TICKET FOR ENTRY VERIFICATION</p>
      </div>
      
      <!-- VENUE -->
      <div style="background: #f0f0f0; border: 4px solid #000; padding: 20px;">
        <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 700; text-transform: uppercase;">VENUE:</p>
        <p style="margin: 0; font-size: 16px; font-weight: 500;">Rajalakshmi Institute of Technology</p>
      </div>
      
    </div>
    
    <!-- FOOTER -->
    <div style="background: #000; padding: 20px; border-top: 6px solid #ff0;">
      <p style="margin: 0; color: #fff; font-size: 12px; text-align: center; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">RAJALAKSHMI INSTITUTE OF TECHNOLOGY</p>
      <p style="margin: 8px 0 0 0; color: #666; font-size: 10px; text-align: center; text-transform: uppercase; letter-spacing: 1px;">ISSUED BY: ${adminEmail}</p>
    </div>
    
  </div>
</body>
</html>`;
}

function generateBrutalistEmailText(ticketCode: string): string {
    return `========================================
          YATRA 2026
          ENTRY PASS
========================================

ENTRY CODE: ${ticketCode}

Present this code or scan QR at entrance.

!! WARNING: BRING VALID ID !!

----------------------------------------
RAJALAKSHMI INSTITUTE OF TECHNOLOGY
YATRA 2026 // AUTOMATED SYSTEM`;
}

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 200,
            headers: corsHeaders
        })
    }

    try {
        const adminEmail = await requireAdminEmail(req)

        // 1. Validation
        const { registration_ids } = await req.json()

        if (!registration_ids || !Array.isArray(registration_ids) || registration_ids.length === 0) {
            throw new Error('registration_ids array is required')
        }

        const uniqueIds = [...new Set(registration_ids)];
        console.log(`Processing ${uniqueIds.length} tickets. Issuer: ${adminEmail}`);

        // Init Supabase Client
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const supabase = createClient(supabaseUrl, supabaseKey)

        const results = {
            success: true,
            issued_count: 0,
            skipped_count: 0,
            not_paid_count: 0,
            already_sent_count: 0,
            failed: [] as any[]
        };

        // 2. Process Loop
        for (const regId of uniqueIds) {
            try {
                // A. Fetch Registration
                const { data: reg, error: fetchError } = await supabase
                    .from('registrations')
                    .select('*')
                    .eq('id', regId)
                    .single();

                if (fetchError || !reg) {
                    throw new Error(`Registration not found: ${fetchError?.message}`);
                }

                // B. Eligibility: must be paid
                if ((reg.payment_status ?? 'unpaid') !== 'paid') {
                    results.not_paid_count++;
                    results.failed.push({ registration_id: regId, reason: 'Not eligible: payment_status is not paid' });
                    continue;
                }

                // C. Idempotency: if already marked sent, skip
                if (reg.ticket_email_sent) {
                    console.log(`Skipping ${reg.email} - already sent`);
                    results.skipped_count++;
                    results.already_sent_count++;
                    continue;
                }

                // D. Secondary idempotency: if latest email event says "sent", treat as sent
                try {
                    const { data: latestEvent } = await supabase
                        .from('ticket_email_events')
                        .select('status, created_at')
                        .eq('registration_id', regId)
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (latestEvent?.status === 'sent') {
                        console.log(`Skipping ${reg.email} - last email event is sent`);
                        results.skipped_count++;
                        results.already_sent_count++;
                        await supabase
                            .from('registrations')
                            .update({ ticket_email_sent: true })
                            .eq('id', regId);
                        continue;
                    }
                } catch {
                    // ignore if table doesn't exist yet
                }

                // E. Ticket: reuse if already created for this registration (prevents duplicates on retries)
                let ticketId = '';
                let ticketCode = '';
                const qrPayload = regId; // QR is registration UUID only

                const { data: existingTicket, error: ticketFetchError } = await supabase
                    .from('tickets')
                    .select('id, code_6_digit, qr_payload')
                    .eq('registration_id', regId)
                    .maybeSingle();

                if (ticketFetchError) {
                    throw new Error(`Failed to check existing ticket: ${ticketFetchError.message}`);
                }

                if (existingTicket) {
                    ticketId = String(existingTicket.id);
                    ticketCode = String(existingTicket.code_6_digit);
                    if (existingTicket.qr_payload !== qrPayload) {
                        await supabase
                            .from('tickets')
                            .update({ qr_payload: qrPayload })
                            .eq('id', ticketId);
                    }
                } else {
                    // Generate Unique 6-Digit Code
                    let isUnique = false;
                    let attempts = 0;

                    while (!isUnique && attempts < 10) {
                        ticketCode = Math.floor(100000 + Math.random() * 900000).toString();

                        const { data: existing } = await supabase
                            .from('tickets')
                            .select('id')
                            .eq('code_6_digit', ticketCode)
                            .maybeSingle();

                        if (!existing) isUnique = true;
                        attempts++;
                    }

                    if (!isUnique) throw new Error("Failed to generate unique ticket code");

                    // Generate Ticket UUID
                    ticketId = crypto.randomUUID();

                    // Insert Ticket
                    const { error: insertError } = await supabase
                        .from('tickets')
                        .insert({
                            id: ticketId,
                            registration_id: reg.id,
                            email: reg.email,
                            name: reg.name,
                            college: reg.college,
                            code_6_digit: ticketCode,
                            qr_payload: qrPayload,
                            ticket_status: 'valid'
                        });

                    if (insertError) throw new Error(`Ticket insert failed: ${insertError.message}`);
                }

                const qrDataUrl = await QRCode.toDataURL(qrPayload);

                // F. Send Email with BRUTALIST template
                const emailHtml = generateBrutalistEmailHtml(reg, ticketCode, qrDataUrl, adminEmail);
                const emailText = generateBrutalistEmailText(ticketCode);

                try {
                    await sendEmailViaSMTP(
                        reg.email,
                        `YATRA 2026 // ENTRY PASS [${ticketCode}]`,
                        emailHtml,
                        emailText
                    );

                    try {
                        await supabase.from('ticket_email_events').insert({
                            registration_id: regId,
                            ticket_id: ticketId,
                            to_email: reg.email,
                            status: 'sent',
                            error_text: null
                        });
                    } catch {
                        // ignore
                    }
                } catch (emailError) {
                    const errText = emailError instanceof Error ? emailError.message : String(emailError);
                    try {
                        await supabase.from('ticket_email_events').insert({
                            registration_id: regId,
                            ticket_id: ticketId,
                            to_email: reg.email,
                            status: 'failed',
                            error_text: errText
                        });
                    } catch {
                        // ignore
                    }

                    throw new Error(`Email send failed: ${errText}`);
                }

                // G. Update Registration (Final State)
                const { error: updateError } = await supabase
                    .from('registrations')
                    .update({
                        ticket_generated: true,
                        ticket_email_sent: true,
                        ticket_sent_at: new Date().toISOString()
                    })
                    .eq('id', regId);

                if (updateError) {
                    console.error(`Failed to update registration status for ${regId}`, updateError);
                }

                results.issued_count++;
                console.log(`Issued ticket ${ticketCode} to ${reg.email}`);

            } catch (itemError) {
                console.error(`Failed for ${regId}:`, itemError);
                const reason = itemError instanceof Error ? itemError.message : String(itemError);
                results.failed.push({ registration_id: regId, reason });
            }
        }

        return new Response(
            JSON.stringify(results),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const EMAIL_USER = Deno.env.get("EMAIL_USER");
const EMAIL_PASS = Deno.env.get("EMAIL_PASS");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || EMAIL_USER || "noreply@yatra2026.com";

interface RegistrationData {
    id: string;
    name: string;
    email: string;
    phone: string;
    college: string;
    ticket_type: string | null;
    price: string | null;
    is_rit_student: boolean | null;
    created_at: string;
}

async function sendEmailViaSMTP(to: string, subject: string, html: string, text: string): Promise<void> {
    if (!EMAIL_USER || !EMAIL_PASS) {
        throw new Error("EMAIL_USER or EMAIL_PASS not configured");
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const conn = await Deno.connectTls({
        hostname: "smtp.gmail.com",
        port: 465,
    });

    try {
        const buffer = new Uint8Array(4096);

        let n = await conn.read(buffer);
        if (n === null) throw new Error("Connection closed");
        let response = decoder.decode(buffer.subarray(0, n));
        if (!response.startsWith("220")) {
            throw new Error(`SMTP greeting failed: ${response}`);
        }

        await conn.write(encoder.encode("EHLO localhost\r\n"));
        n = await conn.read(buffer);
        if (n === null) throw new Error("Connection closed");
        response = decoder.decode(buffer.subarray(0, n));
        if (!response.startsWith("250")) {
            throw new Error(`EHLO failed: ${response}`);
        }

        await conn.write(encoder.encode("AUTH LOGIN\r\n"));
        n = await conn.read(buffer);
        if (n === null) throw new Error("Connection closed");
        response = decoder.decode(buffer.subarray(0, n));
        if (!response.startsWith("334")) {
            throw new Error(`AUTH LOGIN failed: ${response}`);
        }

        const usernameB64 = btoa(EMAIL_USER);
        await conn.write(encoder.encode(usernameB64 + "\r\n"));
        n = await conn.read(buffer);
        if (n === null) throw new Error("Connection closed");
        response = decoder.decode(buffer.subarray(0, n));
        if (!response.startsWith("334")) {
            throw new Error(`Username auth failed: ${response}`);
        }

        const passwordB64 = btoa(EMAIL_PASS);
        await conn.write(encoder.encode(passwordB64 + "\r\n"));
        n = await conn.read(buffer);
        if (n === null) throw new Error("Connection closed");
        response = decoder.decode(buffer.subarray(0, n));
        if (!response.startsWith("235")) {
            throw new Error(`Authentication failed: ${response}`);
        }

        await conn.write(encoder.encode(`MAIL FROM:<${FROM_EMAIL}>\r\n`));
        n = await conn.read(buffer);
        if (n === null) throw new Error("Connection closed");
        response = decoder.decode(buffer.subarray(0, n));
        if (!response.startsWith("250")) {
            throw new Error(`MAIL FROM failed: ${response}`);
        }

        await conn.write(encoder.encode(`RCPT TO:<${to}>\r\n`));
        n = await conn.read(buffer);
        if (n === null) throw new Error("Connection closed");
        response = decoder.decode(buffer.subarray(0, n));
        if (!response.startsWith("250")) {
            throw new Error(`RCPT TO failed: ${response}`);
        }

        await conn.write(encoder.encode("DATA\r\n"));
        n = await conn.read(buffer);
        if (n === null) throw new Error("Connection closed");
        response = decoder.decode(buffer.subarray(0, n));
        if (!response.startsWith("354")) {
            throw new Error(`DATA command failed: ${response}`);
        }

        const boundary = "----=_Part_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
        const message = [
            `From: YATRA 2026 <${FROM_EMAIL}>`,
            `To: ${to}`,
            `Subject: ${subject}`,
            `MIME-Version: 1.0`,
            `Content-Type: multipart/alternative; boundary="${boundary}"`,
            ``,
            `--${boundary}`,
            `Content-Type: text/plain; charset=utf-8`,
            `Content-Transfer-Encoding: 7bit`,
            ``,
            text,
            ``,
            `--${boundary}`,
            `Content-Type: text/html; charset=utf-8`,
            `Content-Transfer-Encoding: 7bit`,
            ``,
            html,
            ``,
            `--${boundary}--`,
            `.`,
        ].join("\r\n");

        await conn.write(encoder.encode(message + "\r\n"));
        n = await conn.read(buffer);
        if (n === null) throw new Error("Connection closed");
        response = decoder.decode(buffer.subarray(0, n));
        if (!response.startsWith("250")) {
            throw new Error(`Message send failed: ${response}`);
        }

        await conn.write(encoder.encode("QUIT\r\n"));
        n = await conn.read(buffer);
        if (n === null) throw new Error("Connection closed");
    } finally {
        conn.close();
    }
}

function generateBrutalistEmailHtml(registration: RegistrationData, ticketCode: string, qrDataUrl: string, ticketGenerated: boolean): string {
    const ticketSection = ticketGenerated ? `
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
    <div style="border: 4px solid #f00; background: #f00; padding: 15px 20px; margin-bottom: 25px;">
      <p style="margin: 0; color: #fff; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">WARNING: BRING VALID ID + THIS TICKET FOR ENTRY VERIFICATION</p>
    </div>
  ` : '';

    const ritBadge = registration.is_rit_student ? '<div style="background: #0f0; padding: 12px 20px; border-top: 2px solid #000; font-weight: 700; text-transform: uppercase;">RIT STUDENT DISCOUNT APPLIED</div>' : '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YATRA 2026 // ENTRY PASS</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #000; font-family: 'Courier New', Courier, monospace;">
  <div style="max-width: 600px; margin: 0 auto; background: #fff; border: 6px solid #000;">
    <div style="background: #000; padding: 30px 20px; text-align: center; border-bottom: 6px solid #ff0;">
      <h1 style="color: #fff; margin: 0; font-size: 48px; font-weight: 900; letter-spacing: 8px; text-transform: uppercase;">YATRA</h1>
      <div style="color: #ff0; font-size: 24px; font-weight: 700; margin-top: 5px; letter-spacing: 4px;">2026</div>
    </div>
    <div style="padding: 30px 25px; background: #fff;">
      <div style="border: 4px solid #000; padding: 20px; margin-bottom: 25px; background: #f0f0f0;">
        <p style="margin: 0; font-size: 18px; font-weight: 700; text-transform: uppercase;">ATTENDEE:</p>
        <p style="margin: 8px 0 0 0; font-size: 28px; font-weight: 900; color: #000; text-transform: uppercase;">${registration.name}</p>
      </div>
      <div style="border: 4px solid #000; margin-bottom: 25px;">
        <div style="background: #000; color: #fff; padding: 12px 20px; font-size: 14px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">REGISTRATION DATA</div>
        <table style="width: 100%; border-collapse: collapse;">
          <tr style="border-bottom: 2px solid #000;">
            <td style="padding: 15px 20px; font-weight: 700; text-transform: uppercase; width: 35%; background: #f0f0f0; border-right: 2px solid #000;">EMAIL</td>
            <td style="padding: 15px 20px; font-weight: 500;">${registration.email}</td>
          </tr>
          <tr style="border-bottom: 2px solid #000;">
            <td style="padding: 15px 20px; font-weight: 700; text-transform: uppercase; background: #f0f0f0; border-right: 2px solid #000;">PHONE</td>
            <td style="padding: 15px 20px; font-weight: 500;">${registration.phone}</td>
          </tr>
          <tr style="border-bottom: 2px solid #000;">
            <td style="padding: 15px 20px; font-weight: 700; text-transform: uppercase; background: #f0f0f0; border-right: 2px solid #000;">COLLEGE</td>
            <td style="padding: 15px 20px; font-weight: 500;">${registration.college}</td>
          </tr>
          <tr style="border-bottom: 2px solid #000;">
            <td style="padding: 15px 20px; font-weight: 700; text-transform: uppercase; background: #f0f0f0; border-right: 2px solid #000;">PASS TYPE</td>
            <td style="padding: 15px 20px; font-weight: 700;">${registration.ticket_type || "STANDARD"}</td>
          </tr>
          <tr>
            <td style="padding: 15px 20px; font-weight: 700; text-transform: uppercase; background: #ff0; border-right: 2px solid #000;">PRICE</td>
            <td style="padding: 15px 20px; font-size: 24px; font-weight: 900; background: #ff0;">${registration.price || "N/A"}</td>
          </tr>
        </table>
        ${ritBadge}
      </div>
      ${ticketSection}
      <div style="background: #f0f0f0; border: 4px solid #000; padding: 20px;">
        <p style="margin: 0; font-size: 16px; font-weight: 500; line-height: 1.6;">Get ready for the biggest cultural fest. See you there.</p>
      </div>
    </div>
    <div style="background: #000; padding: 20px; border-top: 6px solid #ff0;">
      <p style="margin: 0; color: #fff; font-size: 12px; text-align: center; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">RAJALAKSHMI INSTITUTE OF TECHNOLOGY</p>
      <p style="margin: 8px 0 0 0; color: #666; font-size: 10px; text-align: center; text-transform: uppercase; letter-spacing: 1px;">YATRA 2026 // AUTOMATED SYSTEM</p>
    </div>
  </div>
</body>
</html>`;
}

function generateBrutalistEmailText(registration: RegistrationData, ticketCode: string, ticketGenerated: boolean): string {
    const ticketSection = ticketGenerated ? `
========================================
        ENTRY CODE: ${ticketCode}
========================================

Present this code or scan QR at entrance.

!! WARNING: BRING VALID ID FOR VERIFICATION !!

` : '';

    return `========================================
          YATRA 2026
          ENTRY PASS
========================================

ATTENDEE: ${registration.name}

----------------------------------------
REGISTRATION DATA
----------------------------------------
EMAIL:     ${registration.email}
PHONE:     ${registration.phone}
COLLEGE:   ${registration.college}
PASS TYPE: ${registration.ticket_type || "STANDARD"}
PRICE:     ${registration.price || "N/A"}
${registration.is_rit_student ? "STATUS:    RIT STUDENT DISCOUNT\n" : ""}----------------------------------------
${ticketSection}----------------------------------------
RAJALAKSHMI INSTITUTE OF TECHNOLOGY
YATRA 2026 // AUTOMATED SYSTEM`;
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
            },
        });
    }

    try {
        const registration: RegistrationData = await req.json();

        if (!registration.email || !registration.name) {
            return new Response(
                JSON.stringify({ error: "Missing required fields: email and name" }),
                {
                    status: 400,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                }
            );
        }

        if (!EMAIL_USER || !EMAIL_PASS) {
            console.log("EMAIL_USER or EMAIL_PASS not set. Email would be sent to:", registration.email);
            console.log("Registration details:", registration);
            return new Response(
                JSON.stringify({
                    message: "Email service not configured. Registration logged.",
                    registration,
                }),
                {
                    status: 200,
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                }
            );
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const supabase = createClient(supabaseUrl, supabaseKey);

        let ticketCode = '';
        let ticketId = '';
        let qrDataUrl = '';
        let ticketGenerated = false;

        try {
            const { data: existingTicket } = await supabase
                .from('tickets')
                .select('six_digit_code, qr_payload')
                .eq('registration_id', registration.id)
                .maybeSingle();

            if (existingTicket) {
                ticketCode = existingTicket.six_digit_code;
                ticketId = registration.id;
                qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(existingTicket.qr_payload)}`;
                ticketGenerated = true;
                console.log(`Using existing ticket code ${ticketCode} for registration ${registration.id}`);
            } else {
                let isUnique = false;
                let attempts = 0;

                while (!isUnique && attempts < 10) {
                    ticketCode = Math.floor(100000 + Math.random() * 900000).toString();

                    const { data: existing } = await supabase
                        .from('tickets')
                        .select('id')
                        .eq('six_digit_code', ticketCode)
                        .maybeSingle();

                    if (!existing) isUnique = true;
                    attempts++;
                }

                if (!isUnique) {
                    throw new Error("Failed to generate unique ticket code after 10 attempts");
                }

                ticketId = crypto.randomUUID();

                const qrPayload = JSON.stringify({
                    id: ticketId,
                    code: ticketCode
                });

                qrDataUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrPayload)}`;

                const { error: insertError } = await supabase
                    .from('tickets')
                    .insert({
                        id: ticketId,
                        registration_id: registration.id,
                        email: registration.email,
                        name: registration.name,
                        college: registration.college,
                        six_digit_code: ticketCode,
                        qr_payload: qrPayload,
                        ticket_status: 'valid'
                    });

                if (insertError) {
                    console.error('Failed to insert ticket:', insertError);
                    throw new Error(`Ticket creation failed: ${insertError.message}`);
                }

                const { error: updateError } = await supabase
                    .from('registrations')
                    .update({
                        ticket_generated: true,
                        ticket_email_sent: true,
                        ticket_sent_at: new Date().toISOString()
                    })
                    .eq('id', registration.id);

                if (updateError) {
                    console.error('Failed to update registration:', updateError);
                }

                ticketGenerated = true;
                console.log(`Generated ticket ${ticketCode} for registration ${registration.id}`);
            }
        } catch (ticketError) {
            console.error('Ticket generation error:', ticketError);
            console.error('Error details:', JSON.stringify(ticketError, null, 2));
        }

        console.log(`Ticket generation status: ${ticketGenerated ? 'SUCCESS' : 'FAILED'}`);
        console.log(`QR Data URL length: ${qrDataUrl ? qrDataUrl.length : 0}`);

        const emailHtml = generateBrutalistEmailHtml(registration, ticketCode, qrDataUrl, ticketGenerated);
        const emailText = generateBrutalistEmailText(registration, ticketCode, ticketGenerated);

        console.log(`Attempting to send email from: ${FROM_EMAIL} to: ${registration.email}`);

        await sendEmailViaSMTP(
            registration.email,
            "YATRA 2026 // ENTRY PASS CONFIRMED",
            emailHtml,
            emailText
        );

        console.log("Email sent successfully to:", registration.email);

        return new Response(
            JSON.stringify({
                message: "Confirmation email sent successfully",
                to: registration.email,
                ticket_generated: ticketGenerated
            }),
            {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            }
        );
    } catch (error) {
        console.error("Error sending email:", error);
        return new Response(
            JSON.stringify({
                error: "Failed to send confirmation email",
                details: error instanceof Error ? error.message : String(error),
            }),
            {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            }
        );
    }
});

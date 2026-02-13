
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables manually since we might not be in the root or using vite
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        if (!fs.existsSync(envPath)) {
            console.log('.env file not found');
            return {};
        }
        const envContent = fs.readFileSync(envPath, 'utf8');
        const env = {};
        envContent.split('\n').forEach(line => {
            const parts = line.split('=');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join('=').trim();
                env[key] = value;
            }
        });
        return env;
    } catch (e) {
        console.error('Error loading .env', e);
        return {};
    }
}

const env = loadEnv();
const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    console.log('Found keys:', Object.keys(env));
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugTicket(code) {
    console.log(`\n--- Debugging Ticket: ${code} ---`);

    // 1. Fetch raw data
    const { data: tickets, error: fetchError } = await supabase
        .from('tickets')
        .select('*')
        .eq('code_6_digit', code);

    if (fetchError) {
        console.error('Fetch Error:', fetchError);
        return;
    }

    if (!tickets || tickets.length === 0) {
        console.error('No ticket found with this code!');
        return;
    }

    const ticket = tickets[0];
    console.log('Ticket Data Found:');
    console.log(`- ID: ${ticket.id}`);
    console.log(`- Code: ${ticket.code_6_digit}`);
    console.log(`- QR Token: '${ticket.qr_token}'`);
    if (ticket.qr_token) {
        console.log(`- QR Token Length: ${ticket.qr_token.length}`);
        console.log(`- QR Token Bytes: ${Buffer.from(ticket.qr_token).toString('hex')}`);
    }
    console.log(`- Last Used: ${ticket.last_used_at}`);
    console.log(`- Status: ${ticket.status}`);

    // 2. Test RPC with Code
    console.log('\nTesting RPC with CODE...');
    const { data: rpcData1, error: rpcError1 } = await supabase.rpc('validate_scan_unified', {
        p_qr_token: code,
        p_gate_type: 'CONFERENCE',
        p_scanner_device: 'DEBUGGER'
    });
    console.log('Result (using code):', rpcError1 ? rpcError1 : rpcData1);

    // 3. Test RPC with QR Token
    if (ticket.qr_token) {
        console.log(`\nTesting RPC with QR TOKEN ('${ticket.qr_token}')...`);
        const { data: rpcData2, error: rpcError2 } = await supabase.rpc('validate_scan_unified', {
            p_qr_token: ticket.qr_token,
            p_gate_type: 'CONFERENCE',
            p_scanner_device: 'DEBUGGER'
        });
        console.log('Result (using qr_token):', rpcError2 ? rpcError2 : rpcData2);

        // 3b. Test with TRIMMED token if different
        if (ticket.qr_token.trim() !== ticket.qr_token) {
            console.log(`\nTesting RPC with TRIMMED QR TOKEN ('${ticket.qr_token.trim()}')...`);
            const { data: rpcData3, error: rpcError3 } = await supabase.rpc('validate_scan_unified', {
                p_qr_token: ticket.qr_token.trim(),
                p_gate_type: 'CONFERENCE',
                p_scanner_device: 'DEBUGGER'
            });
            console.log('Result (using trimmed qr_token):', rpcError3 ? rpcError3 : rpcData3);
        }
    } else {
        console.log('\nTicket has NO qr_token.');
    }

    // 4. Test verify_and_mark_ticket (Direct RPC)
    console.log(`\nTesting verify_and_mark_ticket('${ticket.id}')...`);
    const { data: vmtData, error: vmtError } = await supabase.rpc('verify_and_mark_ticket', {
        p_ticket_id: ticket.id
    });

    if (vmtError) {
        console.log('verify_and_mark_ticket ERROR:', vmtError);

        // Try with 2 args (Legacy check)
        console.log('Trying legacy signature (id, day=1)...');
        const { data: vmtData2, error: vmtError2 } = await supabase.rpc('verify_and_mark_ticket', {
            p_ticket_id: ticket.id,
            p_current_day: 1
        });
        console.log('Legacy Result:', vmtError2 ? vmtError2 : vmtData2);
    } else {
        console.log('verify_and_mark_ticket Result:', vmtData);
    }
}

// Run debug
debugTicket('568789'); // Code from screenshot

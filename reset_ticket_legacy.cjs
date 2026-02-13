
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        if (!fs.existsSync(envPath)) return {};
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
        return {};
    }
}

const env = loadEnv();
const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);

async function resetLegacyColumns(code) {
    console.log(`Resetting legacy columns for ticket ${code}...`);

    const { data, error } = await supabase
        .from('tickets')
        .update({
            last_used_at: null,
            usage_day1: null,
            usage_day2: null,
            usage_event: null,
            status: 'active'
        })
        .eq('code_6_digit', code)
        .select();

    if (error) {
        console.error('Error resetting ticket:', error);
    } else {
        console.log('Ticket reset successfully:', data);
    }
}

resetLegacyColumns('568789');

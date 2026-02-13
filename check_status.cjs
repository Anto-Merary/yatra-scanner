
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

async function checkTicket(code) {
    console.log(`Checking ticket ${code}...`);

    const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .eq('code_6_digit', code);

    if (error) {
        console.error('Error fetching ticket:', error);
    } else if (data && data.length > 0) {
        const t = data[0];
        console.log('Ticket Status:');
        console.log(`- ID: ${t.id}`);
        console.log(`- Status: ${t.status}`);
        console.log(`- Last Used: ${t.last_used_at}`);
        console.log(`- Day 1 Used: ${t.usage_day1}`);
        console.log(`- Day 2 Used: ${t.usage_day2}`);
        console.log(`- Event Used: ${t.usage_event}`);
    } else {
        console.log('Ticket not found.');
    }
}

checkTicket('568789');

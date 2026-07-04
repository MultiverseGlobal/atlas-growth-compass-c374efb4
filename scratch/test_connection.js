import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env file manually
const envPath = path.resolve('.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
});

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, key);

async function test() {
  console.log(`Connecting to Supabase at: ${url}...`);
  try {
    const { data, error } = await supabase.from('profiles').select('id').limit(1);
    if (error) {
      if (error.code === 'P0001' || error.message.includes('relation "public.profiles" does not exist')) {
        console.log("Connection SUCCESS, but tables do not exist yet. Please run init_all.sql!");
      } else {
        console.error("Connection ERROR:", error.message);
      }
    } else {
      console.log("Connection SUCCESS! Profiles table is accessible.");
    }
  } catch (err) {
    console.error("Failed to run query:", err.message);
  }
}

test();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load .env file FIRST before reading any environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

console.log('🔍 Loading Supabase credentials...');
console.log('   URL:', supabaseUrl ? '✅ Present' : '❌ Missing');
console.log('   Service Key:', supabaseServiceKey ? '✅ Present' : '❌ Missing');

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase credentials in .env file');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function testConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('users').select('count').limit(1);
    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
      return false;
    }
    console.log('✅ Supabase connected');
    return true;
  } catch (err) {
    console.error('❌ Supabase error:', err);
    return false;
  }
}

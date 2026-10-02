// Supabase client. supabase-js is vendored at an exact version (PRD D-39), no CDN at runtime.
// Task 0.4 keeps the existing direct table calls (sb.from(...)) unchanged; task 0.5 replaces
// them with the rpc() wrapper described in PRD §10.3.
import { createClient } from '../vendor/supabase-js-2.117.2.esm.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

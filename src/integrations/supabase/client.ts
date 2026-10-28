import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const missing = [
  !SUPABASE_URL && 'VITE_SUPABASE_URL',
  !SUPABASE_ANON_KEY && 'VITE_SUPABASE_ANON_KEY',
].filter(Boolean);

if (missing.length > 0) {
  throw new Error(
    `Missing Supabase settings: ${missing.join(', ')}. ` +
      'Copy .env.example to .env.local and set the project URL and anon key ' +
      '(Supabase dashboard, Project Settings > API).'
  );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);

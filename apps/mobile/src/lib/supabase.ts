import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
}

// AsyncStorage's web implementation touches `window`, which doesn't exist
// during Expo Router's server-side render — only use it once a DOM/native
// runtime is actually present.
const isClientRuntime = typeof window !== 'undefined' || Platform.OS !== 'web';

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: isClientRuntime ? AsyncStorage : undefined,
    autoRefreshToken: isClientRuntime,
    persistSession: isClientRuntime,
    detectSessionInUrl: false,
  },
});

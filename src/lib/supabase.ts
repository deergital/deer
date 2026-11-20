import {createClient} from '@supabase/supabase-js';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
// Keep the SDK's browser visibility listener: it refreshes suspended sessions.
// Do not manually call startAutoRefresh(), which removes that managed listener.
export const supabase=url&&key?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true}}):null;

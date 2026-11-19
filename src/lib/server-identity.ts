import {NextRequest} from 'next/server';
import {createClient} from '@supabase/supabase-js';
export async function identity(req:NextRequest){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 if(!url||!key)throw new Error('NOT_CONFIGURED');
 const token=req.headers.get('authorization');if(!token?.startsWith('Bearer '))throw new Error('UNAUTHORIZED');
 const db=createClient(url,key,{global:{headers:{Authorization:token}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await db.auth.getUser(token.slice(7));if(error||!data.user)throw new Error('UNAUTHORIZED');
 const profile=await db.from('profiles').select('*').eq('id',data.user.id).single();if(profile.error||!profile.data?.is_enabled)throw new Error('FORBIDDEN');
 return {db,profile:profile.data};
}

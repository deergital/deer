import {NextResponse} from 'next/server';
import {protectedResourceMetadata} from '@/lib/mcp-server';
export const dynamic='force-dynamic';
export function GET(){return NextResponse.json(protectedResourceMetadata(),{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});}

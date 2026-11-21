import {NextRequest,NextResponse} from 'next/server';
import {dispatchMcp,MCP_VERSIONS} from '@/lib/mcp-protocol.mjs';
import {mcpConfiguration,mcpIdentity,mcpService} from '@/lib/mcp-server';
export const dynamic='force-dynamic';
export const runtime='nodejs';
function headers(req:NextRequest){const {base}=mcpConfiguration(),origin=req.headers.get('origin');const result:Record<string,string>={'Cache-Control':'no-store','Vary':'Origin','Access-Control-Expose-Headers':'WWW-Authenticate,MCP-Protocol-Version'};if(origin&&[base,'https://chatgpt.com','https://chat.openai.com'].includes(origin))result['Access-Control-Allow-Origin']=origin;return result;}
function challenge(req:NextRequest,status=401){return NextResponse.json({error:status===401?'Autorización OAuth requerida.':'Acceso MCP no autorizado.'},{status,headers:{...headers(req),'WWW-Authenticate':`Bearer resource_metadata="${mcpConfiguration().base}/.well-known/oauth-protected-resource"`}});}
export async function POST(req:NextRequest){
 const origin=req.headers.get('origin'),h=headers(req);if(origin&&!h['Access-Control-Allow-Origin'])return NextResponse.json({error:'Origen no permitido'},{status:403,headers:h});
 if(!req.headers.get('content-type')?.includes('application/json'))return NextResponse.json({error:'Se requiere JSON'},{status:415,headers:h});
 let auth;try{auth=await mcpIdentity(req);}catch{return challenge(req);}
 const reader=req.body?.getReader();if(!reader)return NextResponse.json({error:'Solicitud vacía'},{status:400,headers:h});let length=0;const chunks:Uint8Array[]=[];while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>900000){await reader.cancel();return NextResponse.json({error:'Solicitud demasiado grande'},{status:413,headers:h});}chunks.push(value);}
 let message;try{const bytes=Buffer.concat(chunks);message=JSON.parse(bytes.toString('utf8'));}catch{return NextResponse.json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}},{status:400,headers:h});}
 const version=req.headers.get('mcp-protocol-version');if(version&&!MCP_VERSIONS.includes(version)&&message?.method!=='initialize')return NextResponse.json({error:'Versión MCP no admitida'},{status:400,headers:h});
 const result=await dispatchMcp(message,mcpService(req,auth.db),{canWrite:auth.canWrite});if(result===null)return new NextResponse(null,{status:202,headers:h});return NextResponse.json(result,{headers:h});
}
export async function GET(req:NextRequest){try{await mcpIdentity(req);}catch{return challenge(req);}return new NextResponse(null,{status:405,headers:{...headers(req),Allow:'POST, OPTIONS'}});}
export async function OPTIONS(req:NextRequest){const h=headers(req);if(req.headers.get('origin')&&!h['Access-Control-Allow-Origin'])return new NextResponse(null,{status:403,headers:h});return new NextResponse(null,{status:204,headers:{...h,'Access-Control-Allow-Methods':'POST, GET, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, MCP-Protocol-Version'}});}

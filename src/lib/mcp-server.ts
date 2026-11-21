import {NextRequest} from 'next/server';
import {identity} from './server-identity';
import {validateMcpClaims} from './mcp-protocol.mjs';
import {summaryContext} from './workspace-summary.mjs';
import {todayCancun} from './domain.mjs';
import {POST as saveData} from '@/app/api/data/route';
import type {Task,Project,Meeting,DocumentIndex} from './types';
export function mcpConfiguration(){const base=(process.env.DEER_PUBLIC_URL||'https://deer-anx0.netlify.app').replace(/\/$/,'');const supabase=(process.env.NEXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'');return {base,resource:base+'/api/mcp',issuer:supabase+'/auth/v1'};}
export function protectedResourceMetadata(){const {resource,issuer,base}=mcpConfiguration();return {resource,authorization_servers:[issuer],scopes_supported:['openid'],bearer_methods_supported:['header'],resource_name:'Deer',resource_documentation:base};}
const tables={task:'tasks',project:'projects',document:'documents',meeting:'meetings'} as const;
const fields={task:'id,title,description,project_id,status,importance,start_date,due_date,completed_at,version,icon,is_important,is_urgent,subtasks,depends_on_person,follow_up_date,created_at,updated_at',project:'id,name,objective,status,version,icon,color,created_at,updated_at',document:'id,title,project_id,parent_id,kind,icon,content_md,created_at,updated_at,version',meeting:'*'};
export async function mcpIdentity(req:NextRequest){const {db,profile}=await identity(req);const token=req.headers.get('authorization')!.slice(7);const verified=await db.auth.getClaims(token);if(verified.error||!verified.data)throw Error('MCP_ACCESS_DENIED');const permissions=validateMcpClaims(verified.data.claims,profile,mcpConfiguration());return {db,profile,...permissions};}
export function mcpService(req:NextRequest,db:Awaited<ReturnType<typeof identity>>['db']){
 async function collect(entity:keyof typeof tables){const rows:Record<string,any>[]=[];let offset=0;while(true){const r=await db.from(tables[entity]).select(fields[entity]).order('id').range(offset,offset+499);if(r.error)throw Error('MCP_READ_FAILED');rows.push(...r.data as unknown as Record<string,any>[]);if(r.data.length<500)break;offset+=500;}return rows;}
 return async(name:string,args:Record<string,any>)=>{
  const entity=args.entity as keyof typeof tables;
  if(name==='deer_list'){let query=db.from(tables[entity]).select(fields[entity],{count:'exact'}).order('id');if(args.project_id&&entity!=='project')query=query.eq('project_id',args.project_id);if(args.status&&entity!=='document')query=query.eq('status',args.status);const offset=args.offset||0,limit=args.limit||50;const result=await query.range(offset,offset+limit-1);if(result.error)throw Error('MCP_READ_FAILED');return {rows:result.data,count:result.count,offset,limit};}
  if(name==='deer_get'){const result=await db.from(tables[entity]).select('*').eq('id',args.id).single();if(result.error||!result.data)throw Error('NOT_FOUND');const {cover_image,...row}=result.data;return {row:{...row,has_cover:Boolean(cover_image)},url:mcpConfiguration().base+'/?entity='+entity+'&id='+args.id};}
  if(name==='deer_write'){const response=await saveData(new NextRequest(req.url.replace(/\/api\/mcp(?:\?.*)?$/,'/api/data'),{method:'POST',headers:{Authorization:req.headers.get('authorization')!,'Content-Type':'application/json'},body:JSON.stringify({kind:entity,request_id:args.request_id,id:args.id??null,expected_version:args.expected_version??null,payload:args.payload})}));const data=await response.json();if(!response.ok)throw Error(typeof data.error==='string'?data.error:'MCP_WRITE_FAILED');const {cover_image,...row}=data.row;return {row:{...row,has_cover:Boolean(cover_image)},saved:true};}
  const [tasks,projects,documents,meetings]=await Promise.all([collect('task'),collect('project'),collect('document'),collect('meeting')]);
  if(name==='deer_summary_context')return {...summaryContext({tasks:tasks as Task[],projects:projects as Project[],documents:documents as DocumentIndex[],meetings:meetings as Meeting[]},todayCancun(),args.period,args.project_id||''),app_url:mcpConfiguration().base};
  const query=args.query.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const hits=[];for(const [rows,type,title,body] of [[tasks,'task','title','description'],[projects,'project','name','objective'],[documents,'document','title','content_md'],[meetings,'meeting','title','notes']] as const){for(const row of rows){const text=(row[title]+' '+row[body]).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();if(text.includes(query))hits.push({id:row.id,type,title:row[title],version:row.version,url:mcpConfiguration().base+'/?entity='+type+'&id='+row.id});}}return {rows:hits.slice(0,50),count:hits.length};
 };
}

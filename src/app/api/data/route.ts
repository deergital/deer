import {NextRequest,NextResponse} from 'next/server';
import {identity} from '@/lib/server-identity';
import {z} from 'zod';
export const dynamic='force-dynamic';
function fail(error:unknown){const message=error instanceof Error?error.message:'SERVICE_ERROR';const status=message==='NOT_CONFIGURED'?503:message==='UNAUTHORIZED'?401:message==='FORBIDDEN'?403:500;return NextResponse.json({error:status===500?'No se pudo completar la operación.':message},{status,headers:{'Cache-Control':'no-store'}});}
export async function GET(req:NextRequest){try{const {db,profile}=await identity(req);const params=req.nextUrl.searchParams;const kind=params.get('kind');
 if(kind==='backup'){
 const {data,error}=await db.rpc('deer_export_backup');
 if(error)return NextResponse.json({error:'No se pudo generar el respaldo. Comprueba que la migración de respaldo está aplicada.'},{status:503,headers:{'Cache-Control':'no-store'}});
 return NextResponse.json(data,{headers:{'Cache-Control':'no-store','Content-Disposition':'attachment; filename="deer-backup.json"'}});
 }
 if(kind==='profile')return NextResponse.json({profile},{headers:{'Cache-Control':'no-store'}});

 if(kind==='document'||kind==='task'||kind==='project'){
 const id=params.get('id');if(!z.uuid().safeParse(id).success)return NextResponse.json({error:'Identificador inválido'},{status:400});
 const table=kind==='document'?'documents':kind==='task'?'tasks':'projects';const {data,error}=await db.from(table).select('*').eq('id',id!).single();if(error||!data)return NextResponse.json({error:'Registro no disponible'},{status:404});return NextResponse.json({row:data},{headers:{'Cache-Control':'no-store'}});
 }
 if(kind==='assets'){const id=params.get('document');if(!z.uuid().safeParse(id).success)return NextResponse.json({error:'Documento inválido'},{status:400});const {data,error}=await db.from('document_assets').select('*').eq('document_id',id!).order('created_at');if(error)throw Error('ASSET_QUERY_ERROR');return NextResponse.json({rows:data},{headers:{'Cache-Control':'no-store'}});}
 if(kind==='backlinks'){const id=params.get('id'),type=params.get('target_type');if(!z.uuid().safeParse(id).success||!['document','task','project'].includes(type||''))return NextResponse.json({error:'Referencia inválida'},{status:400});const links=await db.from('document_links').select('source_id').eq('target_id',id!).eq('target_type',type!);if(links.error)throw Error('LINK_QUERY_ERROR');const ids=[...new Set((links.data||[]).map(l=>l.source_id))];const result=ids.length?await db.from('documents').select('id,title,kind').in('id',ids):{data:[],error:null};if(result.error)throw Error('LINK_QUERY_ERROR');return NextResponse.json({rows:result.data},{headers:{'Cache-Control':'no-store'}});}
 if(kind==='entity-index'){
 const entities=[];for(const [table,type,label] of [['documents','document','title'],['projects','project','name'],['tasks','task','title']] as const){let offset=0;while(true){const r=await db.from(table).select('id,'+label).order('id').range(offset,offset+499);if(r.error)throw Error('INDEX_QUERY_ERROR');const rows=r.data as unknown as Record<string,string>[];entities.push(...rows.map(r=>({id:r.id,type,title:r[label]})));if(rows.length<500)break;offset+=500;}}return NextResponse.json({rows:entities},{headers:{'Cache-Control':'no-store'}});
 }
 if(kind==='documents'){
 const offset=Number(params.get('offset')||0);if(!Number.isInteger(offset)||offset<0||offset>100000)return NextResponse.json({error:'Página inválida'},{status:400});
 let q=db.from('documents').select('*',{count:'exact'}).order('updated_at',{ascending:false}).order('id');
 const project=params.get('project'),type=params.get('document_type');
 if(project==='none')q=q.is('project_id',null);else if(project){if(!z.uuid().safeParse(project).success)return NextResponse.json({error:'Proyecto inválido'},{status:400});q=q.eq('project_id',project);}
 if(type){if(!['note','brief','diagnosis','proposal','meeting','report','reference'].includes(type))return NextResponse.json({error:'Tipo inválido'},{status:400});q=q.eq('kind',type);}
 const {data,count,error}=await q.range(offset,offset+49);if(error)return NextResponse.json({error:'No se pudo cargar la biblioteca. Comprueba la conexión y la migración E2.'},{status:503,headers:{'Cache-Control':'no-store'}});
 return NextResponse.json({rows:data,count},{headers:{'Cache-Control':'no-store'}});
 }
 const offset=Number(params.get('offset')||0);if(!Number.isInteger(offset)||offset<0||offset>100000)return NextResponse.json({error:'Página inválida'},{status:400});
 let q=db.from(kind==='projects'?'projects':'tasks').select('*',{count:'exact'});
 if(kind!=='projects'){
 const project=params.get('project'),status=params.get('status');
 if(project==='none')q=q.is('project_id',null);else if(project){if(!z.uuid().safeParse(project).success)return NextResponse.json({error:'Proyecto inválido'},{status:400});q=q.eq('project_id',project);}
 if(status==='active'||!status)q=q.neq('status','done');else if(status!=='all')q=q.eq('status',status);
 q=q.order('due_date',{ascending:true,nullsFirst:false}).order('id');
 }else q=q.order('updated_at',{ascending:false}).order('id');
 const {data,count,error}=await q.range(offset,offset+49);if(error)throw new Error('QUERY_ERROR');return NextResponse.json({rows:data,count},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return fail(e);}}
const mutation=z.object({kind:z.enum(['task','project','profile','document']),request_id:z.uuid(),payload:z.record(z.string(),z.unknown()),id:z.uuid().nullable(),expected_version:z.number().int().positive().nullable()}).strict();
export async function POST(req:NextRequest){try{const {db}=await identity(req);const raw=await req.text();if(raw.length>70000)return NextResponse.json({error:'Contenido demasiado grande'},{status:413});let json;try{json=JSON.parse(raw);}catch{return NextResponse.json({error:'Formato inválido'},{status:400});}const parsed=mutation.safeParse(json);if(!parsed.success)return NextResponse.json({error:'Datos de guardado inválidos'},{status:400});
 const v=parsed.data;const {data,error}=await db.rpc(v.kind==='document'?'deer_document_mutate':'deer_mutate',{...(v.kind==='document'?{}:{p_kind:v.kind}),p_request_id:v.request_id,p_payload:v.payload,p_id:v.id,p_expected_version:v.expected_version});
 if(error){const conflict=error.message.includes('CONFLICT');const denied=error.code==='42501';return NextResponse.json({error:error.message.startsWith('DEER_')?error.message:'Revisa los campos y vuelve a intentar.'},{status:conflict?409:denied?403:400});}return NextResponse.json({row:data},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return fail(e);}}

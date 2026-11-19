'use client';
import {useEffect,useRef,useState} from 'react';
import {Alert,Button,Chip,MenuItem,TextField} from '@mui/material';
import type {Project} from '@/lib/types';

const kinds={note:'Nota',brief:'Brief',diagnosis:'Diagnóstico',proposal:'Propuesta',meeting:'Reunión',report:'Informe',reference:'Referencia'};
type Kind=keyof typeof kinds;
type Doc={id:string;owner_id:string;project_id:string|null;title:string;kind:Kind;content_md:string;version:number;created_at:string;updated_at:string};
const blank={title:'',project_id:'',kind:'note' as Kind,content_md:''};

// Conservative renderer: React text nodes only, never HTML injection. Unsupported
// syntax remains visible verbatim and is retained in the Markdown source.
function inline(text:string){return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g).map((part,i)=>{
 if(part.startsWith('**')&&part.endsWith('**'))return <strong key={i}>{part.slice(2,-2)}</strong>;
 if(part.startsWith('`')&&part.endsWith('`'))return <code key={i}>{part.slice(1,-1)}</code>;
 const link=part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
 return link?<a key={i} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>:part;
});}
function Reading({text}:{text:string}){
 const lines=text.replaceAll('\r\n','\n').split('\n');const blocks:React.ReactNode[]=[];
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  if(line.startsWith('```')){const code=[];while(++i<lines.length&&!lines[i].startsWith('```'))code.push(lines[i]);blocks.push(<pre key={i}><code>{code.join('\n')}</code></pre>);continue;}
  const h=line.match(/^(#{1,3}) (.*)$/);
  if(h){const content=inline(h[2]);blocks.push(h[1].length===1?<h1 key={i}>{content}</h1>:h[1].length===2?<h2 key={i}>{content}</h2>:<h3 key={i}>{content}</h3>);continue;}
  if(/^[-*] /.test(line)){const items=[];const start=i;while(i<lines.length&&/^[-*] /.test(lines[i])){items.push(<li key={i}>{inline(lines[i].slice(2))}</li>);i++;}i--;blocks.push(<ul key={start}>{items}</ul>);continue;}
  if(line.startsWith('> ')){blocks.push(<blockquote key={i}>{inline(line.slice(2))}</blockquote>);continue;}
  blocks.push(line?<p key={i}>{inline(line)}</p>:<br key={i}/>);
 }
 return <article className="document-reading">{text?blocks:<p className="muted">El documento está vacío.</p>}</article>;
}

export function Documents({projects,api,demo,onDirty}:{projects:Project[];api:(path:string,body?:unknown)=>Promise<any>;demo:boolean;onDirty:(dirty:boolean)=>void}){
 const [docs,setDocs]=useState<Doc[]>([]),[project,setProject]=useState(''),[kind,setKind]=useState(''),[offset,setOffset]=useState(0),[total,setTotal]=useState(0);
 const [selected,setSelected]=useState<Doc|null|undefined>(undefined),[form,setForm]=useState(blank),[saved,setSaved]=useState(blank);
 const [mode,setMode]=useState<'markdown'|'reading'>('markdown'),[busy,setBusy]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const request=useRef<{signature:string;id:string}|null>(null),sequence=useRef(0),input=useRef<HTMLTextAreaElement|null>(null);
 const dirty=JSON.stringify(form)!==JSON.stringify(saved);
 useEffect(()=>{onDirty(dirty);},[dirty]);
 async function load(){const seq=++sequence.current;if(demo)return;setBusy(true);setError('');try{const result=await api('?kind=documents&'+new URLSearchParams({project,document_type:kind,offset:String(offset)}));if(seq===sequence.current){setDocs(result.rows);setTotal(result.count);}}catch(e){if(seq===sequence.current)setError(e instanceof Error?e.message:'No se pudo cargar la biblioteca.');}finally{if(seq===sequence.current)setBusy(false);}}
 useEffect(()=>{void load();return()=>{sequence.current++;};},[project,kind,offset]);
 useEffect(()=>{const handler=(e:BeforeUnloadEvent)=>{if(dirty){e.preventDefault();}};window.addEventListener('beforeunload',handler);return()=>window.removeEventListener('beforeunload',handler);},[dirty]);
 function open(doc:Doc|null){if(dirty&&!window.confirm('Hay cambios sin guardar. ¿Descartarlos?'))return;const data=doc?{title:doc.title,project_id:doc.project_id||'',kind:doc.kind,content_md:doc.content_md}:blank;setSelected(doc);setForm(data);setSaved(data);setMode(doc?'reading':'markdown');setError('');setNotice('');request.current=null;}
 function close(){if(saving)return;if(dirty&&!window.confirm('Hay cambios sin guardar. ¿Descartarlos?'))return;setSaved(form);setSelected(undefined);setError('');}
 async function save(){if(demo)return;const title=form.title.trim();if(!title||title.length>240||form.content_md.length>50000){setError('Escribe un título de 1 a 240 caracteres y un contenido de hasta 50,000.');return;}
  setSaving(true);setError('');setNotice('');const payload={...form,title,project_id:form.project_id||null};const signature=JSON.stringify([payload,selected?.id,selected?.version]);if(request.current?.signature!==signature)request.current={signature,id:crypto.randomUUID()};
  try{const result=await api('',{kind:'document',request_id:request.current.id,payload,id:selected?.id??null,expected_version:selected?.version??null});const row=result.row as Doc;const data={title:row.title,project_id:row.project_id||'',kind:row.kind,content_md:row.content_md};setSelected(row);setForm(data);setSaved(data);request.current=null;await load();setNotice('Documento guardado.');}
  catch(e){const message=e instanceof Error?e.message:'No se pudo guardar.';setError(message.includes('VERSION_CONFLICT')?'Existe una versión más reciente. Tu borrador sigue aquí. Copia tus cambios, vuelve a la biblioteca y recarga antes de abrir el documento.':message);}finally{setSaving(false);}
 }
 function insert(before:string,after=''){const node=input.current;const start=node?.selectionStart??form.content_md.length,end=node?.selectionEnd??start;setForm({...form,content_md:form.content_md.slice(0,start)+before+form.content_md.slice(start,end)+after+form.content_md.slice(end)});}
 async function importMd(file:File|undefined){if(!file)return;if(!/\.md$/i.test(file.name)||file.size>200000){setError('Selecciona un archivo .md de hasta 200 KB (máximo 50,000 caracteres).');return;}try{const text=await file.text();if(text.length>50000)throw new Error('El documento excede 50,000 caracteres.');setForm({...form,title:form.title||file.name.replace(/\.md$/i,''),content_md:text});setNotice('Markdown importado como borrador. Pulsa Guardar para conservarlo.');}catch(e){setError(e instanceof Error?e.message:'No se pudo importar.');}}
 function exportMd(){const url=URL.createObjectURL(new Blob([form.content_md],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=(form.title.replace(/[^\p{L}\p{N}\s_-]/gu,'').slice(0,100)||'documento')+'.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
 return <section className="documents">
 {demo&&<Alert severity="info">Conecta Supabase para guardar documentos. Esta biblioteca no simula persistencia.</Alert>}
 {error&&<Alert severity="error">{error}</Alert>}{notice&&<Alert severity="success">{notice}</Alert>}
 {selected===undefined?<>
 <div className="task-toolbar"><TextField select label="Proyecto documental" value={project} onChange={e=>{setProject(e.target.value);setOffset(0);}}><MenuItem value="">Todos</MenuItem><MenuItem value="none">Sin proyecto</MenuItem>{projects.map(p=><MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}</TextField><TextField select label="Tipo de documento" value={kind} onChange={e=>{setKind(e.target.value);setOffset(0);}}><MenuItem value="">Todos</MenuItem>{Object.entries(kinds).map(([value,label])=><MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField><Button variant="contained" disabled={demo||busy} onClick={()=>open(null)}>Nuevo documento</Button><Button disabled={busy||demo} onClick={()=>void load()}>Actualizar biblioteca</Button></div>
 {busy?<p role="status">Cargando documentos…</p>:docs.length?<div className="project-grid">{docs.map(d=><section className="panel" key={d.id}><Chip size="small" label={kinds[d.kind]}/><h2>{d.title}</h2><p className="muted">{projects.find(p=>p.id===d.project_id)?.name||'Sin proyecto'} · Versión {d.version}</p><Button onClick={()=>open(d)}>Abrir documento</Button></section>)}</div>:<div className="panel empty"><h2>{error?'Biblioteca no disponible':'No hay documentos en esta vista'}</h2><p>{error?'Pulsa Actualizar biblioteca para reintentar.':'Crea un documento o cambia los filtros.'}</p></div>}
 <div className="pagination"><small>{docs.length} de {total} documentos</small><Button disabled={!offset||busy} onClick={()=>setOffset(offset-50)}>Anterior</Button><Button disabled={offset+50>=total||busy} onClick={()=>setOffset(offset+50)}>Siguiente</Button></div>
 </>:<section className="panel document-editor"><div className="section-heading"><Button disabled={saving} onClick={close}>Volver a biblioteca</Button><span role="status">{saving?'Guardando…':dirty?'Cambios sin guardar':selected?'Versión '+selected.version:'Nuevo documento'}</span><Button variant="contained" disabled={saving||!dirty||demo} onClick={()=>void save()}>Guardar documento</Button></div>
 <TextField label="Título del documento" required fullWidth value={form.title} disabled={saving} onChange={e=>setForm({...form,title:e.target.value})}/>
 <div className="document-meta"><TextField select label="Proyecto vinculado" value={form.project_id} disabled={saving} onChange={e=>setForm({...form,project_id:e.target.value})}><MenuItem value="">Sin proyecto</MenuItem>{projects.filter(p=>p.status!=='closed'||p.id===form.project_id).map(p=><MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}</TextField><TextField select label="Clasificación" value={form.kind} disabled={saving} onChange={e=>setForm({...form,kind:e.target.value as Kind})}>{Object.entries(kinds).map(([value,label])=><MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField></div>
 <div className="toolbar"><Button variant={mode==='markdown'?'contained':'text'} onClick={()=>setMode('markdown')}>Markdown</Button><Button variant={mode==='reading'?'contained':'text'} onClick={()=>setMode('reading')}>Lectura</Button><Button component="label" disabled={saving}>Importar .md<input type="file" accept=".md,text/markdown" hidden onChange={e=>{void importMd(e.target.files?.[0]);e.target.value='';}}/></Button><Button onClick={exportMd}>Exportar .md</Button></div>
 {mode==='markdown'?<><div className="toolbar"><Button disabled={saving} onClick={()=>insert('## ')}>Encabezado</Button><Button disabled={saving} onClick={()=>insert('**','**')}>Negrita</Button><Button disabled={saving} onClick={()=>insert('- ')}>Lista</Button><Button disabled={saving} onClick={()=>insert('> ')}>Cita</Button></div><TextField label="Contenido Markdown" multiline minRows={16} fullWidth inputRef={input} value={form.content_md} disabled={saving} onChange={e=>setForm({...form,content_md:e.target.value})} helperText={`${form.content_md.length} / 50,000 caracteres. Guardado manual.`}/></>:<Reading text={form.content_md}/>}
 <p className="muted">Primera entrega documental: encabezados, negrita, listas, citas, código y enlaces HTTP/HTTPS en lectura. Otra sintaxis permanece como texto. El editor visual, imágenes, adjuntos, tablas, Mermaid y enlaces internos se incorporarán en las siguientes entregas de E2.</p>
 </section>}
 </section>;
}

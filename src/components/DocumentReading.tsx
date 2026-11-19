'use client';
import {useEffect,useId,useState} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {Alert,Button} from '@mui/material';
import {assetId,internalTarget} from '@/lib/document-format.mjs';
import {getAsset,downloadAsset} from '@/lib/document-files';
export type Entity={id:string;type:string;title:string};
export type Navigate=(type:string,id:string)=>void;

export function PrivateImage({src,alt='',title}:{src?:string;alt?:string;title?:string}){
 const [url,setUrl]=useState(''),[error,setError]=useState('');
 useEffect(()=>{let active=true;setError('');setUrl('');const id=assetId(src);if(id)getAsset(id).then(a=>{if(active)setUrl(a.url);}).catch(()=>{if(active)setError('Imagen privada no disponible.');});else if(/^https?:\/\//i.test(src||''))setUrl(src!);else setError('Imagen no disponible.');return()=>{active=false;};},[src]);
 return <span className="document-figure">{error?<span role="status">{error}</span>:url?<img src={url} alt={alt} referrerPolicy="no-referrer" loading="lazy" onError={()=>setError('No se pudo cargar la imagen. Reabre el documento para renovar el acceso.')}/>:<span>Cargando imagen…</span>}{title&&<span className="image-caption">{title}</span>}</span>;
}
export function MermaidBlock({code}:{code:string}){const key=useId().replace(/[^a-z0-9]/gi,'');const [svg,setSvg]=useState(''),[error,setError]=useState('');useEffect(()=>{let active=true;setSvg('');setError('');void (async()=>{try{const {default:mermaid}=await import('mermaid');mermaid.initialize({startOnLoad:false,securityLevel:'strict',suppressErrorRendering:true,maxTextSize:50000,flowchart:{htmlLabels:false}});const result=await mermaid.render('deer'+key,code);if(active)setSvg(result.svg);}catch{if(active)setError('No se pudo dibujar el diagrama. Revisa su código Mermaid.');}})();return()=>{active=false;};},[code,key]);return error?<Alert severity="warning">{error}<pre>{code}</pre></Alert>:<span className="mermaid-render" role="img" aria-label="Diagrama Mermaid" dangerouslySetInnerHTML={{__html:svg}}/>;}
function AssetLink({id,label}:{id:string;label:React.ReactNode}){const [error,setError]=useState('');return <><Button size="small" onClick={()=>{setError('');void downloadAsset(id).catch(()=>setError('Archivo no disponible.'));}}>{label}</Button>{error&&<span role="status">{error}</span>}</>;}
export function DocumentReading({text,entities,onNavigate}:{text:string;entities:Entity[];onNavigate:Navigate}){return <article className="document-reading"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={url=>/^(https?:\/\/|mailto:|deer:\/\/|deer-asset:|#)/i.test(url)?url:''} components={{
 img:({src,alt,title})=><PrivateImage src={typeof src==='string'?src:''} alt={alt} title={title}/>,
 a:({href,children})=>{const target=internalTarget(href);if(target){const title=entities.find(e=>e.id===target.id&&e.type===target.type)?.title;return <button type="button" className="internal-reference" onClick={()=>onNavigate(target.type,target.id)}>{title||children}</button>;}const file=assetId(href);return file?<AssetLink id={file} label={children}/>:<a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;},
 code:({className,children})=>className==='language-mermaid'?<MermaidBlock code={String(children).replace(/\n$/,'')}/>:<code className={className}>{children}</code>,
 blockquote:({children,node})=>{const first=(node?.children?.find((child:any)=>child.tagName==='p') as any)?.children?.[0]?.value||'';const marker=first.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING)\]/);return <blockquote className={marker?'callout callout-'+marker[1].toLowerCase():''}>{children}</blockquote>;},
 table:({children})=><div className="document-table-scroll"><table>{children}</table></div>,
 }}>{text}</ReactMarkdown>{!text&&<p className="muted">El documento está vacío.</p>}</article>;}

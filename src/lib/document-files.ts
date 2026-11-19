import JSZip from 'jszip';
import {buildDocumentPackage,readDocumentPackage} from './document-package.mjs';
import {supabase} from './supabase';
import {assetType,replaceAssetIds} from './document-format.mjs';
export type Asset={id:string;document_id:string;name:string;mime_type:string;size_bytes:number;sha256:string;storage_path:string};
export async function authFetch(path:string,options:RequestInit={}){const session=await supabase!.auth.getSession();const response=await fetch(path,{...options,headers:{...options.headers,Authorization:'Bearer '+session.data.session?.access_token}});if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.error||'No se pudo completar la operación.');}return response;}
export async function getAsset(id:string,download=false):Promise<Asset&{url:string}>{return (await authFetch('/api/assets?id='+id+(download?'&download=1':''))).json();}
export async function fileHash(bytes:ArrayBuffer){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');}
export async function uploadAsset(file:File,documentId:string):Promise<Asset>{
 const mime=assetType(file.name,file.size),id=crypto.randomUUID();const session=await supabase!.auth.getUser();if(!session.data.user)throw Error('Inicia sesión de nuevo.');const path=session.data.user.id+'/'+id;
 const bytes=await file.arrayBuffer(),hash=await fileHash(bytes);
 const result=await supabase!.storage.from('deer-private').upload(path,bytes,{contentType:mime,upsert:false});if(result.error)throw Error('No se pudo subir el archivo: '+result.error.message);
 // If registering fails, the immutable Storage object stays private. Retry the
 // metadata request with this same ID rather than uploading another object.
 const body=JSON.stringify({id,document_id:documentId,name:file.name,size_bytes:file.size,sha256:hash});let last:unknown;
 for(let i=0;i<2;i++){try{return (await (await authFetch('/api/assets',{method:'POST',headers:{'Content-Type':'application/json'},body})).json()).row;}catch(e){last=e;}}
 throw Error('El archivo se subió pero no pudo registrarse. No se insertó en el documento. '+(last instanceof Error?last.message:''));
}
export async function assetBytes(asset:Asset){const signed=await getAsset(asset.id);const response=await fetch(signed.url);if(!response.ok)throw Error('No se pudo descargar '+asset.name);const bytes=await response.arrayBuffer();if(bytes.byteLength!==asset.size_bytes||await fileHash(bytes)!==asset.sha256)throw Error('Integridad incorrecta: '+asset.name);return bytes;}
export function downloadBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
export async function downloadAsset(id:string){const asset=await getAsset(id);const bytes=await assetBytes(asset);downloadBlob(new Blob([bytes],{type:asset.mime_type}),asset.name);}
export async function exportDocument(md:string,title:string,assets:Asset[]){const bytes=await buildDocumentPackage(md,title,assets,assetBytes);downloadBlob(new Blob([bytes as BlobPart],{type:'application/zip'}),safeName(title)+'.zip');}
export function safeName(name:string){return name.replace(/[^\p{L}\p{N}\s_-]/gu,'').slice(0,100)||'documento';}
export async function importDocumentPackage(file:File,docId:string){const parsed=await readDocumentPackage(await file.arrayBuffer());let md=parsed.md;for(const {asset:a,bytes} of parsed.resources){const asset=await uploadAsset(new File([bytes as BlobPart],a.name,{type:a.mime_type}),docId);md=md.replaceAll(a.path,'deer-asset:'+asset.id);}return {md,title:parsed.title};}
export async function exportFullBackup(backup:any){if((backup.document_assets||[]).reduce((n:number,a:Asset)=>n+a.size_bytes,0)>100*1024*1024)throw Error('Este respaldo supera el límite de descarga de 100 MB. Requiere exportación por lotes.');const zip=new JSZip();zip.file('backup.json',JSON.stringify(backup,null,2));for(const asset of backup.document_assets||[]){zip.file('assets/'+asset.id,await assetBytes(asset));}downloadBlob(await zip.generateAsync({type:'blob'}),'deer-respaldo-'+new Date().toISOString().slice(0,10)+'.zip');}

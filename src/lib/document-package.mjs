import JSZip from 'jszip';
import {assetType} from './document-format.mjs';
import {validateRichDocument} from './rich-document.mjs';
export async function hashBytes(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');}
export function boundedEntry(entry,limit){return new Promise((resolve,reject)=>{let size=0;const chunks=[];const stream=entry.internalStream('uint8array');stream.on('data',chunk=>{size+=chunk.length;if(size>limit){stream.pause();reject(Error('El paquete excede el tamaño permitido.'));}else chunks.push(chunk);}).on('error',reject).on('end',()=>{const bytes=new Uint8Array(size);let p=0;for(const c of chunks){bytes.set(c,p);p+=c.length;}resolve(bytes);}).resume();});}
export async function buildDocumentPackage(md,title,assets,readAsset,rich=/** @type {any} */(null)){
 if(assets.length>20||assets.reduce((n,a)=>n+a.size_bytes,0)>20*1024*1024)throw Error('El paquete admite hasta 20 recursos y 20 MB.');
 const zip=new JSZip(),manifest=[];let portable=md;
 for(const a of assets){assetType(a.name,a.size_bytes);const path='resources/'+a.id+'.'+a.name.split('.').pop().toLowerCase(),bytes=await readAsset(a);if(bytes.byteLength!==a.size_bytes||await hashBytes(bytes)!==a.sha256)throw Error('Recurso alterado: '+a.name);zip.file(path,bytes);portable=portable.replaceAll('deer-asset:'+a.id,path);manifest.push({...a,path});}
 if(rich){validateRichDocument(rich);zip.file('document.json',JSON.stringify(rich));}
 zip.file('document.md',portable);zip.file('manifest.json',JSON.stringify({format:'deer-document-package',version:rich?2:1,title,assets:manifest},null,2));return zip.generateAsync({type:'uint8array'});
}
export async function readDocumentPackage(bytes){
 if(bytes.byteLength>20*1024*1024)throw Error('Paquete máximo: 20 MB.');
 const zip=await JSZip.loadAsync(bytes),manifestEntry=zip.file('manifest.json'),documentEntry=zip.file('document.md');
 if(!manifestEntry||!documentEntry)throw Error('Faltan manifest.json o document.md.');
 const manifest=JSON.parse(new TextDecoder().decode(await boundedEntry(manifestEntry,100000)));
 if(manifest.format!=='deer-document-package'||![1,2].includes(manifest.version)||!Array.isArray(manifest.assets)||manifest.assets.length>20)throw Error('Paquete no compatible.');
 const md=new TextDecoder().decode(await boundedEntry(documentEntry,200000));if(md.length>50000)throw Error('Documento demasiado largo.');
 let total=0;const ids=new Set(),paths=new Set(),resources=[];
 for(const a of manifest.assets){
  if(typeof a.id!=='string'||!/^resources\/[a-f0-9-]{36}\.[a-z0-9]+$/i.test(a.path)||!a.path.startsWith('resources/'+a.id+'.')||ids.has(a.id)||paths.has(a.path))throw Error('Ruta de recurso inválida.');ids.add(a.id);paths.add(a.path);
  const entry=zip.file(a.path);if(!entry||entry.unsafeOriginalName&&entry.unsafeOriginalName!==a.path)throw Error('Recurso ausente o ruta insegura.');
  const content=await boundedEntry(entry,4194304);total+=content.byteLength;if(total>20*1024*1024)throw Error('Recursos: máximo 20 MB.');assetType(a.name,content.byteLength);
  if(content.byteLength!==a.size_bytes||await hashBytes(content.buffer)!==a.sha256)throw Error('Recurso alterado: '+a.name);resources.push({asset:a,bytes:content});
 }
 const known=new Set(manifest.assets.map(a=>a.path));for(const m of md.matchAll(/resources\/[a-f0-9-]{36}\.[a-z0-9]+/gi))if(!known.has(m[0]))throw Error('Referencia sin recurso: '+m[0]);
 let rich=null;if(manifest.version===2){const entry=zip.file('document.json');if(!entry)throw Error('Falta el contenido enriquecido.');rich=JSON.parse(new TextDecoder().decode(await boundedEntry(entry,500000)));validateRichDocument(rich);for(const match of JSON.stringify(rich).matchAll(/deer-asset:([a-f0-9-]{36})/gi))if(!ids.has(match[1]))throw Error('Referencia enriquecida sin recurso.');}
 return {md,rich,title:String(manifest.title||'Documento importado'),resources};
}

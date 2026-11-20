import type {JSONContent} from '@tiptap/core';
import {assetBytes,getAsset,downloadBlob,safeName} from './document-files';
import {assetId} from './document-format.mjs';
import {normalizeRichDocument} from './rich-document.mjs';

async function imagesFor(json:JSONContent){
 const sources=new Set<string>();function walk(node:JSONContent){if(node.type==='image'&&node.attrs?.src)sources.add(node.attrs.src);node.content?.forEach(walk);}walk(json);
 const images:Record<string,{data:Uint8Array;dataUrl:string;width:number;height:number}>={};
 for(const src of sources){
  const id=assetId(src);let blob:Blob;
  if(id){const asset=await getAsset(id);blob=new Blob([await assetBytes(asset)],{type:asset.mime_type});}
  else {const response=await fetch(src,{referrerPolicy:'no-referrer'});if(!response.ok)throw Error('No se pudo descargar una imagen externa. Adjunta una copia para exportar.');blob=await response.blob();}
  const bitmap=await createImageBitmap(blob);if(bitmap.width>20000||bitmap.height>20000){bitmap.close();throw Error('Una imagen tiene dimensiones demasiado grandes para exportar.');}
  const ratio=Math.min(1,1500/bitmap.width,1800/bitmap.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
  const dataUrl=canvas.toDataURL('image/png'),data=Uint8Array.from(atob(dataUrl.split(',')[1]),c=>c.charCodeAt(0));images[src]={data,dataUrl,width:canvas.width,height:canvas.height};
 }
 return images;
}
function base64(bytes:ArrayBuffer){let text='';for(const chunk of new Uint8Array(bytes))text+=String.fromCharCode(chunk);return btoa(text);}
let fontFiles:Promise<Record<string,string>>|undefined;
function loadFonts(){return fontFiles??=Promise.all(['regular','bold','italic','bold-italic'].map(async name=>{const r=await fetch('/fonts/deer-text-'+name+'.ttf');if(!r.ok)throw Error('No se pudieron cargar las fuentes del PDF.');return ['deer-text-'+name+'.ttf',base64(await r.arrayBuffer())];})).then(async entries=>{const response=await fetch('/fonts/pdf-standard-metrics.json');if(!response.ok)throw Error('No se pudieron cargar las fuentes estándar.');return {...Object.fromEntries(entries),...await response.json()};});}
export async function exportWordDocument(format:'docx'|'pdf',content:JSONContent,title:string){
 const json=normalizeRichDocument(content),images=await imagesFor(json),name=safeName(title);
 if(format==='docx'){const {buildDocx}=await import('./document-export.mjs');const bytes=await buildDocx(json,title,images);downloadBlob(new Blob([new Uint8Array(bytes)],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}),name+'.docx');return;}
 const [{default:pdfMake},{richToPdfDefinition}]=await Promise.all([import('pdfmake/build/pdfmake'),import('./document-export.mjs')]);
 pdfMake.addVirtualFileSystem(await loadFonts());pdfMake.addFonts({Manrope:{normal:'deer-text-regular.ttf',bold:'deer-text-bold.ttf',italics:'deer-text-italic.ttf',bolditalics:'deer-text-bold-italic.ttf'},Arial:{normal:'Helvetica',bold:'Helvetica-Bold',italics:'Helvetica-Oblique',bolditalics:'Helvetica-BoldOblique'},Georgia:{normal:'Times-Roman',bold:'Times-Bold',italics:'Times-Italic',bolditalics:'Times-BoldItalic'},'Times New Roman':{normal:'Times-Roman',bold:'Times-Bold',italics:'Times-Italic',bolditalics:'Times-BoldItalic'},'Courier New':{normal:'Courier',bold:'Courier-Bold',italics:'Courier-Oblique',bolditalics:'Courier-BoldOblique'}});
 const definition=richToPdfDefinition(json,title,images);
 const blob=await new Promise<Blob>((resolve,reject)=>{try{const stream=pdfMake.createPdf(definition).getStream({}),chunks:Uint8Array[]=[];stream.on('data',(chunk:Uint8Array)=>chunks.push(new Uint8Array(chunk)));stream.on('error',reject);stream.on('end',()=>resolve(new Blob(chunks as BlobPart[],{type:'application/pdf'})));stream.end();}catch(e){reject(e);}});downloadBlob(blob,name+'.pdf');
}

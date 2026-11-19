export const MAX_FILE_BYTES=4*1024*1024;
export const fileTypes={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',pdf:'application/pdf',txt:'text/plain',md:'text/markdown',zip:'application/zip',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'};
export function assetType(name,size){const ext=name.split('.').pop()?.toLowerCase();if(!ext||!fileTypes[ext]||size<1||size>MAX_FILE_BYTES||name.length>240)throw new Error('Archivo no admitido. Usa imágenes PNG/JPG/WebP/GIF, PDF, TXT, MD, ZIP u Office, de hasta 4 MB.');return fileTypes[ext];}
export function internalTarget(href){const m=href?.match(/^deer:\/\/(document|project|task)\/([a-f0-9-]{36})$/i);return m?{type:m[1],id:m[2]}:null;}
export function assetId(src){return src?.match(/^deer-asset:([a-f0-9-]{36})$/i)?.[1]??null;}
// Keep raw/unknown syntax out of the visual conversion instead of silently
// normalizing it. Markdown mode always keeps the original source.
export function visualWarnings(md){const warnings=[];if(/<\/?[a-z][^>]*>/i.test(md))warnings.push('HTML');if(/^---\s*\n/.test(md))warnings.push('metadatos YAML');if(/!?(?:\[\^|\[\[[^\]]+\]\])/.test(md))warnings.push('notas o sintaxis wiki');if(/(?:^|\n)\s*\[([^\]]+)\]:/.test(md))warnings.push('enlaces de referencia');if(/^(?: {4}|\t)\S/m.test(md))warnings.push('bloques con sangría');if(/\$\$|\\\(|\\\[/.test(md))warnings.push('fórmulas');return warnings;}
export function replaceAssetIds(md,mapping){return md.replace(/deer-asset:([a-f0-9-]{36})/gi,(full,id)=>mapping[id]?'deer-asset:'+mapping[id]:full);}
export function normalizeVisualMarkdown(md){return md.replace(/^(>\s*)\\\[!(NOTE|TIP|IMPORTANT|WARNING)\\\]/gm,'$1[!$2]');}

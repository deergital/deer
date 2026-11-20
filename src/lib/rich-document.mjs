export const DOCUMENT_FONTS=['Manrope','Arial','Georgia','Times New Roman','Courier New'];
export function stableJson(value){if(Array.isArray(value))return '['+value.map(stableJson).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stableJson(value[key])).join(',')+'}';return JSON.stringify(value);}
const nodes=new Set(['doc','text','paragraph','heading','bulletList','orderedList','listItem','taskList','taskItem','blockquote','codeBlock','hardBreak','horizontalRule','image','table','tableRow','tableCell','tableHeader']);
const marks=new Set(['bold','italic','underline','strike','code','link','textStyle']);
const hex=/^#[0-9a-f]{6}$/i;
export function validateRichDocument(json){
 if(json===null)return;
 if(!json||json.type!=='doc'||JSON.stringify(json).length>500000)throw Error('Documento enriquecido inválido o demasiado grande.');
 let count=0,characters=0;
 function walk(node,depth){
  if(!node||depth>30||++count>15000||!nodes.has(node.type))throw Error('Estructura documental no admitida.');
  if(node.text!==undefined){if(typeof node.text!=='string')throw Error('Texto inválido.');characters+=node.text.length;}
  const attrs=node.attrs||{};
  if(attrs.textAlign&&!['left','right','center','justify'].includes(attrs.textAlign))throw Error('Alineación inválida.');
  if(node.type==='heading'&&![1,2,3,4,5,6].includes(attrs.level))throw Error('Encabezado inválido.');
  if(node.type==='image'&&!/^(deer-asset:[a-f0-9-]{36}|https:\/\/[^\s]+)$/i.test(attrs.src||''))throw Error('Imagen no admitida. Adjunta el archivo desde Deer.');
  for(const name of ['backgroundColor','borderColor'])if(attrs[name]&&!hex.test(attrs[name]))throw Error('Color de tabla inválido.');
  if(['tableCell','tableHeader'].includes(node.type))for(const name of ['colspan','rowspan'])if(attrs[name]!=null&&(!Number.isInteger(attrs[name])||attrs[name]<1||attrs[name]>50))throw Error('Combinación de celdas inválida.');
  for(const mark of node.marks||[]){
   if(!marks.has(mark.type))throw Error('Formato no admitido.');const a=mark.attrs||{};
   if(mark.type==='link'&&!/^(https?:\/\/|mailto:|deer:\/\/(document|project|task)\/|deer-asset:|#)/i.test(a.href||''))throw Error('Enlace no admitido.');
   if(mark.type==='textStyle'){
    if(a.fontFamily&&!DOCUMENT_FONTS.includes(a.fontFamily))throw Error('Fuente no admitida.');
    if(a.fontSize&&!/^(?:[8-9]|[1-6][0-9]|7[0-2])(?:px|pt)$/.test(a.fontSize))throw Error('Tamaño de texto inválido.');
    for(const key of ['color','backgroundColor'])if(a[key]&&!hex.test(a[key]))throw Error('Color de texto inválido.');
   }
  }
  if(node.content!==undefined&&!Array.isArray(node.content))throw Error('Contenido inválido.');
  for(const child of node.content||[])walk(child,depth+1);
 }
 walk(json,0);if(characters>50000)throw Error('El documento admite hasta 50,000 caracteres.');
}
export function richText(json){if(!json)return '';return (json.text||'')+(json.content||[]).map(richText).join(['doc','table','tableRow','bulletList','orderedList'].includes(json.type)?'\n':'');}
export function normalizeRichDocument(json){const copy=JSON.parse(JSON.stringify(json));function walk(node){if(node.attrs){for(const key of ['color','backgroundColor','borderColor']){const value=node.attrs[key];if(value){const rgb=value.match(/^rgba?\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)/i);if(rgb)node.attrs[key]='#'+rgb.slice(1,4).map(v=>Math.min(255,Number(v)).toString(16).padStart(2,'0')).join('');else if(/^#[0-9a-f]{3}$/i.test(value))node.attrs[key]='#'+value.slice(1).split('').map(c=>c+c).join('');else if(!hex.test(value))node.attrs[key]=null;}}if(node.attrs.fontFamily){const family=node.attrs.fontFamily.replace(/["']/g,'').split(',')[0].trim();node.attrs.fontFamily=DOCUMENT_FONTS.includes(family)?family:'Manrope';}}for(const mark of node.marks||[])walk(mark);for(const child of node.content||[])walk(child);}walk(copy);return copy;}
export function remapRichAssets(json,mapping){if(!json)return null;const copy=JSON.parse(JSON.stringify(json));function walk(node){for(const key of ['src','href'])if(node.attrs?.[key])node.attrs[key]=node.attrs[key].replace(/deer-asset:([a-f0-9-]{36})/gi,(full,id)=>mapping[id]?'deer-asset:'+mapping[id]:full);for(const mark of node.marks||[])walk(mark);for(const child of node.content||[])walk(child);}walk(copy);return copy;}

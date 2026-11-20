'use client';
import {useEffect,useRef,useState} from 'react';
import {EditorContent,useEditor,NodeViewWrapper,ReactNodeViewRenderer,type NodeViewProps,type Editor,type JSONContent} from '@tiptap/react';
import Image from '@tiptap/extension-image';
import {IconButton,Tooltip,Divider} from '@mui/material';
import {FormatBold,FormatItalic,FormatUnderlined,StrikethroughS,FormatAlignLeft,FormatAlignCenter,FormatAlignRight,FormatAlignJustify,FormatListBulleted,FormatListNumbered,FormatQuote,Code,HorizontalRule,ImageOutlined,TableChart,Link,Undo,Redo,FormatClear,Add,Remove,MergeType,CallSplit,DeleteOutlined} from '@mui/icons-material';
import {wordExtensions} from '@/lib/editor-extensions';
import {normalizeVisualMarkdown,visualWarnings,internalTarget,assetId} from '@/lib/document-format.mjs';
import {DOCUMENT_FONTS,normalizeRichDocument,validateRichDocument} from '@/lib/rich-document.mjs';
import {downloadAsset} from '@/lib/document-files';
import type {Navigate} from './DocumentReading';
import {PrivateImage} from './DocumentReading';
function ImageView({node}:NodeViewProps){return <NodeViewWrapper><PrivateImage src={node.attrs.src} alt={node.attrs.alt} title={node.attrs.title}/></NodeViewWrapper>;}
const PrivateImageExtension=Image.extend({addNodeView(){return ReactNodeViewRenderer(ImageView);}});
type Props={value:string;rich:JSONContent|null;onChange:(json:JSONContent,markdown:string)=>void;disabled:boolean;onReady:(editor:Editor|null)=>void;onImage:()=>void;onImagePaste:(file:File)=>void;onError:(message:string)=>void;onNavigate:Navigate};
export default function RichDocumentEditor({value,rich,onChange,disabled,onReady,onImage,onImagePaste,onError,onNavigate}:Props){
 const armed=useRef(false),last=useRef(''),callbacks=useRef({onChange,onReady,onImagePaste,onError,onNavigate});callbacks.current={onChange,onReady,onImagePaste,onError,onNavigate};
 const [,setSelection]=useState(0);
 const fallback=visualWarnings(value).length?{type:'doc',content:[{type:'codeBlock',content:value?[{type:'text',text:value}]:[]}]}:value;
 const editor=useEditor({extensions:wordExtensions(PrivateImageExtension),content:rich||fallback,contentType:rich||typeof fallback!=='string'?'json':'markdown',immediatelyRender:false,editable:!disabled,
  onUpdate:({editor,transaction})=>{if(!armed.current||!transaction.docChanged)return;try{const json=normalizeRichDocument(editor.getJSON());last.current=JSON.stringify(json);callbacks.current.onChange(json,normalizeVisualMarkdown(editor.getMarkdown()));validateRichDocument(json);setSelection(n=>n+1);}catch(e){callbacks.current.onError(e instanceof Error?e.message:'No se pudo aplicar el formato.');}},
  onSelectionUpdate:()=>setSelection(n=>n+1),
  editorProps:{attributes:{'aria-label':'Contenido del documento',role:'textbox','aria-multiline':'true',spellcheck:'true'},handleClick:(_view,_pos,event)=>{if(!event.ctrlKey&&!event.metaKey)return false;const anchor=(event.target as HTMLElement)?.closest('a'),href=anchor?.getAttribute('href');if(!href)return false;event.preventDefault();const target=internalTarget(href),file=assetId(href);if(target)callbacks.current.onNavigate(target.type,target.id);else if(file)void downloadAsset(file).catch(()=>callbacks.current.onError('No se pudo descargar el archivo.'));else if(/^https?:\/\//i.test(href))window.open(href,'_blank','noopener,noreferrer');return true;},handlePaste:(_view,event)=>{const files=Array.from(event.clipboardData?.files||[]);const image=files.find(f=>f.type.startsWith('image/'));if(image){event.preventDefault();callbacks.current.onImagePaste(image);return true;}return false;}}
 });
 useEffect(()=>{if(editor){callbacks.current.onReady(editor);return()=>callbacks.current.onReady(null);}},[editor]);
 useEffect(()=>{if(!editor)return;const signature=JSON.stringify(rich);if(rich&&signature!==last.current){armed.current=false;last.current=signature;editor.commands.setContent(rich,{emitUpdate:false});}else if(!rich&&value!==editor.getMarkdown()){armed.current=false;editor.commands.setContent(visualWarnings(value).length?{type:'doc',content:[{type:'codeBlock',content:value?[{type:'text',text:value}]:[]}]}:value,{contentType:visualWarnings(value).length?'json':'markdown',emitUpdate:false});}},[rich,value,editor]);
 useEffect(()=>{editor?.setEditable(!disabled);},[disabled,editor]);
 if(!editor)return <p role="status">Preparando procesador de texto…</p>;
 const chain=()=>editor.chain().focus();const table=editor.isActive('table');
 const tool=(label:string,icon:React.ReactNode,action:()=>void,active=false,inactive=false)=><Tooltip title={label} key={label}><span><IconButton size="small" aria-label={label} aria-pressed={active} disabled={disabled||inactive} onMouseDown={e=>e.preventDefault()} onClick={action}>{icon}</IconButton></span></Tooltip>;
 const color=(label:string,value:string,change:(color:string)=>void)=><label className="editor-color" title={label}><span>{label}</span><input aria-label={label} type="color" value={/^#[a-f0-9]{6}$/i.test(value)?value:'#282f3a'} disabled={disabled} onChange={e=>{armed.current=true;change(e.target.value);}}/></label>;
 return <div className="word-processor" onPointerDownCapture={()=>{armed.current=true;}} onKeyDownCapture={()=>{armed.current=true;}} onPasteCapture={()=>{armed.current=true;}}>
  <div className="word-toolbar" role="toolbar" aria-label="Formato del documento">
   <div className="word-toolbar-row">
    <select aria-label="Estilo de párrafo" disabled={disabled} value={editor.isActive('heading')?'h'+editor.getAttributes('heading').level:'paragraph'} onChange={e=>{if(e.target.value==='paragraph')chain().setParagraph().run();else chain().setHeading({level:Number(e.target.value.slice(1)) as 1|2|3}).run();}}><option value="paragraph">Texto normal</option><option value="h1">Título 1</option><option value="h2">Título 2</option><option value="h3">Título 3</option></select>
    <select aria-label="Fuente del texto" disabled={disabled} value={editor.getAttributes('textStyle').fontFamily||'Manrope'} onChange={e=>chain().setFontFamily(e.target.value).run()}>{DOCUMENT_FONTS.map((f:string)=><option key={f}>{f}</option>)}</select>
    <select aria-label="Tamaño del texto" disabled={disabled} value={editor.getAttributes('textStyle').fontSize||'16px'} onChange={e=>chain().setFontSize(e.target.value).run()}>{[8,10,12,14,16,18,20,24,28,32,36,48,60,72].map(n=><option value={n+'px'} key={n}>{n}</option>)}</select>
    <Divider orientation="vertical" flexItem/>
    {tool('Negrita',<FormatBold/>,()=>{chain().toggleBold().run();},editor.isActive('bold'))}
    {tool('Cursiva',<FormatItalic/>,()=>{chain().toggleItalic().run();},editor.isActive('italic'))}
    {tool('Subrayado',<FormatUnderlined/>,()=>{chain().toggleUnderline().run();},editor.isActive('underline'))}
    {tool('Tachado',<StrikethroughS/>,()=>{chain().toggleStrike().run();},editor.isActive('strike'))}
    {color('Texto',editor.getAttributes('textStyle').color||'#282f3a',c=>{chain().setColor(c).run();})}
    {color('Resaltado',editor.getAttributes('textStyle').backgroundColor||'#fff0b3',c=>{chain().setBackgroundColor(c).run();})}
   </div>
   <div className="word-toolbar-row">
    {(['left','center','right','justify'] as const).map((a,i)=>tool(['Alinear a la izquierda','Centrar','Alinear a la derecha','Justificar'][i],[<FormatAlignLeft key="l"/>,<FormatAlignCenter key="c"/>,<FormatAlignRight key="r"/>,<FormatAlignJustify key="j"/>][i],()=>{chain().setTextAlign(a).run();},editor.isActive({textAlign:a})))}
    <Divider orientation="vertical" flexItem/>
    {tool('Lista con viñetas',<FormatListBulleted/>,()=>{chain().toggleBulletList().run();},editor.isActive('bulletList'))}
    {tool('Lista numerada',<FormatListNumbered/>,()=>{chain().toggleOrderedList().run();},editor.isActive('orderedList'))}
    {tool('Cita',<FormatQuote/>,()=>{chain().toggleBlockquote().run();},editor.isActive('blockquote'))}
    {tool('Código en línea',<Code/>,()=>{chain().toggleCode().run();},editor.isActive('code'))}
    {tool('Bloque de código',<Code fontSize="small"/>,()=>{chain().toggleCodeBlock().run();},editor.isActive('codeBlock'))}
    {tool('Insertar separador',<HorizontalRule/>,()=>{chain().setHorizontalRule().run();})}
    {tool('Insertar imagen',<ImageOutlined/>,onImage)}
    {tool('Insertar tabla',<TableChart/>,()=>{chain().insertTable({rows:3,cols:3,withHeaderRow:true}).run();})}
    {tool('Insertar enlace',<Link/>,()=>{const href=window.prompt('Dirección HTTPS o enlace interno',editor.getAttributes('link').href||'https://');if(href&&/^(https:\/\/|deer:\/\/)/i.test(href))chain().extendMarkRange('link').setLink({href}).run();})}
    <Divider orientation="vertical" flexItem/>
    {tool('Deshacer',<Undo/>,()=>{chain().undo().run();},false,!editor.can().undo())}
    {tool('Rehacer',<Redo/>,()=>{chain().redo().run();},false,!editor.can().redo())}
    {tool('Quitar formato',<FormatClear/>,()=>{chain().unsetAllMarks().clearNodes().run();})}
   </div>
   {table&&<div className="word-toolbar-row table-tools"><span>Tabla</span>
    {tool('Añadir fila',<Add/>,()=>{chain().addRowAfter().run();})}{tool('Quitar fila',<Remove/>,()=>{chain().deleteRow().run();})}
    {tool('Añadir columna',<Add/>,()=>{chain().addColumnAfter().run();})}{tool('Quitar columna',<Remove/>,()=>{chain().deleteColumn().run();})}
    {tool('Combinar celdas',<MergeType/>,()=>{chain().mergeCells().run();},false,!editor.can().mergeCells())}{tool('Separar celda',<CallSplit/>,()=>{chain().splitCell().run();},false,!editor.can().splitCell())}
    {tool('Alternar encabezado',<TableChart/>,()=>{chain().toggleHeaderRow().run();})}
    {color('Fondo de celda',editor.getAttributes('tableCell').backgroundColor||editor.getAttributes('tableHeader').backgroundColor||'#eeeafe',c=>{chain().setCellAttribute('backgroundColor',c).run();})}
    {color('Borde de celda',editor.getAttributes('tableCell').borderColor||'#cbd0df',c=>{chain().setCellAttribute('borderColor',c).run();})}
    {tool('Quitar tabla',<DeleteOutlined/>,()=>{chain().deleteTable().run();})}
   </div>}
  </div>
  <div className="document-sheet"><EditorContent editor={editor}/></div>
 </div>;
}

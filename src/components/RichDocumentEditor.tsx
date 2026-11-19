'use client';
import {useEffect,useRef} from 'react';
import {EditorContent,useEditor,NodeViewWrapper,ReactNodeViewRenderer,type NodeViewProps} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {TableKit} from '@tiptap/extension-table';
import {TaskList,TaskItem} from '@tiptap/extension-list';
import Image from '@tiptap/extension-image';
import {Markdown} from '@tiptap/markdown';
import {Button} from '@mui/material';
import {normalizeVisualMarkdown} from '@/lib/document-format.mjs';
import {PrivateImage} from './DocumentReading';
function ImageView({node}:NodeViewProps){return <NodeViewWrapper><PrivateImage src={node.attrs.src} alt={node.attrs.alt} title={node.attrs.title}/></NodeViewWrapper>;}
const PrivateImageExtension=Image.extend({addNodeView(){return ReactNodeViewRenderer(ImageView);}});
export default function RichDocumentEditor({value,onChange,disabled}:{value:string;onChange:(value:string)=>void;disabled:boolean}){
 const armed=useRef(false);const last=useRef(value);const change=useRef(onChange);change.current=onChange;
 const editor=useEditor({extensions:[StarterKit.configure({link:{protocols:['deer'],openOnClick:false,autolink:false}}),TaskList,TaskItem.configure({nested:true}),TableKit,PrivateImageExtension,Markdown],content:value,contentType:'markdown',immediatelyRender:false,editable:!disabled,onUpdate:({editor})=>{if(!armed.current)return;const md=normalizeVisualMarkdown(editor.getMarkdown());last.current=md;change.current(md);},editorProps:{attributes:{'aria-label':'Editor visual del documento',role:'textbox','aria-multiline':'true'}}});
 useEffect(()=>{if(editor&&value!==last.current){armed.current=false;last.current=value;editor.commands.setContent(value,{contentType:'markdown',emitUpdate:false});}},[value,editor]);
 useEffect(()=>{editor?.setEditable(!disabled);},[disabled,editor]);
 if(!editor)return <p role="status">Preparando editor visual…</p>;
 return <div className="rich-editor" onPointerDownCapture={()=>{armed.current=true;}} onKeyDownCapture={()=>{armed.current=true;}} onPasteCapture={()=>{armed.current=true;}}><div className="toolbar" aria-label="Formato del documento"><Button disabled={disabled} onClick={()=>editor.chain().focus().toggleBold().run()}>Negrita</Button><Button disabled={disabled} onClick={()=>editor.chain().focus().toggleItalic().run()}>Cursiva</Button><Button disabled={disabled} onClick={()=>editor.chain().focus().toggleHeading({level:2}).run()}>Título</Button><Button disabled={disabled} onClick={()=>editor.chain().focus().toggleBulletList().run()}>Lista</Button><Button disabled={disabled} onClick={()=>editor.chain().focus().toggleOrderedList().run()}>Numeración</Button><Button disabled={disabled} onClick={()=>editor.chain().focus().toggleTaskList().run()}>Casillas</Button><Button disabled={disabled} onClick={()=>editor.chain().focus().toggleBlockquote().run()}>Cita</Button><Button disabled={disabled} onClick={()=>editor.chain().focus().insertTable({rows:3,cols:3,withHeaderRow:true}).run()}>Tabla</Button><Button disabled={disabled||!editor.isActive('table')} onClick={()=>editor.chain().focus().addRowAfter().run()}>+ Fila</Button><Button disabled={disabled||!editor.isActive('table')} onClick={()=>editor.chain().focus().addColumnAfter().run()}>+ Columna</Button><Button disabled={disabled||!editor.isActive('table')} onClick={()=>editor.chain().focus().deleteTable().run()}>Quitar tabla</Button><Button disabled={disabled} onClick={()=>{const url=window.prompt('Dirección HTTPS del enlace');if(url&&/^https:\/\//i.test(url))editor.chain().focus().setLink({href:url}).run();}}>Enlace</Button><Button disabled={disabled||!editor.can().undo()} onClick={()=>editor.chain().focus().undo().run()}>Deshacer</Button><Button disabled={disabled||!editor.can().redo()} onClick={()=>editor.chain().focus().redo().run()}>Rehacer</Button></div><EditorContent editor={editor}/></div>;
}

import {normalizeVisualMarkdown} from '../src/lib/document-format.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MarkdownManager} from '@tiptap/markdown';
import StarterKit from '@tiptap/starter-kit';
import {TableKit} from '@tiptap/extension-table';
import {TaskItem,TaskList} from '@tiptap/extension-list';
import Image from '@tiptap/extension-image';
const manager=new MarkdownManager({extensions:[StarterKit,TableKit,TaskList,TaskItem,Image]});
test('visual Markdown conversion preserves diagrams, images, captions, typed links and table cells',()=>{
 const id='11111111-1111-4111-8111-111111111111';
 const source='# Título\n\n**Negrita** y *cursiva*\n\n| Nombre | Valor |\n| --- | --- |\n| A | B |\n\n![Texto alternativo](deer-asset:'+id+' "Pie de foto")\n\n[Proyecto](deer://project/'+id+')\n\n> [!NOTE]\n> Decisión aprobada.\n\n```mermaid\nflowchart TD\n  A --> B\n```';
 const parsed=manager.parse(source),serialized=normalizeVisualMarkdown(manager.serialize(parsed));
 for(const text of ['Título','deer-asset:'+id,'Texto alternativo','Pie de foto','deer://project/'+id,'[!NOTE]','flowchart TD','A --> B','Nombre','Valor'])assert.ok(serialized.includes(text),'Lost '+text);
 assert.deepEqual(manager.parse(serialized),parsed);
});
test('visual Markdown conversion preserves checklist completion',()=>{const parsed=manager.parse('- [x] Hecho\n- [ ] Pendiente');const text=manager.serialize(parsed);assert.match(text,/\[x\] Hecho/);assert.match(text,/\[ \] Pendiente/);assert.deepEqual(manager.parse(text),parsed);});

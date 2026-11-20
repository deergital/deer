import StarterKit from '@tiptap/starter-kit';
import {TableKit,TableCell,TableHeader} from '@tiptap/extension-table';
import {TaskList,TaskItem} from '@tiptap/extension-list';
import {TextStyleKit} from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Image from '@tiptap/extension-image';
import {Markdown} from '@tiptap/markdown';
const color=(value:string|null)=>value&&/^#[0-9a-f]{6}$/i.test(value)?value:null;
const attributes={
 backgroundColor:{default:null,parseHTML:(e:HTMLElement)=>color(e.getAttribute('data-cell-color')),renderHTML:(a:Record<string,any>)=>a.backgroundColor?{'data-cell-color':a.backgroundColor,style:`background-color:${color(a.backgroundColor)||'transparent'}`} :{}},
 borderColor:{default:null,parseHTML:(e:HTMLElement)=>color(e.getAttribute('data-border-color')),renderHTML:(a:Record<string,any>)=>a.borderColor?{'data-border-color':a.borderColor,style:`border-color:${color(a.borderColor)||'inherit'}`} :{}},
};
export const StyledCell=TableCell.extend({addAttributes(){return {...this.parent?.(),...attributes};}});
export const StyledHeader=TableHeader.extend({addAttributes(){return {...this.parent?.(),...attributes};}});
export function wordExtensions(image=Image){return [StarterKit.configure({link:{protocols:['deer','deer-asset'],openOnClick:false,autolink:false}}),TaskList,TaskItem.configure({nested:true}),TableKit.configure({table:{resizable:true},tableCell:false,tableHeader:false}),StyledCell,StyledHeader,TextStyleKit.configure({lineHeight:false}),TextAlign.configure({types:['heading','paragraph']}),image,Markdown];}

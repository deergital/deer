'use client';
import {useState} from 'react';
import {DndContext,DragOverlay,MouseSensor,TouchSensor,useSensor,useSensors,useDraggable,useDroppable,closestCorners,type DragEndEvent} from '@dnd-kit/core';
import {Cover} from './VisualFieldsEditor';
import {DragIndicator} from '@mui/icons-material';
import {taskProgress} from '@/lib/planning.mjs';
import {TASK_STATES,dateLabel} from '@/lib/domain.mjs';
import type {Task,TaskState} from '@/lib/types';
type Props={tasks:Task[];filter:string;disabled:boolean;projectName:(id:string|null)=>string;projectColor?:(id:string|null)=>string;onOpen:(task:Task)=>void;onMove:(task:Task,status:TaskState)=>Promise<void>};
const states=Object.entries(TASK_STATES) as [TaskState,string][];
function Card({task,disabled,projectName,projectColor,onOpen,onMove}:Omit<Props,'tasks'|'filter'>&{task:Task}){
 const drag=useDraggable({id:task.id,disabled});
 return <article ref={drag.setNodeRef} className={'kanban-task '+(drag.isDragging?'dragging':'')} data-status={task.status} style={{opacity:drag.isDragging ? 0.35 : 1}} onMouseDown={event=>drag.listeners?.onMouseDown?.(event)}>
  <Cover value={task.cover_image}/><div className="kanban-task-heading"><button className="task-open" disabled={disabled} onClick={()=>onOpen(task)}>{task.icon||'✅'} {task.title}</button><button ref={drag.setActivatorNodeRef} className="drag-handle" {...drag.attributes} {...drag.listeners} disabled={disabled} aria-label={'Arrastrar '+task.title}><DragIndicator fontSize="small"/></button></div>
  <small><span className="project-dot" style={{background:projectColor?.(task.project_id)||'#7861FF'}}/>{projectName(task.project_id)}</small><div className="kanban-task-footer"><span>{dateLabel(task.due_date)} · {Math.round(taskProgress(task)*100)}%</span><label><span className="sr-only">Estado de {task.title}</span><select disabled={disabled} value={task.status} onChange={e=>void onMove(task,e.target.value as TaskState)}>{states.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></div>
 </article>;
}
function Column({state,label,children,count,disabled}:{state:TaskState;label:string;children:React.ReactNode;count:number;disabled:boolean}){const drop=useDroppable({id:state,disabled});return <section ref={drop.setNodeRef} className={'kanban-column status-'+state+(drop.isOver?' drop-target':'')}><div className="section-heading"><h2>{label}</h2><span className="column-count">{count}</span></div>{children}{!count&&<p className="kanban-empty">Arrastra una tarea aquí</p>}</section>;}
export default function KanbanBoard(props:Props){
 const [active,setActive]=useState<string|null>(null);
 const sensors=useSensors(useSensor(MouseSensor,{activationConstraint:{distance:7}}),useSensor(TouchSensor,{activationConstraint:{delay:180,tolerance:6}}));
 const dragged=props.tasks.find(t=>t.id===active);
 function end(event:DragEndEvent){setActive(null);const task=props.tasks.find(t=>t.id===event.active.id),status=event.over?.id as TaskState|undefined;if(task&&status&&status!==task.status&&states.some(([id])=>id===status))void props.onMove(task,status);}
 return <><p className="kanban-instructions">Arrastra las tareas entre columnas. También puedes cambiar el estado con el selector de cada tarjeta.</p>{props.disabled&&<p role="status">Actualizando tablero…</p>}<DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={e=>setActive(String(e.active.id))} onDragCancel={()=>setActive(null)} onDragEnd={end} accessibility={{announcements:{onDragStart:()=> 'Tarea seleccionada para mover.',onDragOver:({over})=>over?'Columna '+(TASK_STATES as Record<string,string>)[over.id]+'.':undefined,onDragEnd:()=> 'Movimiento terminado.',onDragCancel:()=> 'Movimiento cancelado.'}}}>
  <div className="kanban">{states.filter(([state])=>props.filter==='all'||props.filter==='active'||state===props.filter).map(([state,label])=><Column key={state} state={state} label={label} count={props.tasks.filter(t=>t.status===state).length} disabled={props.disabled}>{props.tasks.filter(t=>t.status===state).map(task=><Card key={task.id} task={task} {...props}/>)}</Column>)}</div>
  <DragOverlay>{dragged?<div className={'kanban-drag-preview status-'+dragged.status}>{dragged.title}</div>:null}</DragOverlay>
 </DndContext></>;
}

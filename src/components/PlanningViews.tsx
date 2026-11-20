'use client';
import {useState} from 'react';
import {Button} from '@mui/material';
import {ArrowBack,ArrowForward,Today} from '@mui/icons-material';
import type {Task} from '@/lib/types';
import {dateLabel,todayCancun} from '@/lib/domain.mjs';
import {addDays,dateWindow,scheduledOn} from '@/lib/planning.mjs';
export function PlanningViews({tasks,view,onOpen}:{tasks:Task[];view:'gantt'|'week'|'month';onOpen:(t:Task)=>void}){
 const [start,setStart]=useState(todayCancun());const length=view==='week'?7:30;const days=dateWindow(start,length);const dated=tasks.filter(t=>t.start_date||t.due_date);
 return <section className="panel planning"><div className="toolbar"><Button startIcon={<ArrowBack/>} onClick={()=>setStart(addDays(start,-length))}>Anterior</Button><Button startIcon={<Today/>} onClick={()=>setStart(todayCancun())}>Hoy</Button><Button endIcon={<ArrowForward/>} onClick={()=>setStart(addDays(start,length))}>Siguiente</Button><strong>{dateLabel(start)} — {dateLabel(days.at(-1))}</strong></div>{view==='gantt'?<div className="gantt-scroll"><table className="gantt"><thead><tr><th>Tarea</th>{days.map((day:string)=><th key={day}>{dateLabel(day)}</th>)}</tr></thead><tbody>{dated.map(t=><tr key={t.id}><th><button className="text-button" onClick={()=>onOpen(t)}>{t.title}</button></th>{days.map((day:string)=><td key={day} className={scheduledOn(t,day)?'gantt-bar '+t.status:''} aria-label={scheduledOn(t,day)?t.title+' · '+dateLabel(day):undefined}/>)}</tr>)}</tbody></table></div>:<div className={'calendar-grid '+view}>{days.map((day:string)=><section key={day} className={day===todayCancun()?'calendar-day today':'calendar-day'}><h3>{dateLabel(day)}</h3>{dated.filter(t=>scheduledOn(t,day)).map(t=><button key={t.id} className={'calendar-event '+t.status} onClick={()=>onOpen(t)}>{t.title}</button>)}</section>)}</div>}<details><summary>Sin fechas ({tasks.length-dated.length})</summary>{tasks.filter(t=>!t.start_date&&!t.due_date).map(t=><p key={t.id}><button className="text-button" onClick={()=>onOpen(t)}>{t.title}</button></p>)}</details></section>;
}

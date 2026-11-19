'use client';
import {useEffect,useState} from 'react';
import {Button} from '@mui/material';
import type {Navigate} from './DocumentReading';
export function Backlinks({api,type,id,onNavigate}:{api:(path:string)=>Promise<any>;type:string;id:string;onNavigate:Navigate}){const [rows,setRows]=useState<{id:string;title:string}[]>([]),[error,setError]=useState('');useEffect(()=>{let active=true;setRows([]);setError('');api('?kind=backlinks&'+new URLSearchParams({target_type:type,id})).then(r=>{if(active)setRows(r.rows);}).catch(()=>{if(active)setError('No se pudieron cargar las páginas relacionadas.');});return()=>{active=false;};},[id,type]);return <section className="backlinks"><h3>Páginas que enlazan aquí</h3>{error?<p role="status">{error}</p>:rows.length?rows.map(r=><Button key={r.id} onClick={()=>onNavigate('document',r.id)}>{r.title}</Button>):<p className="muted">Sin referencias guardadas.</p>}</section>;}

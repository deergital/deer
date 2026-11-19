export const TASK_STATES = {todo:'Por hacer',in_progress:'En proceso',in_review:'En revisión',waiting:'Esperando respuesta',done:'Completado'};
export const IMPORTANCE = {high:'Alta',medium:'Media',low:'Baja'};
export const PROJECT_STATES = {active:'Activo',paused:'En pausa',closed:'Cerrado'};
export function validateTask(input){
 const errors={};
 if(!input.title?.trim()) errors.title='Escribe un título.';
 else if(input.title.trim().length>240) errors.title='Máximo 240 caracteres.';
 if((input.description||'').length>50000) errors.description='Máximo 50,000 caracteres.';
 if(!Object.hasOwn(TASK_STATES,input.status)) errors.status='Selecciona un estado válido.';
 if(!Object.hasOwn(IMPORTANCE,input.importance)) errors.importance='Selecciona una importancia válida.';
 for(const k of ['start_date','due_date']) if(input[k]&&!validDate(input[k])) errors[k]='Fecha inválida.';
 if(input.start_date&&input.due_date&&input.start_date>input.due_date) errors.due_date='El vencimiento debe ser igual o posterior al inicio.';
 return errors;
}
export function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false; const d=new Date(s+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===s;}
export function dateLabel(s){if(!s)return 'Sin fecha';return new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short',timeZone:'UTC'}).format(new Date(s+'T12:00:00Z'));}
export function todayCancun(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Cancun',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}

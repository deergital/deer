// Task dates are calendar dates, independent of the device timezone.
export function addDays(day,amount){const date=new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+amount);return date.toISOString().slice(0,10);}
export function dateWindow(start,length){return Array.from({length},(_,index)=>addDays(start,index));}
export function scheduledOn(task,day){return Boolean(task.start_date||task.due_date)&&(task.start_date||task.due_date)<=day&&(task.due_date||task.start_date)>=day;}
export function taskProgress(task){if(task.status==='done')return 1;const subtasks=task.subtasks||[];return subtasks.length?subtasks.filter(s=>s.done).length/subtasks.length:0;}
export function progress(tasks){return tasks.length?Math.round(100*tasks.reduce((sum,task)=>sum+taskProgress(task),0)/tasks.length):0;}
export function dayInCancun(value){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Cancun',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));}
export function weekRange(day){const date=new Date(day+'T12:00:00Z'),weekday=(date.getUTCDay()+6)%7;const start=addDays(day,-weekday);return {start,end:addDays(start,6)};}

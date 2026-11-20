// Task dates are calendar dates, independent of the device timezone.
export function addDays(day,amount){const date=new Date(day+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+amount);return date.toISOString().slice(0,10);}
export function dateWindow(start,length){return Array.from({length},(_,index)=>addDays(start,index));}
export function scheduledOn(task,day){return Boolean(task.start_date||task.due_date)&&(task.start_date||task.due_date)<=day&&(task.due_date||task.start_date)>=day;}
export function progress(tasks){return tasks.length?Math.round(100*tasks.filter(task=>task.status==='done').length/tasks.length):0;}

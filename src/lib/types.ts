export type TaskState='todo'|'in_progress'|'in_review'|'waiting'|'done';
export interface Project {id:string;name:string;objective:string;status:'active'|'paused'|'closed';version:number;owner_id:string;created_at:string;updated_at:string}
export interface Task {id:string;project_id:string|null;title:string;description:string;status:TaskState;importance:'high'|'medium'|'low';start_date:string|null;due_date:string|null;version:number;owner_id:string;created_at:string;updated_at:string}
export interface Profile {id:string;display_name:string;timezone:string;theme:'system'|'light'|'dark';density:'comfortable'|'compact';is_enabled:boolean;version:number}

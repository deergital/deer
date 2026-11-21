export type TaskState='todo'|'in_progress'|'in_review'|'waiting'|'done';
export interface VisualFields {icon?:string;cover_image?:string}
export interface Project extends VisualFields {id:string;name:string;objective:string;status:'active'|'paused'|'closed';version:number;owner_id:string;created_at:string;updated_at:string;color?:string}
export interface Subtask {id:string;title:string;done:boolean}
export interface Task extends VisualFields {id:string;project_id:string|null;title:string;description:string;status:TaskState;importance:'high'|'medium'|'low';start_date:string|null;due_date:string|null;version:number;owner_id:string;created_at:string;updated_at:string;completed_at?:string|null;is_important?:boolean;is_urgent?:boolean;subtasks?:Subtask[];depends_on_person?:string;follow_up_date?:string|null}
export interface Profile {id:string;display_name:string;timezone:string;theme:'system'|'light'|'dark';density:'comfortable'|'compact';is_enabled:boolean;version:number;editor_theme?:'light'|'dark';mcp_read?:boolean;mcp_write?:boolean;mcp_client_id?:string;mcp_resource?:string}
export interface Meeting {id:string;owner_id:string;project_id:string|null;document_id:string|null;title:string;starts_at:string;ends_at:string;participants:string;location:string;notes:string;task_ids:string[];status:'scheduled'|'completed'|'canceled';created_at:string;updated_at:string;version:number}
export interface DocumentIndex {id:string;project_id:string|null;parent_id:string|null;title:string;kind:string;icon:string;content_md:string;created_at:string;updated_at:string}

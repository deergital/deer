-- E3 expanded. Apply AFTER 202611190004, once, with a verified backup.
-- Additive migration: no business records or storage objects are removed.
begin;
create function public.deer_valid_cover(v text) returns boolean language sql immutable set search_path='' as $$
 select v='' or (length(v)<=90000 and v ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$');
$$;
create function public.deer_valid_subtasks(v jsonb) returns boolean language sql immutable set search_path='' as $$
 select case when jsonb_typeof(v)<>'array' then false else jsonb_array_length(v)<=100
 and not exists(select 1 from jsonb_array_elements(v) x where jsonb_typeof(x)<>'object'
 or not(x ?& array['id','title','done']) or (x-array['id','title','done'])<>'{}'::jsonb
 or coalesce(x->>'id','')!~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 or jsonb_typeof(x->'title')<>'string' or length(btrim(x->>'title')) not between 1 and 240
 or jsonb_typeof(x->'done')<>'boolean')
 and (select count(*)=count(distinct x->>'id') from jsonb_array_elements(v) x) end;
$$;
alter table public.projects add column icon text not null default '' check(length(icon)<=32),
 add column cover_image text not null default '' check(public.deer_valid_cover(cover_image)),
 add column color text not null default '#4228D3' check(color ~ '^#[a-fA-F0-9]{6}$');
alter table public.tasks add column icon text not null default '' check(length(icon)<=32),
 add column cover_image text not null default '' check(public.deer_valid_cover(cover_image)),
 add column is_important boolean not null default false,
 add column is_urgent boolean not null default false,
 add column subtasks jsonb not null default '[]' check(public.deer_valid_subtasks(subtasks)),
 add column depends_on_person text not null default '' check(length(depends_on_person)<=240),
 add column follow_up_date date,
 add column completed_at timestamptz;
-- Recover the real completion event where existing mutation receipts permit it.
update public.tasks t set completed_at=(select a.occurred_at from public.activity_events a join public.mutation_requests r on r.owner_id=a.owner_id and r.request_id=a.request_id where a.entity_type='task' and a.entity_id=t.id and a.owner_id=t.owner_id and r.result_json->>'status'='done' and (a.action='created' or 'status'=any(a.changed_fields)) order by a.occurred_at desc limit 1) where t.status='done';
update public.tasks set is_important=(importance='high');
alter table public.profiles add column editor_theme text not null default 'light' check(editor_theme in ('light','dark'));
alter table public.documents add constraint documents_id_owner_unique unique(id,owner_id);
alter table public.documents add column icon text not null default '' check(length(icon)<=32),
 add column cover_image text not null default '' check(public.deer_valid_cover(cover_image)),
 add column parent_id uuid,
 add constraint document_parent_owner foreign key(parent_id,owner_id) references public.documents(id,owner_id) deferrable initially deferred;
create index documents_parent on public.documents(owner_id,parent_id,id);
create table public.meetings (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id),
 project_id uuid,document_id uuid,title varchar(240) not null check(length(btrim(title))>0),
 starts_at timestamptz not null,ends_at timestamptz not null check(ends_at>=starts_at),
 participants text not null default '' check(length(participants)<=2000),
 location text not null default '' check(length(location)<=2048),
 notes text not null default '' check(length(notes)<=50000),
 task_ids uuid[] not null default '{}' check(cardinality(task_ids)<=100),
 status text not null default 'scheduled' check(status in ('scheduled','completed','canceled')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),version bigint not null default 1 check(version>0),
 foreign key(project_id,owner_id) references public.projects(id,owner_id),
 foreign key(document_id,owner_id) references public.documents(id,owner_id),unique(id,owner_id)
);
create index meetings_owner_start on public.meetings(owner_id,starts_at,id);
alter table public.meetings enable row level security;
revoke all on public.meetings from public,anon,authenticated;
grant select on public.meetings to authenticated;
create policy meeting_read on public.meetings for select to authenticated using(owner_id=auth.uid() and public.deer_is_enabled());
alter table public.activity_events drop constraint activity_events_entity_type_check;
alter table public.activity_events add constraint activity_events_entity_type_check check(entity_type in ('project','task','profile','document','meeting'));
-- MCP is disabled until the owner configures the OAuth client and grants access.
alter table public.profiles add column mcp_read boolean not null default false,
 add column mcp_write boolean not null default false,
 add column mcp_client_id text not null default '' check(mcp_client_id='' or mcp_client_id ~ '^[a-f0-9-]{36}$'),
 add column mcp_resource text not null default 'https://deer-anx0.netlify.app/api/mcp' check(mcp_resource ~ '^https://[^/]+/api/mcp$'),
 add constraint mcp_write_requires_read check(not mcp_write or mcp_read);
create function public.deer_oauth_client() returns text language sql stable set search_path='' as $$
 select nullif(coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)->>'client_id','');
$$;
revoke all on function public.deer_oauth_client() from public,anon,authenticated;
grant execute on function public.deer_oauth_client() to authenticated;
create or replace function public.deer_is_enabled() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and is_enabled and (public.deer_oauth_client() is null or (mcp_read and mcp_client_id=public.deer_oauth_client())));
$$;
create function public.deer_write_allowed() returns boolean language sql stable security definer set search_path='' as $$
 select public.deer_is_enabled() and (public.deer_oauth_client() is null or exists(select 1 from public.profiles where id=auth.uid() and mcp_write));
$$;
revoke all on function public.deer_write_allowed() from public,anon,authenticated;
grant execute on function public.deer_write_allowed() to authenticated;
alter policy deer_storage_upload on storage.objects with check(bucket_id='deer-private' and split_part(name,'/',1)=auth.uid()::text and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}$' and public.deer_write_allowed());

create or replace function public.deer_mutate(p_kind text,p_request_id uuid,p_payload jsonb,p_id uuid default null,p_expected_version bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_owner uuid:=auth.uid();v_id uuid;v_hash text;v_receipt public.mutation_requests%rowtype;
 v_project public.projects%rowtype;v_task public.tasks%rowtype;v_profile public.profiles%rowtype;v_meeting public.meetings%rowtype;
 v_before jsonb;v_after jsonb;v_allowed text[];v_changed text[];v_operation text;v_project_state text;v_key text;
begin
 if v_owner is null or not public.deer_is_enabled() then raise exception using errcode='42501',message='DEER_ACCESS_DENIED';end if;
 if not public.deer_write_allowed() then raise exception using errcode='42501',message='DEER_MCP_READ_ONLY';end if;
 if p_request_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then
  raise exception using errcode='22023',message='DEER_INVALID_PAYLOAD';end if;
 if p_expected_version is not null and (p_expected_version<1 or p_id is null) then
  raise exception using errcode='22023',message='DEER_INVALID_VERSION';end if;
 if p_kind='profile' and public.deer_oauth_client() is not null then raise exception using errcode='42501',message='DEER_MCP_PROFILE_PROTECTED';end if;
 case p_kind
  when 'project' then v_allowed:=array['name','objective','status','icon','cover_image','color'];
  when 'task' then v_allowed:=array['title','description','project_id','status','importance','start_date','due_date','icon','cover_image','is_important','is_urgent','subtasks','depends_on_person','follow_up_date'];
  when 'meeting' then v_allowed:=array['title','project_id','document_id','starts_at','ends_at','participants','location','notes','task_ids','status'];
  when 'profile' then v_allowed:=array['display_name','timezone','theme','density','editor_theme','mcp_read','mcp_write','mcp_client_id','mcp_resource'];
  else raise exception using errcode='22023',message='DEER_INVALID_KIND';
 end case;
 if exists(select 1 from jsonb_object_keys(p_payload) k where not(k=any(v_allowed))) then
  raise exception using errcode='22023',message='DEER_PROTECTED_OR_UNKNOWN_FIELD';end if;
 for v_key in select jsonb_object_keys(p_payload) loop
  if v_key in ('is_important','is_urgent','mcp_read','mcp_write') then
   if jsonb_typeof(p_payload->v_key)<>'boolean' then raise exception 'DEER_INVALID_FIELD_TYPE';end if;
  elsif v_key in ('subtasks','task_ids') then
   if jsonb_typeof(p_payload->v_key)<>'array' then raise exception 'DEER_INVALID_FIELD_TYPE';end if;
  elsif v_key in ('project_id','start_date','due_date','follow_up_date','document_id','starts_at','ends_at') then
   if jsonb_typeof(p_payload->v_key) not in ('string','null') then raise exception using errcode='22023',message='DEER_INVALID_FIELD_TYPE';end if;
  elsif jsonb_typeof(p_payload->v_key)<>'string' then
   raise exception using errcode='22023',message='DEER_INVALID_FIELD_TYPE';
  end if;
 end loop;
 if p_payload?'title' then p_payload:=jsonb_set(p_payload,'{title}',to_jsonb(btrim(p_payload->>'title')));end if;
 if p_payload?'name' then p_payload:=jsonb_set(p_payload,'{name}',to_jsonb(btrim(p_payload->>'name')));end if;
 if p_payload?'display_name' then p_payload:=jsonb_set(p_payload,'{display_name}',to_jsonb(btrim(p_payload->>'display_name')));end if;
 if p_payload is null then raise exception using errcode='22023',message='DEER_INVALID_PAYLOAD';end if;
 -- Serialize retries of the same action, even across connections. Lock hash
 -- collisions only serialize unrelated requests; they do not grant access.
 perform pg_advisory_xact_lock(hashtextextended(v_owner::text||p_request_id::text,0));
 v_operation:=p_kind||case when p_expected_version is null then '.create' else '.update' end;
 v_hash:=encode(sha256(convert_to(jsonb_build_object('kind',p_kind,'id',p_id,'version',p_expected_version,'payload',p_payload)::text,'UTF8')),'hex');
 select * into v_receipt from public.mutation_requests where owner_id=v_owner and request_id=p_request_id;
 if found then
  if v_receipt.payload_hash<>v_hash then raise exception using errcode='P0001',message='DEER_IDEMPOTENCY_CONFLICT';end if;
  return v_receipt.result_json;
 end if;
 v_id:=coalesce(p_id,gen_random_uuid());
 if p_kind='project' then
  if p_expected_version is null then
   v_project:=jsonb_populate_record(null::public.projects,jsonb_build_object('id',v_id,'owner_id',v_owner,'icon','','cover_image','','color','#4228D3','objective','','status','active','version',1,'created_at',now(),'updated_at',now())||p_payload);
   insert into public.projects select (v_project).* returning to_jsonb(projects.*) into v_after;
  else
   select * into v_project from public.projects where id=v_id and owner_id=v_owner for update;
   if not found then raise exception using errcode='P0002',message='DEER_NOT_FOUND';end if;
   if v_project.version<>p_expected_version then raise exception using errcode='P0001',message='DEER_VERSION_CONFLICT';end if;
   v_before:=to_jsonb(v_project);v_project:=jsonb_populate_record(v_project,p_payload);
   v_after:=to_jsonb(v_project);
   if v_before<>v_after then
    update public.projects set icon=v_project.icon,cover_image=v_project.cover_image,color=v_project.color,name=v_project.name,objective=v_project.objective,status=v_project.status,version=version+1,updated_at=clock_timestamp() where id=v_id returning to_jsonb(projects.*) into v_after;
   end if;
  end if;
 elsif p_kind='task' then
  if p_expected_version is null then
   v_task:=jsonb_populate_record(null::public.tasks,jsonb_build_object('id',v_id,'owner_id',v_owner,'icon','','cover_image','','is_important',false,'is_urgent',false,'subtasks','[]'::jsonb,'depends_on_person','','description','','status','todo','importance','medium','version',1,'created_at',now(),'updated_at',now())||p_payload);
  else
   select * into v_task from public.tasks where id=v_id and owner_id=v_owner for update;
   if not found then raise exception using errcode='P0002',message='DEER_NOT_FOUND';end if;
   if v_task.version<>p_expected_version then raise exception using errcode='P0001',message='DEER_VERSION_CONFLICT';end if;
   v_before:=to_jsonb(v_task);v_task:=jsonb_populate_record(v_task,p_payload);
  end if;
  v_task.completed_at:=case when v_task.status='done' then case when v_before is null or v_before->>'status'<>'done' then clock_timestamp() else v_task.completed_at end else null end;
  if v_task.project_id is not null then
   select status into v_project_state from public.projects where id=v_task.project_id and owner_id=v_owner for share;
   if not found then raise exception using errcode='P0002',message='DEER_PROJECT_NOT_ACCESSIBLE';end if;
   if v_project_state='closed' and (v_before is null or (v_before->>'project_id') is distinct from v_task.project_id::text) then
    raise exception using errcode='22023',message='DEER_PROJECT_CLOSED';end if;
  end if;
  v_after:=to_jsonb(v_task);
  if v_before is null then
   insert into public.tasks select (v_task).* returning to_jsonb(tasks.*) into v_after;
  elsif v_before<>v_after then
   update public.tasks set completed_at=v_task.completed_at,icon=v_task.icon,cover_image=v_task.cover_image,is_important=v_task.is_important,is_urgent=v_task.is_urgent,subtasks=v_task.subtasks,depends_on_person=v_task.depends_on_person,follow_up_date=v_task.follow_up_date,title=v_task.title,description=v_task.description,project_id=v_task.project_id,status=v_task.status,importance=v_task.importance,start_date=v_task.start_date,due_date=v_task.due_date,version=version+1,updated_at=clock_timestamp() where id=v_id returning to_jsonb(tasks.*) into v_after;
  end if;
 elsif p_kind='meeting' then
  if p_expected_version is null then
   v_meeting:=jsonb_populate_record(null::public.meetings,jsonb_build_object('id',v_id,'owner_id',v_owner,'participants','','location','','notes','','task_ids','[]'::jsonb,'status','scheduled','version',1,'created_at',now(),'updated_at',now())||p_payload);
  else
   select * into v_meeting from public.meetings where id=v_id and owner_id=v_owner for update;
   if not found then raise exception 'DEER_NOT_FOUND';end if;
   if v_meeting.version<>p_expected_version then raise exception 'DEER_VERSION_CONFLICT';end if;
   v_before:=to_jsonb(v_meeting);v_meeting:=jsonb_populate_record(v_meeting,p_payload);
  end if;
  if cardinality(v_meeting.task_ids)>100 or cardinality(v_meeting.task_ids)<>(select count(distinct id) from unnest(v_meeting.task_ids) id) or exists(select 1 from unnest(v_meeting.task_ids) t where not exists(select 1 from public.tasks where id=t and owner_id=v_owner)) then raise exception 'DEER_TASK_NOT_ACCESSIBLE';end if;
  if v_meeting.project_id is not null then
   select status into v_project_state from public.projects where id=v_meeting.project_id and owner_id=v_owner for share;
   if not found then raise exception 'DEER_PROJECT_NOT_ACCESSIBLE';end if;
   if v_project_state='closed' and (v_before is null or (v_before->>'project_id') is distinct from v_meeting.project_id::text) then raise exception 'DEER_PROJECT_CLOSED';end if;
  end if;
  if v_meeting.document_id is not null and not exists(select 1 from public.documents where id=v_meeting.document_id and owner_id=v_owner) then raise exception 'DEER_DOCUMENT_NOT_ACCESSIBLE';end if;
  v_after:=to_jsonb(v_meeting);
  if v_before is null then insert into public.meetings select (v_meeting).* returning to_jsonb(meetings.*) into v_after;
  elsif v_before<>v_after then
   update public.meetings set title=v_meeting.title,project_id=v_meeting.project_id,document_id=v_meeting.document_id,starts_at=v_meeting.starts_at,ends_at=v_meeting.ends_at,participants=v_meeting.participants,location=v_meeting.location,notes=v_meeting.notes,task_ids=v_meeting.task_ids,status=v_meeting.status,version=version+1,updated_at=clock_timestamp() where id=v_id returning to_jsonb(meetings.*) into v_after;
  end if;
 else
  if p_expected_version is null or p_id is distinct from v_owner then raise exception using errcode='42501',message='DEER_PROFILE_PROTECTED';end if;
  select * into v_profile from public.profiles where id=v_owner for update;
  if v_profile.version<>p_expected_version then raise exception using errcode='P0001',message='DEER_VERSION_CONFLICT';end if;
  v_before:=to_jsonb(v_profile);v_profile:=jsonb_populate_record(v_profile,p_payload);
  if not exists(select 1 from pg_timezone_names where name=v_profile.timezone) then raise exception using errcode='22023',message='DEER_INVALID_TIMEZONE';end if;
  v_after:=to_jsonb(v_profile);
  if v_before<>v_after then
   update public.profiles set mcp_read=v_profile.mcp_read,mcp_write=v_profile.mcp_write,mcp_client_id=v_profile.mcp_client_id,mcp_resource=v_profile.mcp_resource,editor_theme=v_profile.editor_theme,display_name=v_profile.display_name,timezone=v_profile.timezone,theme=v_profile.theme,density=v_profile.density,version=version+1,updated_at=clock_timestamp() where id=v_owner returning to_jsonb(profiles.*) into v_after;
  end if;
 end if;
 select coalesce(array_agg(k order by k),array[]::text[]) into v_changed from unnest(v_allowed) k where (v_before->k) is distinct from (v_after->k);
 if v_before is null or cardinality(v_changed)>0 then
  insert into public.activity_events(owner_id,actor_id,request_id,entity_type,entity_id,action,from_version,to_version,changed_fields)
  values(v_owner,v_owner,p_request_id,p_kind,v_id,case when v_before is null then 'created' when 'status'=any(v_changed) then 'status_changed' else 'updated' end,(v_before->>'version')::bigint,(v_after->>'version')::bigint,v_changed);
 end if;
 insert into public.mutation_requests(owner_id,request_id,operation,payload_hash,entity_id,resulting_version,result_json)
 values(v_owner,p_request_id,v_operation,v_hash,v_id,(v_after->>'version')::bigint,v_after);
 return v_after;
end;
$$;
create or replace function public.deer_document_mutate_base(p_request_id uuid,p_payload jsonb,p_id uuid default null,p_expected_version bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_owner uuid:=auth.uid();v_id uuid;v_hash text;v_key text;v_state text;
 v_receipt public.mutation_requests%rowtype;v_doc public.documents%rowtype;
 v_before jsonb;v_after jsonb;v_changed text[];
begin
 if v_owner is null or not public.deer_is_enabled() then raise exception using errcode='42501',message='DEER_ACCESS_DENIED';end if;
 if not public.deer_write_allowed() then raise exception using errcode='42501',message='DEER_MCP_READ_ONLY';end if;
 if p_request_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception using errcode='22023',message='DEER_INVALID_PAYLOAD';end if;
 if p_expected_version is not null and (p_expected_version<1 or p_id is null) then raise exception using errcode='22023',message='DEER_INVALID_VERSION';end if;
 for v_key in select jsonb_object_keys(p_payload) loop
  if not(v_key=any(array['title','kind','content_md','project_id','content_json','icon','cover_image','parent_id'])) then raise exception using errcode='22023',message='DEER_PROTECTED_OR_UNKNOWN_FIELD';end if;
  if v_key='content_json' then
   if jsonb_typeof(p_payload->v_key) not in ('object','null') then raise exception using errcode='22023',message='DEER_INVALID_FIELD_TYPE';end if;
  elsif v_key in ('project_id','parent_id') then
   if jsonb_typeof(p_payload->v_key) not in ('string','null') then raise exception using errcode='22023',message='DEER_INVALID_FIELD_TYPE';end if;
  elsif jsonb_typeof(p_payload->v_key)<>'string' then raise exception using errcode='22023',message='DEER_INVALID_FIELD_TYPE';end if;
 end loop;
 if p_payload?'title' then p_payload:=jsonb_set(p_payload,'{title}',to_jsonb(btrim(p_payload->>'title')));end if;
 perform pg_advisory_xact_lock(hashtextextended(v_owner::text||':document-tree',0));
 perform pg_advisory_xact_lock(hashtextextended(v_owner::text||p_request_id::text,0));
 v_hash:=encode(sha256(convert_to(jsonb_build_object('kind','document','id',p_id,'version',p_expected_version,'payload',p_payload)::text,'UTF8')),'hex');
 select * into v_receipt from public.mutation_requests where owner_id=v_owner and request_id=p_request_id;
 if found then
  if v_receipt.payload_hash<>v_hash then raise exception using errcode='P0001',message='DEER_IDEMPOTENCY_CONFLICT';end if;
  return v_receipt.result_json;
 end if;
 v_id:=coalesce(p_id,gen_random_uuid());
 if p_expected_version is null then
  v_doc:=jsonb_populate_record(null::public.documents,jsonb_build_object('id',v_id,'owner_id',v_owner,'icon','','cover_image','','kind','note','content_md','','version',1,'created_at',now(),'updated_at',now())||p_payload);
 else
  select * into v_doc from public.documents where id=v_id and owner_id=v_owner for update;
  if not found then raise exception using errcode='P0002',message='DEER_NOT_FOUND';end if;
  if v_doc.version<>p_expected_version then raise exception using errcode='P0001',message='DEER_VERSION_CONFLICT';end if;
  if v_doc.content_json is not null and p_payload?'content_md' and not(p_payload?'content_json') then raise exception using errcode='22023',message='DEER_REFRESH_REQUIRED';end if;
  v_before:=to_jsonb(v_doc);v_doc:=jsonb_populate_record(v_doc,p_payload);
 end if;
 if v_doc.parent_id is not null then
  if not exists(select 1 from public.documents where id=v_doc.parent_id and owner_id=v_owner) then raise exception 'DEER_PARENT_NOT_ACCESSIBLE';end if;
  if exists(with recursive ancestors as (select id,parent_id from public.documents where id=v_doc.parent_id and owner_id=v_owner union select d.id,d.parent_id from public.documents d join ancestors a on d.id=a.parent_id where d.owner_id=v_owner) select 1 from ancestors where id=v_id) then raise exception 'DEER_DOCUMENT_CYCLE';end if;
  if v_before is null and v_doc.project_id is null then select project_id into v_doc.project_id from public.documents where id=v_doc.parent_id;end if;
 end if;
 if v_doc.project_id is not null then
  select status into v_state from public.projects where id=v_doc.project_id and owner_id=v_owner for share;
  if not found then raise exception using errcode='P0002',message='DEER_PROJECT_NOT_ACCESSIBLE';end if;
  if v_state='closed' and (v_before is null or (v_before->>'project_id') is distinct from v_doc.project_id::text) then raise exception using errcode='22023',message='DEER_PROJECT_CLOSED';end if;
 end if;
 v_after:=to_jsonb(v_doc);
 if v_before is null then
  insert into public.documents select (v_doc).* returning to_jsonb(documents.*) into v_after;
 elsif v_before<>v_after then
  update public.documents set icon=v_doc.icon,cover_image=v_doc.cover_image,parent_id=v_doc.parent_id,title=v_doc.title,kind=v_doc.kind,project_id=v_doc.project_id,content_md=v_doc.content_md,content_json=v_doc.content_json,version=version+1,updated_at=clock_timestamp() where id=v_id returning to_jsonb(documents.*) into v_after;
 end if;
 select coalesce(array_agg(k order by k),array[]::text[]) into v_changed from unnest(array['title','kind','project_id','content_md','content_json','icon','cover_image','parent_id']) k where (v_before->k) is distinct from (v_after->k);
 if v_before is null or cardinality(v_changed)>0 then
  insert into public.activity_events(owner_id,actor_id,request_id,entity_type,entity_id,action,from_version,to_version,changed_fields)
  values(v_owner,v_owner,p_request_id,'document',v_id,case when v_before is null then 'created' else 'updated' end,(v_before->>'version')::bigint,(v_after->>'version')::bigint,v_changed);
 end if;
 insert into public.mutation_requests(owner_id,request_id,operation,payload_hash,entity_id,resulting_version,result_json)
 values(v_owner,p_request_id,case when p_expected_version is null then 'document.create' else 'document.update' end,v_hash,v_id,(v_after->>'version')::bigint,v_after);
 return v_after;
end;
$$;
create or replace function public.deer_export_backup() returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or not public.deer_is_enabled() then raise exception using errcode='42501',message='DEER_ACCESS_DENIED';end if;
 return jsonb_build_object('format','deer-e1-backup','schema_version',5,'exported_at',now(),'owner_id',auth.uid(),
 'profiles',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from public.profiles p where p.id=auth.uid()),
 'projects',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from public.projects p where p.owner_id=auth.uid()),
 'tasks',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.tasks t where t.owner_id=auth.uid()),
 'documents',(select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]'::jsonb) from public.documents d where d.owner_id=auth.uid()),
 'document_assets',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) from public.document_assets a where a.owner_id=auth.uid()),
 'meetings',(select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]'::jsonb) from public.meetings m where m.owner_id=auth.uid()),
 'document_links',(select coalesce(jsonb_agg(to_jsonb(l) order by l.source_id,l.target_type,l.target_id),'[]'::jsonb) from public.document_links l where l.owner_id=auth.uid()));
end;
$$;


create or replace function public.deer_register_asset(p_id uuid,p_document_id uuid,p_name text,p_mime text,p_size integer,p_sha256 text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid();v_row public.document_assets%rowtype;v_path text;
begin
 if v_owner is null or not public.deer_is_enabled() then raise exception using errcode='42501',message='DEER_ACCESS_DENIED';end if;
 if not public.deer_write_allowed() then raise exception using errcode='42501',message='DEER_MCP_READ_ONLY';end if;
 if not exists(select 1 from public.documents where id=p_document_id and owner_id=v_owner) then raise exception 'DEER_DOCUMENT_NOT_ACCESSIBLE';end if;
 v_path:=v_owner::text||'/'||p_id::text;
 if not exists(select 1 from storage.objects where bucket_id='deer-private' and name=v_path) then raise exception 'DEER_FILE_NOT_UPLOADED';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_path,0));
 select * into v_row from public.document_assets where id=p_id;
 if found then
  if v_row.owner_id<>v_owner or v_row.document_id<>p_document_id or v_row.sha256<>p_sha256 or v_row.size_bytes<>p_size or v_row.name<>p_name or v_row.mime_type<>p_mime then raise exception 'DEER_IDEMPOTENCY_CONFLICT';end if;
  return to_jsonb(v_row);
 end if;
 insert into public.document_assets(id,owner_id,document_id,name,mime_type,size_bytes,sha256,storage_path)
 values(p_id,v_owner,p_document_id,p_name,p_mime,p_size,p_sha256,v_path) returning * into v_row;
 return to_jsonb(v_row);
end;
$$;

-- One save for planning changes: all records commit, or all roll back.
create function public.deer_task_batch(p_request_id uuid,p_changes jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid();v_hash text;v_receipt public.mutation_requests%rowtype;v_item jsonb;v_rows jsonb:='[]';v_result jsonb;v_child uuid;
begin
 if v_owner is null or not public.deer_is_enabled() then raise exception 'DEER_ACCESS_DENIED';end if;
 if p_request_id is null or jsonb_typeof(p_changes) is distinct from 'array' then raise exception 'DEER_INVALID_PAYLOAD';end if;
 if jsonb_array_length(p_changes) not between 1 and 100 then raise exception 'DEER_INVALID_PAYLOAD';end if;
 if (select count(*)<>count(distinct x->>'id') from jsonb_array_elements(p_changes) x) then raise exception 'DEER_DUPLICATE_TASK';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_owner::text||p_request_id::text,0));
 v_hash:=encode(sha256(convert_to(p_changes::text,'UTF8')),'hex');
 select * into v_receipt from public.mutation_requests where owner_id=v_owner and request_id=p_request_id;
 if found then
  if v_receipt.operation<>'task.batch' or v_receipt.payload_hash<>v_hash then raise exception 'DEER_IDEMPOTENCY_CONFLICT';end if;
  return v_receipt.result_json;
 end if;
 for v_item in select value from jsonb_array_elements(p_changes) order by value->>'id' loop
  if jsonb_typeof(v_item)<>'object' or not(v_item ?& array['id','expected_version','payload']) or (v_item-array['id','expected_version','payload'])<>'{}'::jsonb or jsonb_typeof(v_item->'payload')<>'object' then raise exception 'DEER_INVALID_PAYLOAD';end if;
  if v_item->>'id' is null or v_item->>'expected_version' is null then raise exception 'DEER_INVALID_VERSION';end if;
  if exists(select 1 from jsonb_object_keys(v_item->'payload') k where not(k=any(array['is_important','is_urgent','start_date','due_date']))) then raise exception 'DEER_PROTECTED_OR_UNKNOWN_FIELD';end if;
  v_child:=md5(p_request_id::text||':'||(v_item->>'id'))::uuid;
  v_result:=public.deer_mutate('task',v_child,v_item->'payload',(v_item->>'id')::uuid,(v_item->>'expected_version')::bigint);
  v_rows:=v_rows||jsonb_build_array(v_result);
 end loop;
 v_result:=jsonb_build_object('rows',v_rows);
 insert into public.mutation_requests(owner_id,request_id,operation,payload_hash,entity_id,resulting_version,result_json) values(v_owner,p_request_id,'task.batch',v_hash,p_request_id,1,v_result);
 return v_result;
end;
$$;
revoke all on function public.deer_task_batch(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.deer_task_batch(uuid,jsonb) to authenticated;
-- Activate this function as the Custom Access Token Hook in Supabase Auth.
-- It leaves ordinary password sessions unchanged and binds configured MCP tokens
-- to the MCP resource URI. It is intentionally not callable by app users.
create function public.deer_mcp_access_token_hook(event jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_claims jsonb:=event->'claims';v_client text:=coalesce(event->>'client_id',event->'claims'->>'client_id');v_resource text;
begin
 if v_client is not null then
  select mcp_resource into v_resource from public.profiles where id=(event->>'user_id')::uuid and is_enabled and mcp_read and mcp_client_id=v_client;
  if found then v_claims:=jsonb_set(v_claims,'{aud}',to_jsonb(v_resource));end if;
 end if;
 return jsonb_set(event,'{claims}',v_claims);
end;
$$;
revoke all on function public.deer_mcp_access_token_hook(jsonb) from public,anon,authenticated;
do $$ begin if exists(select 1 from pg_roles where rolname='supabase_auth_admin') then
 grant usage on schema public to supabase_auth_admin;
 grant execute on function public.deer_mcp_access_token_hook(jsonb) to supabase_auth_admin;
end if;end;$$;

commit;

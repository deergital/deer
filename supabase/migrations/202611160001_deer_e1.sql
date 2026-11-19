-- Deer E1. Apply as migration administrator on a fresh Supabase project.
-- auth.users/auth.uid()/anon/authenticated are supplied by Supabase.
begin;
create table public.profiles (
 id uuid primary key references auth.users(id),
 is_enabled boolean not null default false,
 display_name varchar(100) not null check(length(btrim(display_name))>0),
 timezone text not null default 'America/Cancun',
 theme text not null default 'system' check(theme in ('system','light','dark')),
 density text not null default 'comfortable' check(density in ('comfortable','compact')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version>0)
);
create table public.projects (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id),
 name varchar(160) not null check(length(btrim(name))>0),
 objective text not null default '' check(length(objective)<=10000),
 status text not null default 'active' check(status in ('active','paused','closed')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version>0),unique(id,owner_id)
);
create table public.tasks (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id),project_id uuid,
 title varchar(240) not null check(length(btrim(title))>0),description text not null default '' check(length(description)<=50000),
 status text not null default 'todo' check(status in ('todo','in_progress','in_review','waiting','done')),
 importance text not null default 'medium' check(importance in ('high','medium','low')),
 start_date date,due_date date,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version>0),
 foreign key(project_id,owner_id) references public.projects(id,owner_id),
 check(start_date is null or due_date is null or start_date<=due_date)
);
create table public.mutation_requests (
 owner_id uuid not null references public.profiles(id),request_id uuid not null,
 operation text not null,payload_hash text not null,entity_id uuid not null,
 resulting_version bigint not null,result_json jsonb not null,created_at timestamptz not null default now(),
 primary key(owner_id,request_id)
);
create table public.activity_events (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references public.profiles(id),
 actor_id uuid not null references public.profiles(id),request_id uuid not null,
 entity_type text not null check(entity_type in ('project','task','profile')),entity_id uuid not null,
 action text not null check(action in ('created','updated','status_changed')),
 from_version bigint,to_version bigint not null,changed_fields text[] not null,
 occurred_at timestamptz not null default now()
);
create index projects_owner_state_updated on public.projects(owner_id,status,updated_at desc,id);
create index tasks_owner_state_due on public.tasks(owner_id,status,due_date,id);
create index tasks_owner_project_state on public.tasks(owner_id,project_id,status,id);
create index events_owner_time on public.activity_events(owner_id,occurred_at desc,id);
create index events_actor on public.activity_events(actor_id);

-- SECURITY DEFINER is intentionally limited to enabled-account lookup and the
-- atomic mutation boundary. Empty search_path and explicit auth ownership.
create function public.deer_is_enabled() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=auth.uid() and is_enabled);
$$;
revoke all on function public.deer_is_enabled() from public,anon,authenticated;
grant execute on function public.deer_is_enabled() to authenticated;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.mutation_requests enable row level security;
alter table public.activity_events enable row level security;
revoke all on public.profiles,public.projects,public.tasks,public.mutation_requests,public.activity_events from public,anon,authenticated;
grant select on public.profiles,public.projects,public.tasks,public.activity_events to authenticated;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() and public.deer_is_enabled());
create policy project_read on public.projects for select to authenticated using(owner_id=auth.uid() and public.deer_is_enabled());
create policy task_read on public.tasks for select to authenticated using(owner_id=auth.uid() and public.deer_is_enabled());
create policy event_read on public.activity_events for select to authenticated using(owner_id=auth.uid() and public.deer_is_enabled());
-- No direct INSERT/UPDATE/DELETE policies: writes only through deer_mutate.

create function public.deer_mutate(p_kind text,p_request_id uuid,p_payload jsonb,p_id uuid default null,p_expected_version bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_owner uuid:=auth.uid();v_id uuid;v_hash text;v_receipt public.mutation_requests%rowtype;
 v_project public.projects%rowtype;v_task public.tasks%rowtype;v_profile public.profiles%rowtype;
 v_before jsonb;v_after jsonb;v_allowed text[];v_changed text[];v_operation text;v_project_state text;v_key text;
begin
 if v_owner is null or not public.deer_is_enabled() then raise exception using errcode='42501',message='DEER_ACCESS_DENIED';end if;
 if p_request_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then
  raise exception using errcode='22023',message='DEER_INVALID_PAYLOAD';end if;
 if p_expected_version is not null and (p_expected_version<1 or p_id is null) then
  raise exception using errcode='22023',message='DEER_INVALID_VERSION';end if;
 case p_kind
  when 'project' then v_allowed:=array['name','objective','status'];
  when 'task' then v_allowed:=array['title','description','project_id','status','importance','start_date','due_date'];
  when 'profile' then v_allowed:=array['display_name','timezone','theme','density'];
  else raise exception using errcode='22023',message='DEER_INVALID_KIND';
 end case;
 if exists(select 1 from jsonb_object_keys(p_payload) k where not(k=any(v_allowed))) then
  raise exception using errcode='22023',message='DEER_PROTECTED_OR_UNKNOWN_FIELD';end if;
 for v_key in select jsonb_object_keys(p_payload) loop
  if v_key in ('project_id','start_date','due_date') then
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
   v_project:=jsonb_populate_record(null::public.projects,jsonb_build_object('id',v_id,'owner_id',v_owner,'objective','','status','active','version',1,'created_at',now(),'updated_at',now())||p_payload);
   insert into public.projects select (v_project).* returning to_jsonb(projects.*) into v_after;
  else
   select * into v_project from public.projects where id=v_id and owner_id=v_owner for update;
   if not found then raise exception using errcode='P0002',message='DEER_NOT_FOUND';end if;
   if v_project.version<>p_expected_version then raise exception using errcode='P0001',message='DEER_VERSION_CONFLICT';end if;
   v_before:=to_jsonb(v_project);v_project:=jsonb_populate_record(v_project,p_payload);
   v_after:=to_jsonb(v_project);
   if v_before<>v_after then
    update public.projects set name=v_project.name,objective=v_project.objective,status=v_project.status,version=version+1,updated_at=clock_timestamp() where id=v_id returning to_jsonb(projects.*) into v_after;
   end if;
  end if;
 elsif p_kind='task' then
  if p_expected_version is null then
   v_task:=jsonb_populate_record(null::public.tasks,jsonb_build_object('id',v_id,'owner_id',v_owner,'description','','status','todo','importance','medium','version',1,'created_at',now(),'updated_at',now())||p_payload);
  else
   select * into v_task from public.tasks where id=v_id and owner_id=v_owner for update;
   if not found then raise exception using errcode='P0002',message='DEER_NOT_FOUND';end if;
   if v_task.version<>p_expected_version then raise exception using errcode='P0001',message='DEER_VERSION_CONFLICT';end if;
   v_before:=to_jsonb(v_task);v_task:=jsonb_populate_record(v_task,p_payload);
  end if;
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
   update public.tasks set title=v_task.title,description=v_task.description,project_id=v_task.project_id,status=v_task.status,importance=v_task.importance,start_date=v_task.start_date,due_date=v_task.due_date,version=version+1,updated_at=clock_timestamp() where id=v_id returning to_jsonb(tasks.*) into v_after;
  end if;
 else
  if p_expected_version is null or p_id is distinct from v_owner then raise exception using errcode='42501',message='DEER_PROFILE_PROTECTED';end if;
  select * into v_profile from public.profiles where id=v_owner for update;
  if v_profile.version<>p_expected_version then raise exception using errcode='P0001',message='DEER_VERSION_CONFLICT';end if;
  v_before:=to_jsonb(v_profile);v_profile:=jsonb_populate_record(v_profile,p_payload);
  if not exists(select 1 from pg_timezone_names where name=v_profile.timezone) then raise exception using errcode='22023',message='DEER_INVALID_TIMEZONE';end if;
  v_after:=to_jsonb(v_profile);
  if v_before<>v_after then
   update public.profiles set display_name=v_profile.display_name,timezone=v_profile.timezone,theme=v_profile.theme,density=v_profile.density,version=version+1,updated_at=clock_timestamp() where id=v_owner returning to_jsonb(profiles.*) into v_after;
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
revoke all on function public.deer_mutate(text,uuid,jsonb,uuid,bigint) from public,anon,authenticated;
grant execute on function public.deer_mutate(text,uuid,jsonb,uuid,bigint) to authenticated;
commit;

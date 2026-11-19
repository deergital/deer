-- E2.1: private Markdown documents. Apply after both E1 migrations.
begin;
create table public.documents (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id),
 project_id uuid,
 title varchar(240) not null check(length(btrim(title))>0),
 kind text not null default 'note' check(kind in ('note','brief','diagnosis','proposal','meeting','report','reference')),
 content_md text not null default '' check(length(content_md)<=50000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version bigint not null default 1 check(version>0),
 foreign key(project_id,owner_id) references public.projects(id,owner_id)
);
create index documents_owner_updated on public.documents(owner_id,updated_at desc,id);
create index documents_owner_project_kind on public.documents(owner_id,project_id,kind,id);
alter table public.documents enable row level security;
revoke all on public.documents from public,anon,authenticated;
grant select on public.documents to authenticated;
create policy document_read on public.documents for select to authenticated
 using(owner_id=auth.uid() and public.deer_is_enabled());
alter table public.activity_events drop constraint activity_events_entity_type_check;
alter table public.activity_events add constraint activity_events_entity_type_check
 check(entity_type in ('project','task','profile','document'));

create function public.deer_document_mutate(p_request_id uuid,p_payload jsonb,p_id uuid default null,p_expected_version bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_owner uuid:=auth.uid();v_id uuid;v_hash text;v_key text;v_state text;
 v_receipt public.mutation_requests%rowtype;v_doc public.documents%rowtype;
 v_before jsonb;v_after jsonb;v_changed text[];
begin
 if v_owner is null or not public.deer_is_enabled() then raise exception using errcode='42501',message='DEER_ACCESS_DENIED';end if;
 if p_request_id is null or p_payload is null or jsonb_typeof(p_payload)<>'object' then raise exception using errcode='22023',message='DEER_INVALID_PAYLOAD';end if;
 if p_expected_version is not null and (p_expected_version<1 or p_id is null) then raise exception using errcode='22023',message='DEER_INVALID_VERSION';end if;
 for v_key in select jsonb_object_keys(p_payload) loop
  if not(v_key=any(array['title','kind','content_md','project_id'])) then raise exception using errcode='22023',message='DEER_PROTECTED_OR_UNKNOWN_FIELD';end if;
  if v_key='project_id' then
   if jsonb_typeof(p_payload->v_key) not in ('string','null') then raise exception using errcode='22023',message='DEER_INVALID_FIELD_TYPE';end if;
  elsif jsonb_typeof(p_payload->v_key)<>'string' then raise exception using errcode='22023',message='DEER_INVALID_FIELD_TYPE';end if;
 end loop;
 if p_payload?'title' then p_payload:=jsonb_set(p_payload,'{title}',to_jsonb(btrim(p_payload->>'title')));end if;
 perform pg_advisory_xact_lock(hashtextextended(v_owner::text||p_request_id::text,0));
 v_hash:=encode(sha256(convert_to(jsonb_build_object('kind','document','id',p_id,'version',p_expected_version,'payload',p_payload)::text,'UTF8')),'hex');
 select * into v_receipt from public.mutation_requests where owner_id=v_owner and request_id=p_request_id;
 if found then
  if v_receipt.payload_hash<>v_hash then raise exception using errcode='P0001',message='DEER_IDEMPOTENCY_CONFLICT';end if;
  return v_receipt.result_json;
 end if;
 v_id:=coalesce(p_id,gen_random_uuid());
 if p_expected_version is null then
  v_doc:=jsonb_populate_record(null::public.documents,jsonb_build_object('id',v_id,'owner_id',v_owner,'kind','note','content_md','','version',1,'created_at',now(),'updated_at',now())||p_payload);
 else
  select * into v_doc from public.documents where id=v_id and owner_id=v_owner for update;
  if not found then raise exception using errcode='P0002',message='DEER_NOT_FOUND';end if;
  if v_doc.version<>p_expected_version then raise exception using errcode='P0001',message='DEER_VERSION_CONFLICT';end if;
  v_before:=to_jsonb(v_doc);v_doc:=jsonb_populate_record(v_doc,p_payload);
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
  update public.documents set title=v_doc.title,kind=v_doc.kind,project_id=v_doc.project_id,content_md=v_doc.content_md,version=version+1,updated_at=clock_timestamp() where id=v_id returning to_jsonb(documents.*) into v_after;
 end if;
 select coalesce(array_agg(k order by k),array[]::text[]) into v_changed from unnest(array['title','kind','project_id','content_md']) k where (v_before->k) is distinct from (v_after->k);
 if v_before is null or cardinality(v_changed)>0 then
  insert into public.activity_events(owner_id,actor_id,request_id,entity_type,entity_id,action,from_version,to_version,changed_fields)
  values(v_owner,v_owner,p_request_id,'document',v_id,case when v_before is null then 'created' else 'updated' end,(v_before->>'version')::bigint,(v_after->>'version')::bigint,v_changed);
 end if;
 insert into public.mutation_requests(owner_id,request_id,operation,payload_hash,entity_id,resulting_version,result_json)
 values(v_owner,p_request_id,case when p_expected_version is null then 'document.create' else 'document.update' end,v_hash,v_id,(v_after->>'version')::bigint,v_after);
 return v_after;
end;
$$;
revoke all on function public.deer_document_mutate(uuid,jsonb,uuid,bigint) from public,anon,authenticated;
grant execute on function public.deer_document_mutate(uuid,jsonb,uuid,bigint) to authenticated;

create or replace function public.deer_export_backup() returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or not public.deer_is_enabled() then raise exception using errcode='42501',message='DEER_ACCESS_DENIED';end if;
 return jsonb_build_object('format','deer-e1-backup','schema_version',2,'exported_at',now(),'owner_id',auth.uid(),
 'profiles',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from public.profiles p where p.id=auth.uid()),
 'projects',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from public.projects p where p.owner_id=auth.uid()),
 'tasks',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.tasks t where t.owner_id=auth.uid()),
 'documents',(select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]'::jsonb) from public.documents d where d.owner_id=auth.uid()));
end;
$$;
commit;

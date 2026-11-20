-- E2 word processor: preserve existing Markdown and assets; rich content is additive.
begin;
alter table public.documents add column content_json jsonb;
alter table public.documents add constraint documents_rich_content_check check(content_json is null or (jsonb_typeof(content_json)='object' and coalesce(content_json->>'type'='doc',false) and octet_length(content_json::text)<=500000));
create or replace function public.deer_document_mutate_base(p_request_id uuid,p_payload jsonb,p_id uuid default null,p_expected_version bigint default null)
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
  if not(v_key=any(array['title','kind','content_md','project_id','content_json'])) then raise exception using errcode='22023',message='DEER_PROTECTED_OR_UNKNOWN_FIELD';end if;
  if v_key='content_json' then
   if jsonb_typeof(p_payload->v_key) not in ('object','null') then raise exception using errcode='22023',message='DEER_INVALID_FIELD_TYPE';end if;
  elsif v_key='project_id' then
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
  if v_doc.content_json is not null and p_payload?'content_md' and not(p_payload?'content_json') then raise exception using errcode='22023',message='DEER_REFRESH_REQUIRED';end if;
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
  update public.documents set title=v_doc.title,kind=v_doc.kind,project_id=v_doc.project_id,content_md=v_doc.content_md,content_json=v_doc.content_json,version=version+1,updated_at=clock_timestamp() where id=v_id returning to_jsonb(documents.*) into v_after;
 end if;
 select coalesce(array_agg(k order by k),array[]::text[]) into v_changed from unnest(array['title','kind','project_id','content_md','content_json']) k where (v_before->k) is distinct from (v_after->k);
 if v_before is null or cardinality(v_changed)>0 then
  insert into public.activity_events(owner_id,actor_id,request_id,entity_type,entity_id,action,from_version,to_version,changed_fields)
  values(v_owner,v_owner,p_request_id,'document',v_id,case when v_before is null then 'created' else 'updated' end,(v_before->>'version')::bigint,(v_after->>'version')::bigint,v_changed);
 end if;
 insert into public.mutation_requests(owner_id,request_id,operation,payload_hash,entity_id,resulting_version,result_json)
 values(v_owner,p_request_id,case when p_expected_version is null then 'document.create' else 'document.update' end,v_hash,v_id,(v_after->>'version')::bigint,v_after);
 return v_after;
end;
$$;
revoke all on function public.deer_document_mutate_base(uuid,jsonb,uuid,bigint) from public,anon,authenticated;
create or replace function public.deer_document_mutate(p_request_id uuid,p_payload jsonb,p_id uuid default null,p_expected_version bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;v_doc public.documents%rowtype;v_match text[];v_id uuid;v_exists boolean;
begin
 v_result:=public.deer_document_mutate_base(p_request_id,p_payload,p_id,p_expected_version);
 select * into v_doc from public.documents where id=(v_result->>'id')::uuid and owner_id=auth.uid() for update;
 -- A late retry must not replace links of a newer version.
 if v_doc.version<>(v_result->>'version')::bigint then return v_result;end if;
 delete from public.document_links where source_id=v_doc.id;
 for v_match in select regexp_matches(v_doc.content_md||coalesce(v_doc.content_json::text,''),'deer://(document|project|task)/([a-fA-F0-9-]{36})','g') loop
  v_id:=v_match[2]::uuid;
  if v_match[1]='document' then select exists(select 1 from public.documents where id=v_id and owner_id=auth.uid()) into v_exists;
  elsif v_match[1]='project' then select exists(select 1 from public.projects where id=v_id and owner_id=auth.uid()) into v_exists;
  else select exists(select 1 from public.tasks where id=v_id and owner_id=auth.uid()) into v_exists;end if;
  if not v_exists then raise exception 'DEER_LINK_NOT_ACCESSIBLE';end if;
  insert into public.document_links(owner_id,source_id,target_type,target_id) values(auth.uid(),v_doc.id,v_match[1],v_id) on conflict do nothing;
 end loop;
 for v_match in select regexp_matches(v_doc.content_md||coalesce(v_doc.content_json::text,''),'deer-asset:([a-fA-F0-9-]{36})','g') loop
  if not exists(select 1 from public.document_assets where id=v_match[1]::uuid and owner_id=auth.uid()) then raise exception 'DEER_ASSET_NOT_ACCESSIBLE';end if;
 end loop;
 return v_result;
end;
$$;

create or replace function public.deer_export_backup() returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or not public.deer_is_enabled() then raise exception using errcode='42501',message='DEER_ACCESS_DENIED';end if;
 return jsonb_build_object('format','deer-e1-backup','schema_version',4,'exported_at',now(),'owner_id',auth.uid(),
 'profiles',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from public.profiles p where p.id=auth.uid()),
 'projects',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from public.projects p where p.owner_id=auth.uid()),
 'tasks',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.tasks t where t.owner_id=auth.uid()),
 'documents',(select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]'::jsonb) from public.documents d where d.owner_id=auth.uid()),
 'document_assets',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) from public.document_assets a where a.owner_id=auth.uid()),
 'document_links',(select coalesce(jsonb_agg(to_jsonb(l) order by l.source_id,l.target_type,l.target_id),'[]'::jsonb) from public.document_links l where l.owner_id=auth.uid()));
end;
$$;

commit;

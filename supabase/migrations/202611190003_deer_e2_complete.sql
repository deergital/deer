-- Apply once after 202611190002. Uses Supabase's existing storage schema.
begin;
create table public.document_assets (
 id uuid primary key,owner_id uuid not null references public.profiles(id),
 document_id uuid not null references public.documents(id),
 name varchar(240) not null check(length(btrim(name))>0),
 mime_type text not null check(mime_type in ('image/png','image/jpeg','image/webp','image/gif','application/pdf','text/plain','text/markdown','application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation')),
 size_bytes integer not null check(size_bytes>0 and size_bytes<=4194304),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 storage_path text not null unique,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index document_assets_owner_doc on public.document_assets(owner_id,document_id,id);
create table public.document_links (
 owner_id uuid not null references public.profiles(id),
 source_id uuid not null references public.documents(id),
 target_type text not null check(target_type in ('document','project','task')),
 target_id uuid not null,
 primary key(source_id,target_type,target_id)
);
create index document_links_target on public.document_links(owner_id,target_type,target_id);
alter table public.document_assets enable row level security;
alter table public.document_links enable row level security;
revoke all on public.document_assets,public.document_links from public,anon,authenticated;
grant select on public.document_assets,public.document_links to authenticated;
create policy asset_read on public.document_assets for select to authenticated using(owner_id=auth.uid() and public.deer_is_enabled());
create policy link_read on public.document_links for select to authenticated using(owner_id=auth.uid() and public.deer_is_enabled());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('deer-private','deer-private',false,4194304,array['image/png','image/jpeg','image/webp','image/gif','application/pdf','text/plain','text/markdown','application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation']);
create policy deer_storage_read on storage.objects for select to authenticated
 using(bucket_id='deer-private' and split_part(name,'/',1)=auth.uid()::text and public.deer_is_enabled());
create policy deer_storage_upload on storage.objects for insert to authenticated
 with check(bucket_id='deer-private' and split_part(name,'/',1)=auth.uid()::text and name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}$' and public.deer_is_enabled());
-- No UPDATE/DELETE policies: registered files are immutable in E2.

create function public.deer_register_asset(p_id uuid,p_document_id uuid,p_name text,p_mime text,p_size integer,p_sha256 text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_owner uuid:=auth.uid();v_row public.document_assets%rowtype;v_path text;
begin
 if v_owner is null or not public.deer_is_enabled() then raise exception using errcode='42501',message='DEER_ACCESS_DENIED';end if;
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
revoke all on function public.deer_register_asset(uuid,uuid,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.deer_register_asset(uuid,uuid,text,text,integer,text) to authenticated;

-- Keep the tested E2.1 atomic mutation, and index references in its transaction.
alter function public.deer_document_mutate(uuid,jsonb,uuid,bigint) rename to deer_document_mutate_base;
revoke all on function public.deer_document_mutate_base(uuid,jsonb,uuid,bigint) from public,anon,authenticated;
create function public.deer_document_mutate(p_request_id uuid,p_payload jsonb,p_id uuid default null,p_expected_version bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;v_doc public.documents%rowtype;v_match text[];v_id uuid;v_exists boolean;
begin
 v_result:=public.deer_document_mutate_base(p_request_id,p_payload,p_id,p_expected_version);
 select * into v_doc from public.documents where id=(v_result->>'id')::uuid and owner_id=auth.uid() for update;
 -- A late retry must not replace links of a newer version.
 if v_doc.version<>(v_result->>'version')::bigint then return v_result;end if;
 delete from public.document_links where source_id=v_doc.id;
 for v_match in select regexp_matches(v_doc.content_md,'deer://(document|project|task)/([a-fA-F0-9-]{36})','g') loop
  v_id:=v_match[2]::uuid;
  if v_match[1]='document' then select exists(select 1 from public.documents where id=v_id and owner_id=auth.uid()) into v_exists;
  elsif v_match[1]='project' then select exists(select 1 from public.projects where id=v_id and owner_id=auth.uid()) into v_exists;
  else select exists(select 1 from public.tasks where id=v_id and owner_id=auth.uid()) into v_exists;end if;
  if not v_exists then raise exception 'DEER_LINK_NOT_ACCESSIBLE';end if;
  insert into public.document_links(owner_id,source_id,target_type,target_id) values(auth.uid(),v_doc.id,v_match[1],v_id) on conflict do nothing;
 end loop;
 for v_match in select regexp_matches(v_doc.content_md,'deer-asset:([a-fA-F0-9-]{36})','g') loop
  if not exists(select 1 from public.document_assets where id=v_match[1]::uuid and owner_id=auth.uid()) then raise exception 'DEER_ASSET_NOT_ACCESSIBLE';end if;
 end loop;
 return v_result;
end;
$$;
revoke all on function public.deer_document_mutate(uuid,jsonb,uuid,bigint) from public,anon,authenticated;
grant execute on function public.deer_document_mutate(uuid,jsonb,uuid,bigint) to authenticated;

create or replace function public.deer_export_backup() returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or not public.deer_is_enabled() then raise exception using errcode='42501',message='DEER_ACCESS_DENIED';end if;
 return jsonb_build_object('format','deer-e1-backup','schema_version',3,'exported_at',now(),'owner_id',auth.uid(),
 'profiles',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from public.profiles p where p.id=auth.uid()),
 'projects',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from public.projects p where p.owner_id=auth.uid()),
 'tasks',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.tasks t where t.owner_id=auth.uid()),
 'documents',(select coalesce(jsonb_agg(to_jsonb(d) order by d.id),'[]'::jsonb) from public.documents d where d.owner_id=auth.uid()),
 'document_assets',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]'::jsonb) from public.document_assets a where a.owner_id=auth.uid()),
 'document_links',(select coalesce(jsonb_agg(to_jsonb(l) order by l.source_id,l.target_type,l.target_id),'[]'::jsonb) from public.document_links l where l.owner_id=auth.uid()));
end;
$$;
commit;

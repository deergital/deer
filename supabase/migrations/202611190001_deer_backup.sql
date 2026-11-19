-- Apply AFTER 202611160001_deer_e1.sql. Read-only, consistent owner snapshot.
begin;
create function public.deer_export_backup() returns jsonb
language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or not public.deer_is_enabled() then
  raise exception using errcode='42501',message='DEER_ACCESS_DENIED';
 end if;
 return jsonb_build_object(
  'format','deer-e1-backup','schema_version',1,'exported_at',now(),
  'owner_id',auth.uid(),
  'profiles',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from public.profiles p where p.id=auth.uid()),
  'projects',(select coalesce(jsonb_agg(to_jsonb(p) order by p.id),'[]'::jsonb) from public.projects p where p.owner_id=auth.uid()),
  'tasks',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.tasks t where t.owner_id=auth.uid())
 );
end;
$$;
revoke all on function public.deer_export_backup() from public,anon,authenticated;
grant execute on function public.deer_export_backup() to authenticated;
commit;

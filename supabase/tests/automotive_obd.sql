begin;
set local role service_role;
do $$
declare fixture_id uuid:=gen_random_uuid(); n integer;
begin
 if has_table_privilege('anon','public.automotive_obd_sessions','SELECT')
 or has_table_privilege('authenticated','public.automotive_obd_sessions','INSERT')
 then raise exception 'Unexpected public access'; end if;
 if not(select relrowsecurity from pg_class where oid='public.automotive_obd_sessions'::regclass)
 then raise exception 'Missing RLS'; end if;
 insert into public.automotive_obd_sessions(tenant_id,id,data)
 values('obd-isolation-fixture',fixture_id,jsonb_build_object('id',fixture_id,'sequence',0));
 update public.automotive_obd_sessions set sequence=1,data=data||'{"sequence":1}'
 where tenant_id='obd-isolation-fixture' and id=fixture_id and sequence=0;
 get diagnostics n=row_count;if n<>1 then raise exception 'Initial update failed'; end if;
 update public.automotive_obd_sessions set sequence=2,data=data||'{"sequence":2}'
 where tenant_id='wrong-tenant' and id=fixture_id and sequence=1;
 get diagnostics n=row_count;if n<>0 then raise exception 'Cross tenant write'; end if;
 update public.automotive_obd_sessions set sequence=2,data=data||'{"sequence":2}'
 where tenant_id='obd-isolation-fixture' and id=fixture_id and sequence=0;
 get diagnostics n=row_count;if n<>0 then raise exception 'Stale sequence write'; end if;
end $$;
rollback;

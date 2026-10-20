-- Synthetic fixtures only; rollback leaves no test records behind.
begin;
set local role service_role;
do $$
declare
 fixture_id uuid;
 match_count integer;
 updated_count integer;
 v extensions.vector(1536) := ('[1,'||repeat('0,',1534)||'0]')::extensions.vector;
begin
 if has_table_privilege('anon','public.automotive_records','SELECT')
 or has_table_privilege('anon','public.automotive_records','INSERT')
 or has_table_privilege('authenticated','public.automotive_records','SELECT')
 or has_table_privilege('authenticated','public.automotive_records','UPDATE')
 or has_function_privilege('authenticated','public.automotive_rank_knowledge(text,text,text,text,integer,extensions.vector)','EXECUTE')
 then raise exception 'Public automotive access unexpectedly granted'; end if;
 if not (select relrowsecurity from pg_class where oid='public.automotive_records'::regclass)
 then raise exception 'Automotive RLS missing'; end if;
 for match_count in 1..3 loop
  fixture_id := gen_random_uuid();
  insert into public.automotive_records(tenant_id,kind,id,data,embedding)
  values(case when match_count=3 then 'synthetic-automotive-b' else 'synthetic-automotive-a' end,
   'knowledge',fixture_id,jsonb_build_object('id',fixture_id,'make','SYNTHETIC','model','FIXTURE',
    'engine',case when match_count=2 then 'wrong-engine' else 'fixture-engine' end,
    'yearFrom',2010,'yearTo',2010),v);
 end loop;
 select count(*) into match_count from public.automotive_rank_knowledge('synthetic-automotive-a','SYNTHETIC','FIXTURE','fixture-engine',2010,v);
 if match_count<>1 then raise exception 'Tenant/engine vector isolation failed'; end if;
 select count(*) into match_count from public.automotive_rank_knowledge('synthetic-automotive-a','SYNTHETIC','FIXTURE','fixture-engine',2011,v);
 if match_count<>0 then raise exception 'Vehicle year isolation failed'; end if;
 fixture_id:=gen_random_uuid();
 insert into public.automotive_records(tenant_id,kind,id,data) values('synthetic-automotive-a','case',fixture_id,jsonb_build_object('id',fixture_id,'revision',0));
 update public.automotive_records set revision=1,data=data||'{"revision":1}' where tenant_id='synthetic-automotive-a' and kind='case' and id=fixture_id and revision=0;
 get diagnostics updated_count=row_count;
 if updated_count<>1 then raise exception 'Initial case update failed'; end if;
 update public.automotive_records set revision=1,data=data||'{"revision":1}' where tenant_id='synthetic-automotive-a' and kind='case' and id=fixture_id and revision=0;
 get diagnostics updated_count=row_count;
 if updated_count<>0 then raise exception 'Stale revision overwrote a case'; end if;
end $$;
rollback;

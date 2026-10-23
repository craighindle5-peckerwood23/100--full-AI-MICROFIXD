-- Reuse the canonical mission spine; no parallel job store or local state file.
create or replace function public.enqueue_source_repair(p_tenant text,p_fingerprint text,p_objective text,p_paths jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare mid uuid; worker uuid:=gen_random_uuid(); m jsonb; task jsonb;
begin
 if p_tenant is null or length(trim(p_tenant))=0 or length(p_tenant)>200 or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' or p_objective is null or length(p_objective)>4000 or p_paths is null
 or jsonb_typeof(p_paths)<>'array' or jsonb_array_length(p_paths) not between 1 and 3 then raise exception 'INVALID_REPAIR_INCIDENT'; end if;
 if exists(select 1 from jsonb_array_elements_text(p_paths) x where x !~ '^(server|src|microfixd)/[a-zA-Z0-9_./-]+\.(ts|tsx|js|mjs)$' or x like '%..%') then raise exception 'INVALID_REPAIR_PATH'; end if;
 -- Global lock makes the quotas and deduplication atomic across server instances.
 perform pg_advisory_xact_lock(192623,712);
 select id into mid from public.spine_rows where kind='missions' and tenant_id=p_tenant and data#>>'{constraints,repair_fingerprint}'=p_fingerprint limit 1;
 if mid is not null then return mid; end if;
 if (select count(*) from public.spine_rows where kind='missions' and data#>>'{constraints,automatic_source_repair}'='true' and (data->>'created_at')::timestamptz>now()-interval '1 hour')>=2
 or (select count(*) from public.spine_rows where kind='missions' and data#>>'{constraints,automatic_source_repair}'='true' and (data->>'created_at')::timestamptz>now()-interval '24 hours')>=6 then return null; end if;
 mid:=gen_random_uuid();
 task:=jsonb_build_object('agent_id',null,'tool_permissions',jsonb_build_array('repair_source_code'),'input_context',jsonb_build_object('source_incident',true),
 'expected_output_schema',jsonb_build_object('type','object','required',jsonb_build_array('result'),'properties',jsonb_build_object('result',jsonb_build_object('type','object')),'additionalProperties',false),
 'subtasks',jsonb_build_array(jsonb_build_object('agent_id',null,'input','{}'::jsonb,'tool_request',jsonb_build_object('name','repair_source_code','arguments',jsonb_build_object('objective',p_objective,'paths_json',p_paths::text)))));
 m:=jsonb_build_object('mission_id',mid,'tenant_id',p_tenant,'created_by','automatic-source-repair','created_at',now(),'objective',p_objective,'status','queued','result_artifact_id',null,
 'constraints',jsonb_build_object('plan',jsonb_build_array(task),'max_tokens',24000,'deadline_at',now()+interval '45 minutes','completion_policy','objective-v1','tool_permissions',jsonb_build_array('repair_source_code'),
 'tool_approval_mode','preauthorized','approval_actor','owner-standing-source-repair-authorization','browser_origins','[]'::jsonb,'automatic_source_repair',true,'repair_fingerprint',p_fingerprint));
 if not public.spine_lease(p_tenant,mid,worker,false) then raise exception 'REPAIR_QUEUE_BUSY'; end if;
 perform public.spine_commit(p_tenant,mid,worker,jsonb_build_array(jsonb_build_object('op','insert','kind','missions','id',mid,'data',m)));
 perform public.spine_lease(p_tenant,mid,worker,true);
 return mid;
end $$;
revoke all on function public.enqueue_source_repair(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.enqueue_source_repair(text,text,text,jsonb) to service_role;

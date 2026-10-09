begin;
set local role service_role;
do $$
declare m uuid:=gen_random_uuid(); t uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); owner_a uuid:=gen_random_uuid(); owner_b uuid:=gen_random_uuid(); run uuid:=gen_random_uuid(); denied boolean:=false; tenant text:='spine-regression';
begin
 if not public.spine_lease(tenant,m,owner_a,false) then raise exception 'lease acquisition failed';end if;
 if public.spine_lease(tenant,m,owner_b,false) then raise exception 'concurrent owner acquired lease';end if;
 perform public.spine_commit(tenant,m,owner_a,jsonb_build_array(
 jsonb_build_object('op','insert','kind','missions','id',m,'data',jsonb_build_object('mission_id',m,'tenant_id',tenant,'created_at',now(),'created_by','regression','objective','regression','constraints',jsonb_build_object('max_tokens',1000,'tool_permissions',jsonb_build_array('navigate_browser')),'status','queued','result_artifact_id',null)),
 jsonb_build_object('op','insert','kind','tasks','id',t,'data',jsonb_build_object('task_id',t,'mission_id',m,'tenant_id',tenant,'agent_id',null,'tool_permissions',jsonb_build_array('navigate_browser'),'input_context','{}'::jsonb,'expected_output_schema','{"type":"object"}'::jsonb,'status','queued','attempts',0)),
 jsonb_build_object('op','insert','kind','subtasks','id',s,'data',jsonb_build_object('subtask_id',s,'task_id',t,'tenant_id',tenant,'agent_id',null,'tool_request','{"name":"navigate_browser","arguments":{"url":"https://example.org"}}'::jsonb,'input','{}'::jsonb,'status','waiting_input','attempts',0,'raw_output',null,'normalized_output',null))));
 begin perform public.spine_commit(tenant,m,owner_b,'[]');exception when others then denied:=sqlerrm='LEASE_LOST';end;
 if not denied then raise exception 'stale owner not fenced';end if;
 if not public.spine_reserve_call(tenant,m,owner_a,run,'groq',700) then raise exception 'budget reservation failed';end if;
 if public.spine_reserve_call(tenant,m,owner_a,gen_random_uuid(),'groq',301) then raise exception 'budget exceeded';end if;
 perform public.spine_settle_call(tenant,m,owner_a,run,100);
 if (select reserved_tokens from public.spine_budgets where tenant_id=tenant and mission_id=m)<>100 then raise exception 'settlement incorrect';end if;
 denied:=false;
 begin perform public.spine_commit(tenant,m,owner_a,jsonb_build_array(jsonb_build_object('op','insert','kind','subtasks','id',gen_random_uuid(),'data',jsonb_build_object('tenant_id','other-tenant','task_id',t))));exception when others then denied:=sqlerrm='TENANT_MISMATCH';end;
 if not denied then raise exception 'cross tenant insert allowed';end if;
 if public.spine_start_tool(tenant,m,s,owner_a,'hash','{"name":"navigate_browser","arguments":{"url":"https://example.org"}}',true) then raise exception 'unapproved effect permitted';end if;
 insert into public.spine_approvals(tenant_id,mission_id,subtask_id,request_hash,request) values(tenant,m,s,'hash','{"name":"navigate_browser","arguments":{"url":"https://example.org"}}');
 perform public.spine_lease(tenant,m,owner_a,true);
 perform public.spine_decide(tenant,m,s,'hash','approved','regression-admin');
 if not public.spine_lease(tenant,m,owner_b,false) then raise exception 'released lease not recoverable';end if;
 if not public.spine_start_tool(tenant,m,s,owner_b,'hash','{"name":"navigate_browser","arguments":{"url":"https://example.org"}}',true) then raise exception 'approved action did not start';end if;
 denied:=false;
 begin perform public.spine_start_tool(tenant,m,s,owner_b,'hash','{"name":"navigate_browser","arguments":{"url":"https://example.org"}}',true);exception when others then denied:=true;end;
 if not denied and not exists(select 1 from public.spine_approvals where tenant_id=tenant and subtask_id=s and consumed_at is not null) then raise exception 'approval replay permitted';end if;
 perform public.spine_finish_tool(tenant,m,s,owner_b,'hash','{"raw":{},"normalized":{"result":{}},"evidence":{"test":true}}');
 if (select count(*) from public.spine_tool_runs where tenant_id=tenant and subtask_id=s)<>1 then raise exception 'duplicate tool run';end if;
 if has_table_privilege('authenticated','public.spine_rows','select') or has_table_privilege('anon','public.spine_rows','insert') or has_function_privilege('authenticated','public.spine_decide(text,uuid,uuid,text,text,text)','execute') then raise exception 'browser access granted';end if;
 if has_table_privilege('service_role','public.spine_events','update') or has_table_privilege('service_role','public.spine_events','delete') then raise exception 'audit mutation allowed';end if;
end $$;
reset role;
rollback;
select 'lease exclusion, fencing, budget settlement, tenant rejection, exact approval, effect ledger, browser denial and audit immutability passed' as result;

-- Apply after execution_spine_schema.sql and execution_spine_governance.sql.
create table public.spine_model_runs (
 tenant_id text not null,mission_id uuid not null,run_id uuid not null,provider text not null,
 reserved_tokens integer not null check(reserved_tokens>0),actual_tokens integer check(actual_tokens>=0),
 status text not null default 'reserved' check(status in ('reserved','settled')),
 created_at timestamptz not null default now(),primary key(tenant_id,run_id)
);
alter table public.spine_model_runs enable row level security;
revoke all on public.spine_model_runs from public,anon,authenticated,service_role;
grant select,insert,update on public.spine_model_runs to service_role;
create function public.spine_reserve_call(p_tenant text,p_mission uuid,p_owner uuid,p_run uuid,p_provider text,p_tokens integer) returns boolean language plpgsql security invoker set search_path='' as $$
declare maximum integer;
begin
 if p_tokens<1 or p_provider not in ('groq','gemini','openrouter','cloudflare') then raise exception 'INVALID_RESERVATION';end if;
 perform 1 from public.spine_leases where tenant_id=p_tenant and mission_id=p_mission and owner=p_owner and expires_at>now() for update;
 if not found then raise exception 'LEASE_LOST';end if;
 if exists(select 1 from public.spine_model_runs where tenant_id=p_tenant and run_id=p_run) then raise exception 'DUPLICATE_RESERVATION';end if;
 select least(100000,greatest(1,coalesce((data->'constraints'->>'max_tokens')::integer,32000))) into maximum from public.spine_rows where tenant_id=p_tenant and kind='missions' and id=p_mission;
 if not found then raise exception 'MISSION_NOT_FOUND';end if;
 insert into public.spine_budgets(tenant_id,mission_id) values(p_tenant,p_mission) on conflict do nothing;
 update public.spine_budgets set reserved_tokens=reserved_tokens+p_tokens where tenant_id=p_tenant and mission_id=p_mission and reserved_tokens+p_tokens<=maximum;
 if not found then return false;end if;
 insert into public.spine_model_runs(tenant_id,mission_id,run_id,provider,reserved_tokens) values(p_tenant,p_mission,p_run,p_provider,p_tokens);
 insert into public.spine_events(tenant_id,mission_id,operation) values(p_tenant,p_mission,jsonb_build_object('op','model_reserved','run_id',p_run,'provider',p_provider,'tokens',p_tokens));
 return true;
end $$;
create function public.spine_settle_call(p_tenant text,p_mission uuid,p_owner uuid,p_run uuid,p_tokens integer) returns void language plpgsql security invoker set search_path='' as $$
declare reserved integer;
begin
 if p_tokens<0 then raise exception 'INVALID_USAGE';end if;
 perform 1 from public.spine_leases where tenant_id=p_tenant and mission_id=p_mission and owner=p_owner and expires_at>now() for update;
 if not found then raise exception 'LEASE_LOST';end if;
 select reserved_tokens into reserved from public.spine_model_runs where tenant_id=p_tenant and mission_id=p_mission and run_id=p_run and status='reserved' for update;
 if not found then raise exception 'RUN_NOT_RESERVED';end if;
 update public.spine_model_runs set actual_tokens=p_tokens,status='settled' where tenant_id=p_tenant and run_id=p_run;
 update public.spine_budgets set reserved_tokens=reserved_tokens-reserved+p_tokens where tenant_id=p_tenant and mission_id=p_mission;
 insert into public.spine_events(tenant_id,mission_id,operation) values(p_tenant,p_mission,jsonb_build_object('op','model_settled','run_id',p_run,'tokens',p_tokens));
end $$;
create function public.spine_resume(p_tenant text,p_mission uuid,p_max_tokens integer,p_actor text) returns void language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_tenant||':'||p_mission::text,0));
 perform 1 from public.spine_leases where tenant_id=p_tenant and mission_id=p_mission and expires_at>now() for update;
 if found then raise exception 'MISSION_BUSY';end if;
 if p_actor is null or length(p_actor)=0 or p_max_tokens<1 or p_max_tokens>100000 then raise exception 'INVALID_RESUME';end if;
 if exists(select 1 from public.spine_tool_runs where tenant_id=p_tenant and mission_id=p_mission and status<>'succeeded') then raise exception 'RECONCILIATION_REQUIRED';end if;
 if exists(select 1 from public.spine_approvals where tenant_id=p_tenant and mission_id=p_mission and (status<>'approved' or consumed_at is null)) then raise exception 'APPROVAL_REQUIRED';end if;
 update public.spine_rows set data=jsonb_set(data,'{constraints,max_tokens}',to_jsonb(p_max_tokens))||'{"status":"queued"}' where tenant_id=p_tenant and kind='missions' and id=p_mission and data->>'status'='waiting';
 if not found then raise exception 'MISSION_NOT_WAITING';end if;
 update public.spine_rows set data=data||'{"status":"queued","attempts":0}' where tenant_id=p_tenant and mission_id=p_mission and kind='subtasks' and data->>'status' in ('waiting_input','failed');
 update public.spine_rows set data=data||'{"status":"queued"}' where tenant_id=p_tenant and mission_id=p_mission and kind='tasks' and data->>'status'='blocked';
 insert into public.spine_events(tenant_id,mission_id,operation) values(p_tenant,p_mission,jsonb_build_object('op','admin_resume','actor',p_actor,'max_tokens',p_max_tokens));
end $$;
revoke all on function public.spine_reserve_call(text,uuid,uuid,uuid,text,integer),public.spine_settle_call(text,uuid,uuid,uuid,integer),public.spine_resume(text,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.spine_reserve_call(text,uuid,uuid,uuid,text,integer),public.spine_settle_call(text,uuid,uuid,uuid,integer),public.spine_resume(text,uuid,integer,text) to service_role;

create function public.spine_validate_row() returns trigger language plpgsql security invoker set search_path='' as $$
declare parent public.spine_rows; expected_id text; status text; valid boolean;
begin
 expected_id=case new.kind when 'missions' then 'mission_id' when 'tasks' then 'task_id' when 'subtasks' then 'subtask_id' when 'artifacts' then 'artifact_id' else 'message_id' end;
 if jsonb_typeof(new.data)<>'object' or new.data->>'tenant_id' is distinct from new.tenant_id or (new.data->>expected_id)::uuid is distinct from new.id then raise exception 'INVALID_IDENTITY';end if;
 if tg_op='UPDATE' and (new.tenant_id,new.mission_id,new.kind,new.id) is distinct from (old.tenant_id,old.mission_id,old.kind,old.id) then raise exception 'IMMUTABLE_IDENTITY';end if;
 if tg_op='UPDATE' and new.kind in ('artifacts','messages') then raise exception 'IMMUTABLE_OUTPUT';end if;
 if new.kind='subtasks' then
  select * into parent from public.spine_rows where tenant_id=new.tenant_id and mission_id=new.mission_id and kind='tasks' and id=(new.data->>'task_id')::uuid;
  if not found then raise exception 'INVALID_PARENT';end if;
 else
  if (new.data->>'mission_id')::uuid is distinct from new.mission_id then raise exception 'MISSION_MISMATCH';end if;
  if new.kind<>'missions' and not exists(select 1 from public.spine_rows where tenant_id=new.tenant_id and kind='missions' and id=new.mission_id) then raise exception 'INVALID_PARENT';end if;
 end if;
 status=new.data->>'status';
 valid=case new.kind when 'missions' then status in ('queued','running','waiting','failed','succeeded') when 'tasks' then status in ('queued','running','blocked','failed','succeeded') when 'subtasks' then status in ('queued','running','waiting_input','failed','succeeded') else true end;
 if valid is distinct from true then raise exception 'INVALID_STATUS';end if;
 if new.kind in ('tasks','subtasks') and (jsonb_typeof(new.data->'attempts') is distinct from 'number' or (new.data->>'attempts')::integer<0) then raise exception 'INVALID_ATTEMPTS';end if;
 if tg_op='UPDATE' and old.data->>'status'='succeeded' and new.data->>'status' is distinct from 'succeeded' then raise exception 'TERMINAL_STATE';end if;
 if new.kind='artifacts' then
  if new.data->>'type' not in ('text','json','screenshot','audio','obd_data','mission_result') or new.data->>'type' is null or new.data->>'hash' is null or new.data->>'hash'!~'^[0-9a-f]{64}$' or jsonb_typeof(new.data->'evidence') is distinct from 'object' then raise exception 'INVALID_ARTIFACT';end if;
  if new.data->>'subtask_id' is not null then
   select * into parent from public.spine_rows where tenant_id=new.tenant_id and mission_id=new.mission_id and kind='subtasks' and id=(new.data->>'subtask_id')::uuid;
   if not found or parent.data->>'task_id' is distinct from new.data->>'task_id' then raise exception 'INVALID_ARTIFACT_PARENT';end if;
  end if;
 end if;
 if new.kind='messages' then
  if not exists(select 1 from public.spine_agents where tenant_id=new.tenant_id and agent_id=(new.data->>'from_agent')::uuid) or (new.data->>'to_agent' is not null and not exists(select 1 from public.spine_agents where tenant_id=new.tenant_id and agent_id=(new.data->>'to_agent')::uuid)) then raise exception 'UNKNOWN_AGENT';end if;
  if jsonb_typeof(new.data->'confidence') is distinct from 'number' or (new.data->>'confidence')::double precision not between 0 and 1 then raise exception 'INVALID_CONFIDENCE';end if;
 end if;
 if status='succeeded' then
  if new.kind='missions' and not exists(select 1 from public.spine_rows where tenant_id=new.tenant_id and mission_id=new.mission_id and kind='artifacts' and id=(new.data->>'result_artifact_id')::uuid and data->>'type'='mission_result') then raise exception 'FINAL_ARTIFACT_REQUIRED';end if;
  if new.kind='subtasks' and not exists(select 1 from public.spine_rows where tenant_id=new.tenant_id and mission_id=new.mission_id and kind='artifacts' and data->>'subtask_id'=new.id::text) then raise exception 'SUBTASK_ARTIFACT_REQUIRED';end if;
  if new.kind='tasks' and (not exists(select 1 from public.spine_rows where tenant_id=new.tenant_id and mission_id=new.mission_id and kind='subtasks' and data->>'task_id'=new.id::text) or exists(select 1 from public.spine_rows where tenant_id=new.tenant_id and mission_id=new.mission_id and kind='subtasks' and data->>'task_id'=new.id::text and data->>'status'<>'succeeded')) then raise exception 'INCOMPLETE_SUBTASKS';end if;
 end if;
 return new;
end $$;
create trigger spine_rows_validate before insert or update on public.spine_rows for each row execute function public.spine_validate_row();
revoke all on function public.spine_validate_row() from public,anon,authenticated;

create or replace function public.spine_lease(p_tenant text,p_mission uuid,p_owner uuid,p_release boolean) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_tenant||':'||p_mission::text,0));
 if p_release then
  update public.spine_leases set expires_at=now() where tenant_id=p_tenant and mission_id=p_mission and owner=p_owner;
  return found;
 end if;
 insert into public.spine_leases values(p_tenant,p_mission,p_owner,now()+interval '60 seconds')
 on conflict(tenant_id,mission_id) do update set owner=excluded.owner,expires_at=excluded.expires_at
 where public.spine_leases.expires_at<=now() or public.spine_leases.owner=p_owner;
 return found;
end $$;

create or replace function public.spine_decide(p_tenant text,p_mission uuid,p_subtask uuid,p_hash text,p_decision text,p_actor text) returns void language plpgsql security invoker set search_path='' as $$
declare parent uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_tenant||':'||p_mission::text,0));
 if p_decision not in ('approved','rejected') or length(p_actor)=0 then raise exception 'INVALID_DECISION';end if;
 perform 1 from public.spine_leases where tenant_id=p_tenant and mission_id=p_mission and expires_at>now() for update;
 if found then raise exception 'MISSION_BUSY';end if;
 update public.spine_approvals set status=p_decision,decided_by=p_actor,decided_at=now()
 where tenant_id=p_tenant and mission_id=p_mission and subtask_id=p_subtask and request_hash=p_hash and status='pending' and expires_at>now() and consumed_at is null;
 if not found then raise exception 'APPROVAL_NOT_PENDING';end if;
 select (data->>'task_id')::uuid into parent from public.spine_rows where tenant_id=p_tenant and mission_id=p_mission and kind='subtasks' and id=p_subtask and data->>'status'='waiting_input' for update;
 if not found then raise exception 'SUBTASK_NOT_WAITING';end if;
 update public.spine_rows set data=data||jsonb_build_object('status',case when p_decision='approved' then 'queued' else 'failed' end) where tenant_id=p_tenant and mission_id=p_mission and kind='subtasks' and id=p_subtask;
 update public.spine_rows set data=data||jsonb_build_object('status',case when p_decision='approved' then 'queued' else 'failed' end) where tenant_id=p_tenant and mission_id=p_mission and kind='tasks' and id=parent;
 update public.spine_rows set data=data||jsonb_build_object('status',case when p_decision='approved' then 'queued' else 'failed' end) where tenant_id=p_tenant and kind='missions' and id=p_mission;
 insert into public.spine_events(tenant_id,mission_id,operation) values(p_tenant,p_mission,jsonb_build_object('op','approval_decision','subtask',p_subtask,'hash',p_hash,'decision',p_decision,'actor',p_actor));
end $$;

create or replace function public.spine_reconcile(p_tenant text,p_mission uuid,p_subtask uuid,p_hash text,p_result jsonb,p_actor text) returns void language plpgsql security invoker set search_path='' as $$
declare parent uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_tenant||':'||p_mission::text,0));
 perform 1 from public.spine_leases where tenant_id=p_tenant and mission_id=p_mission and expires_at>now() for update;
 if found then raise exception 'MISSION_BUSY';end if;
 update public.spine_tool_runs set status='succeeded',result=p_result,finished_at=now() where tenant_id=p_tenant and mission_id=p_mission and subtask_id=p_subtask and request_hash=p_hash and status in ('running','uncertain');
 if not found then raise exception 'NO_UNCERTAIN_RUN';end if;
 select (data->>'task_id')::uuid into parent from public.spine_rows where tenant_id=p_tenant and mission_id=p_mission and kind='subtasks' and id=p_subtask and data->>'status'='waiting_input' for update;
 if not found then raise exception 'SUBTASK_NOT_WAITING';end if;
 update public.spine_rows set data=data||'{"status":"queued"}' where tenant_id=p_tenant and mission_id=p_mission and ((kind='missions' and id=p_mission) or (kind='tasks' and id=parent) or (kind='subtasks' and id=p_subtask));
 insert into public.spine_events(tenant_id,mission_id,operation) values(p_tenant,p_mission,jsonb_build_object('op','tool_reconciled','subtask',p_subtask,'hash',p_hash,'actor',p_actor,'evidence',p_result->'evidence'));
end $$;
create table public.spine_agent_results(tenant_id text not null,mission_id uuid not null,subtask_id uuid not null,request_hash text not null,result jsonb not null,created_at timestamptz not null default now(),primary key(tenant_id,subtask_id));
alter table public.spine_agent_results enable row level security;
revoke all on public.spine_agent_results from public,anon,authenticated,service_role;
grant select,insert on public.spine_agent_results to service_role;
create function public.spine_agent_complete(p_tenant text,p_mission uuid,p_subtask uuid,p_owner uuid,p_hash text,p_result jsonb) returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.spine_leases where tenant_id=p_tenant and mission_id=p_mission and owner=p_owner and expires_at>now() for update;
 if not found then raise exception 'LEASE_LOST';end if;
 if not exists(select 1 from public.spine_rows where tenant_id=p_tenant and mission_id=p_mission and kind='subtasks' and id=p_subtask and data->'tool_request'='null'::jsonb) then raise exception 'INVALID_SUBTASK';end if;
 insert into public.spine_agent_results values(p_tenant,p_mission,p_subtask,p_hash,p_result,now()) on conflict do nothing;
 insert into public.spine_events(tenant_id,mission_id,operation) values(p_tenant,p_mission,jsonb_build_object('op','agent_completed','subtask',p_subtask));
end $$;
revoke all on function public.spine_agent_complete(text,uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.spine_agent_complete(text,uuid,uuid,uuid,text,jsonb) to service_role;

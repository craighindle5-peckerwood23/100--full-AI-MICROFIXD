create table public.spine_agents(tenant_id text not null,agent_id uuid not null,role text not null,trust_score double precision not null check(trust_score between 0 and 1),capabilities text[] not null default '{}',primary key(tenant_id,agent_id));
create table public.spine_approvals(tenant_id text not null,mission_id uuid not null,subtask_id uuid not null,request_hash text not null,request jsonb not null,status text not null default 'pending' check(status in ('pending','approved','rejected')),expires_at timestamptz not null default now()+interval '1 hour',decided_by text,decided_at timestamptz,consumed_at timestamptz,primary key(tenant_id,subtask_id,request_hash));
create table public.spine_tool_runs(tenant_id text not null,mission_id uuid not null,subtask_id uuid not null,request_hash text not null,request jsonb not null,status text not null check(status in ('running','succeeded','uncertain')),result jsonb,started_at timestamptz not null default now(),finished_at timestamptz,primary key(tenant_id,subtask_id));
alter table public.spine_agents enable row level security;
alter table public.spine_approvals enable row level security;
alter table public.spine_tool_runs enable row level security;
revoke all on public.spine_agents,public.spine_approvals,public.spine_tool_runs from anon,authenticated,service_role;
grant select,insert on public.spine_agents to service_role;
grant select,insert,update on public.spine_approvals,public.spine_tool_runs to service_role;
create function public.spine_decide(p_tenant text,p_mission uuid,p_subtask uuid,p_hash text,p_decision text,p_actor text) returns void language plpgsql security invoker set search_path='' as $$
declare parent uuid;
begin
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
create function public.spine_start_tool(p_tenant text,p_mission uuid,p_subtask uuid,p_owner uuid,p_hash text,p_request jsonb,p_protected boolean) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.spine_leases where tenant_id=p_tenant and mission_id=p_mission and owner=p_owner and expires_at>now() for update;
 if not found then raise exception 'LEASE_LOST';end if;
 if p_protected then
  update public.spine_approvals set consumed_at=now() where tenant_id=p_tenant and mission_id=p_mission and subtask_id=p_subtask and request_hash=p_hash and request=p_request and status='approved' and expires_at>now() and consumed_at is null;
  if not found then return false;end if;
 end if;
 insert into public.spine_tool_runs(tenant_id,mission_id,subtask_id,request_hash,request,status) values(p_tenant,p_mission,p_subtask,p_hash,p_request,'running') on conflict do nothing;
 if not found then raise exception 'TOOL_ALREADY_STARTED';end if;
 insert into public.spine_events(tenant_id,mission_id,operation) values(p_tenant,p_mission,jsonb_build_object('op','tool_started','subtask',p_subtask,'request_hash',p_hash));
 return true;
end $$;
create function public.spine_finish_tool(p_tenant text,p_mission uuid,p_subtask uuid,p_owner uuid,p_hash text,p_result jsonb) returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.spine_leases where tenant_id=p_tenant and mission_id=p_mission and owner=p_owner and expires_at>now() for update;
 if not found then raise exception 'LEASE_LOST';end if;
 update public.spine_tool_runs set status='succeeded',result=p_result,finished_at=now() where tenant_id=p_tenant and mission_id=p_mission and subtask_id=p_subtask and request_hash=p_hash and status='running';
 if not found then raise exception 'TOOL_RUN_NOT_RUNNING';end if;
 insert into public.spine_events(tenant_id,mission_id,operation) values(p_tenant,p_mission,jsonb_build_object('op','tool_succeeded','subtask',p_subtask,'request_hash',p_hash));
end $$;
revoke all on function public.spine_decide(text,uuid,uuid,text,text,text),public.spine_start_tool(text,uuid,uuid,uuid,text,jsonb,boolean),public.spine_finish_tool(text,uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.spine_decide(text,uuid,uuid,text,text,text),public.spine_start_tool(text,uuid,uuid,uuid,text,jsonb,boolean),public.spine_finish_tool(text,uuid,uuid,uuid,text,jsonb) to service_role;
create function public.spine_reconcile(p_tenant text,p_mission uuid,p_subtask uuid,p_hash text,p_result jsonb,p_actor text) returns void language plpgsql security invoker set search_path='' as $$
declare parent uuid;
begin
 perform 1 from public.spine_leases where tenant_id=p_tenant and mission_id=p_mission and expires_at>now() for update;
 if found then raise exception 'MISSION_BUSY';end if;
 update public.spine_tool_runs set status='succeeded',result=p_result,finished_at=now() where tenant_id=p_tenant and mission_id=p_mission and subtask_id=p_subtask and request_hash=p_hash and status in ('running','uncertain');
 if not found then raise exception 'NO_UNCERTAIN_RUN';end if;
 select (data->>'task_id')::uuid into parent from public.spine_rows where tenant_id=p_tenant and mission_id=p_mission and kind='subtasks' and id=p_subtask and data->>'status'='waiting_input' for update;
 if not found then raise exception 'SUBTASK_NOT_WAITING';end if;
 update public.spine_rows set data=data||'{"status":"queued"}' where tenant_id=p_tenant and mission_id=p_mission and ((kind='missions' and id=p_mission) or (kind='tasks' and id=parent) or (kind='subtasks' and id=p_subtask));
 insert into public.spine_events(tenant_id,mission_id,operation) values(p_tenant,p_mission,jsonb_build_object('op','tool_reconciled','subtask',p_subtask,'hash',p_hash,'actor',p_actor,'evidence',p_result->'evidence'));
end $$;
revoke all on function public.spine_reconcile(text,uuid,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.spine_reconcile(text,uuid,uuid,text,jsonb,text) to service_role;
create table public.spine_budgets(tenant_id text not null,mission_id uuid not null,reserved_tokens bigint not null default 0,primary key(tenant_id,mission_id));
alter table public.spine_budgets enable row level security;
revoke all on public.spine_budgets from anon,authenticated,service_role;
grant select,insert,update on public.spine_budgets to service_role;
create function public.spine_reserve_tokens(p_tenant text,p_mission uuid,p_owner uuid,p_tokens integer) returns boolean language plpgsql security invoker set search_path='' as $$
declare maximum integer;
begin
 if p_tokens<1 then raise exception 'INVALID_RESERVATION';end if;
 perform 1 from public.spine_leases where tenant_id=p_tenant and mission_id=p_mission and owner=p_owner and expires_at>now() for update;
 if not found then raise exception 'LEASE_LOST';end if;
 select least(100000,greatest(1,coalesce((data->'constraints'->>'max_tokens')::integer,32000))) into maximum from public.spine_rows where tenant_id=p_tenant and kind='missions' and id=p_mission;
 insert into public.spine_budgets(tenant_id,mission_id) values(p_tenant,p_mission) on conflict do nothing;
 update public.spine_budgets set reserved_tokens=reserved_tokens+p_tokens where tenant_id=p_tenant and mission_id=p_mission and reserved_tokens+p_tokens<=maximum;
 if not found then return false;end if;
 insert into public.spine_events(tenant_id,mission_id,operation) values(p_tenant,p_mission,jsonb_build_object('op','token_reservation','tokens',p_tokens));
 return true;
end $$;
revoke all on function public.spine_reserve_tokens(text,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.spine_reserve_tokens(text,uuid,uuid,integer) to service_role;

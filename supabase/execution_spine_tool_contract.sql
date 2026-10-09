create or replace function public.spine_start_tool(p_tenant text,p_mission uuid,p_subtask uuid,p_owner uuid,p_hash text,p_request jsonb,p_protected boolean) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.spine_rows st join public.spine_rows task on task.tenant_id=st.tenant_id and task.mission_id=st.mission_id and task.kind='tasks' and task.id=(st.data->>'task_id')::uuid join public.spine_rows mission on mission.tenant_id=st.tenant_id and mission.kind='missions' and mission.id=st.mission_id where st.tenant_id=p_tenant and st.mission_id=p_mission and st.kind='subtasks' and st.id=p_subtask and st.data->'tool_request'=p_request and task.data->'tool_permissions' ? (p_request->>'name') and mission.data->'constraints'->'tool_permissions' ? (p_request->>'name')) then raise exception 'TOOL_CONTRACT_MISMATCH';end if;
 perform 1 from public.spine_leases where tenant_id=p_tenant and mission_id=p_mission and owner=p_owner and expires_at>now() for update;
 if not found then raise exception 'LEASE_LOST';end if;
 if p_request->>'name' not in ('read_public_page','get_github_repo','scan_for_security_issues') then
  update public.spine_approvals set consumed_at=now() where tenant_id=p_tenant and mission_id=p_mission and subtask_id=p_subtask and request_hash=p_hash and request=p_request and status='approved' and expires_at>now() and consumed_at is null;
  if not found then return false;end if;
 end if;
 insert into public.spine_tool_runs(tenant_id,mission_id,subtask_id,request_hash,request,status) values(p_tenant,p_mission,p_subtask,p_hash,p_request,'running') on conflict do nothing;
 if not found then raise exception 'TOOL_ALREADY_STARTED';end if;
 insert into public.spine_events(tenant_id,mission_id,operation) values(p_tenant,p_mission,jsonb_build_object('op','tool_started','subtask',p_subtask,'request_hash',p_hash));
 return true;
end $$;

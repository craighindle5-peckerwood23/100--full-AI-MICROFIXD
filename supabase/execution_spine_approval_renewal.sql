create function public.spine_renew_approval(p_tenant text,p_mission uuid,p_subtask uuid,p_hash text,p_actor text) returns void language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_tenant||':'||p_mission::text,0));
 perform 1 from public.spine_leases where tenant_id=p_tenant and mission_id=p_mission and expires_at>now() for update;
 if found then raise exception 'MISSION_BUSY';end if;
 if p_actor is null or length(p_actor)=0 then raise exception 'INVALID_ACTOR';end if;
 update public.spine_approvals set expires_at=now()+interval '1 hour' where tenant_id=p_tenant and mission_id=p_mission and subtask_id=p_subtask and request_hash=p_hash and status='pending' and consumed_at is null and expires_at<=now();
 if not found then raise exception 'APPROVAL_NOT_EXPIRED';end if;
 insert into public.spine_events(tenant_id,mission_id,operation) values(p_tenant,p_mission,jsonb_build_object('op','approval_renewed','subtask',p_subtask,'hash',p_hash,'actor',p_actor));
end $$;
revoke all on function public.spine_renew_approval(text,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.spine_renew_approval(text,uuid,uuid,text,text) to service_role;

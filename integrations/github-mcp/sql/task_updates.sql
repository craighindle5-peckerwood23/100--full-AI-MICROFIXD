alter table public.agent_tasks add column version integer not null default 1;
alter table public.agent_tasks add column updated_at timestamptz not null default now();
create function public.mcp_update_task(p_tenant text,p_repository text,p_id uuid,p_agent text,p_status text,p_version integer)
returns public.agent_tasks language plpgsql security invoker set search_path=public as $$
declare result public.agent_tasks;
begin
 update public.agent_tasks set status=p_status,agent_id=p_agent,version=version+1,updated_at=now()
 where tenant=p_tenant and repository=p_repository and id=p_id and version=p_version returning * into result;
 if result.id is null then raise exception 'Task version conflict or task not found'; end if;
 return result;
end; $$;
revoke all on function public.mcp_update_task(text,text,uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.mcp_update_task(text,text,uuid,text,text,integer) to service_role;

-- Server-only shared project state. MCP authentication fixes tenant/repository scope.
create extension if not exists vector with schema extensions;
create table public.agent_memory (
 id uuid primary key default gen_random_uuid(), tenant text not null, repository text not null,
 session_id text not null, agent_id text not null, kind text not null check (kind in ('context','decision','plan','note')),
 content text not null, created_at timestamptz not null default now()
);
create table public.agent_tasks (
 id uuid primary key default gen_random_uuid(), tenant text not null, repository text not null,
 session_id text not null, agent_id text not null, title text not null,
 status text not null check(status in ('pending','running','completed','blocked')), created_at timestamptz not null default now()
);
create table public.session_state (
 tenant text not null, repository text not null, session_id text not null, agent_id text not null,
 state jsonb not null, version integer not null default 1, updated_at timestamptz not null default now(),
 primary key(tenant,repository,session_id)
);
create table public.architecture_memory (
 tenant text not null, repository text not null, commit_sha text not null, graph jsonb not null,
 created_at timestamptz not null default now(), primary key(tenant,repository,commit_sha)
);
create table public.repository_code_chunks (
 tenant text not null, repository text not null, commit_sha text not null, path text not null,
 chunk_index integer not null, content text not null, embedding extensions.vector(1536) not null,
 primary key(tenant,repository,commit_sha,path,chunk_index)
);
alter table public.agent_memory enable row level security;
alter table public.agent_tasks enable row level security;
alter table public.session_state enable row level security;
alter table public.architecture_memory enable row level security;
alter table public.repository_code_chunks enable row level security;
revoke all on public.agent_memory, public.agent_tasks, public.session_state, public.architecture_memory, public.repository_code_chunks from anon, authenticated;
grant all on public.agent_memory, public.agent_tasks, public.session_state, public.architecture_memory, public.repository_code_chunks to service_role;
create index agent_memory_scope on public.agent_memory(tenant,repository,session_id);
create index agent_tasks_scope on public.agent_tasks(tenant,repository,session_id);
create index code_scope on public.repository_code_chunks(tenant,repository,commit_sha);
create function public.mcp_update_session(p_tenant text,p_repository text,p_session text,p_agent text,p_state jsonb,p_version integer)
returns public.session_state language plpgsql security invoker set search_path=public as $$
declare result public.session_state;
begin
 if p_version=0 then
  insert into public.session_state(tenant,repository,session_id,agent_id,state) values(p_tenant,p_repository,p_session,p_agent,p_state)
  on conflict do nothing returning * into result;
 else
  update public.session_state set state=p_state,agent_id=p_agent,version=version+1,updated_at=now()
  where tenant=p_tenant and repository=p_repository and session_id=p_session and version=p_version returning * into result;
 end if;
 if result.session_id is null then raise exception 'Session version conflict'; end if;
 return result;
end; $$;
create function public.mcp_search_code(p_tenant text,p_repository text,p_commit text,p_embedding extensions.vector(1536),p_limit integer default 10)
returns table(path text,chunk_index integer,content text,similarity double precision)
language sql stable security invoker set search_path=public,extensions as $$
 select c.path,c.chunk_index,c.content,1-(c.embedding <=> p_embedding) as similarity
 from public.repository_code_chunks c where c.tenant=p_tenant and c.repository=p_repository and c.commit_sha=p_commit
 order by c.embedding <=> p_embedding limit least(greatest(p_limit,1),30);
$$;
revoke all on function public.mcp_update_session(text,text,text,text,jsonb,integer) from public,anon,authenticated;
revoke all on function public.mcp_search_code(text,text,text,extensions.vector,integer) from public,anon,authenticated;
grant execute on function public.mcp_update_session(text,text,text,text,jsonb,integer) to service_role;
grant execute on function public.mcp_search_code(text,text,text,extensions.vector,integer) to service_role;

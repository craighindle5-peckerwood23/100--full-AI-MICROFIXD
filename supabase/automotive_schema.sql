-- Additive, server-only storage. RBAC resolves tenant; every repository operation scopes it.
create table if not exists public.automotive_records (
  tenant_id text not null,
  kind text not null check (kind in ('vehicle','case','knowledge')),
  id uuid not null,
  revision integer not null default 0 check (revision >= 0),
  data jsonb not null check (jsonb_typeof(data)='object'),
  embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  primary key (tenant_id,kind,id),
  check (data->>'id'=id::text),
  check (kind<>'case' or (data->>'revision')::integer=revision)
);
alter table public.automotive_records enable row level security;
revoke all on public.automotive_records from public,anon,authenticated;
grant select,insert,update on public.automotive_records to service_role;
create index if not exists automotive_fitment on public.automotive_records
  (tenant_id,lower(data->>'make'),lower(data->>'model')) where kind='knowledge';
create or replace function public.automotive_rank_knowledge(
 p_tenant text,p_make text,p_model text,p_engine text,p_year integer,p_query extensions.vector(1536)
) returns table(data jsonb) language sql stable security invoker
set search_path=public,extensions
as $$
 select r.data from public.automotive_records r
 where r.tenant_id=p_tenant and r.kind='knowledge'
 and lower(r.data->>'make')=lower(p_make) and lower(r.data->>'model')=lower(p_model)
 and lower(r.data->>'engine')=lower(p_engine)
 and (r.data->>'yearFrom')::integer<=p_year and (r.data->>'yearTo')::integer>=p_year
 order by r.embedding <=> p_query nulls last,r.id limit 500;
$$;
revoke all on function public.automotive_rank_knowledge(text,text,text,text,integer,extensions.vector) from public,anon,authenticated;
grant execute on function public.automotive_rank_knowledge(text,text,text,text,integer,extensions.vector) to service_role;

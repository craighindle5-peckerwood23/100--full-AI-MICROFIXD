create table public.spine_rows (
 tenant_id text not null, mission_id uuid not null, kind text not null check(kind in ('missions','tasks','subtasks','artifacts','messages')),
 id uuid not null, data jsonb not null, sequence bigint generated always as identity,
 primary key(tenant_id,kind,id), check(data->>'tenant_id'=tenant_id)
);
create index spine_rows_mission on public.spine_rows(tenant_id,mission_id,kind,sequence);
create table public.spine_leases(tenant_id text not null,mission_id uuid not null,owner uuid not null,expires_at timestamptz not null,primary key(tenant_id,mission_id));
create table public.spine_events(id bigint generated always as identity primary key,tenant_id text not null,mission_id uuid not null,operation jsonb not null,created_at timestamptz not null default now());
create table public.spine_errors(id bigint generated always as identity primary key,tenant_id text not null,mission_id uuid not null,subtask_id uuid not null,attempt integer not null,code text not null,created_at timestamptz not null default now());
alter table public.spine_rows enable row level security;
alter table public.spine_leases enable row level security;
alter table public.spine_events enable row level security;
alter table public.spine_errors enable row level security;
revoke all on public.spine_rows,public.spine_leases,public.spine_events,public.spine_errors from anon,authenticated,service_role;
grant select,insert,update on public.spine_rows,public.spine_leases to service_role;
grant select,insert on public.spine_events,public.spine_errors to service_role;
grant usage,select on sequence public.spine_rows_sequence_seq,public.spine_events_id_seq,public.spine_errors_id_seq to service_role;
create function public.spine_lease(p_tenant text,p_mission uuid,p_owner uuid,p_release boolean) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 if p_release then
  update public.spine_leases set expires_at=now() where tenant_id=p_tenant and mission_id=p_mission and owner=p_owner;
  return found;
 end if;
 insert into public.spine_leases values(p_tenant,p_mission,p_owner,now()+interval '60 seconds')
 on conflict(tenant_id,mission_id) do update set owner=excluded.owner,expires_at=excluded.expires_at
 where public.spine_leases.expires_at<now() or public.spine_leases.owner=p_owner;
 return found;
end $$;
create function public.spine_commit(p_tenant text,p_mission uuid,p_owner uuid,p_operations jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare op jsonb; body jsonb; parent uuid;
begin
 perform 1 from public.spine_leases where tenant_id=p_tenant and mission_id=p_mission and owner=p_owner and expires_at>now() for update;
 if not found then raise exception 'LEASE_LOST';end if;
 for op in select value from jsonb_array_elements(p_operations) loop
  if op->>'op'='insert' then
   body=op->'data';
   if body->>'tenant_id' is distinct from p_tenant then raise exception 'TENANT_MISMATCH';end if;
   if op->>'kind'='missions' then
    if (body->>'mission_id')::uuid<>p_mission then raise exception 'MISSION_MISMATCH';end if;
   elsif op->>'kind'='subtasks' then
    perform 1 from public.spine_rows where tenant_id=p_tenant and mission_id=p_mission and kind='tasks' and id=(body->>'task_id')::uuid;
    if not found then raise exception 'INVALID_PARENT';end if;
   else
    if (body->>'mission_id')::uuid is distinct from p_mission then raise exception 'MISSION_MISMATCH';end if;
    perform 1 from public.spine_rows where tenant_id=p_tenant and kind='missions' and id=p_mission;
    if not found then raise exception 'INVALID_PARENT';end if;
   end if;
   insert into public.spine_rows(tenant_id,mission_id,kind,id,data) values(p_tenant,p_mission,op->>'kind',(op->>'id')::uuid,body) on conflict do nothing;
  elsif op->>'op'='patch' then
   if (op->'data') ?| array['tenant_id','mission_id','task_id','subtask_id'] then raise exception 'IMMUTABLE_IDENTITY';end if;
   update public.spine_rows set data=data||(op->'data') where tenant_id=p_tenant and mission_id=p_mission and kind=op->>'kind' and id=(op->>'id')::uuid;
   if not found then raise exception 'ROW_NOT_FOUND';end if;
  elsif op->>'op'='increment' and op->>'field'='attempts' then
   update public.spine_rows set data=jsonb_set(data,'{attempts}',to_jsonb(coalesce((data->>'attempts')::integer,0)+1)) where tenant_id=p_tenant and mission_id=p_mission and kind=op->>'kind' and id=(op->>'id')::uuid;
   if not found then raise exception 'ROW_NOT_FOUND';end if;
  else raise exception 'INVALID_OPERATION';end if;
  insert into public.spine_events(tenant_id,mission_id,operation) values(p_tenant,p_mission,op);
 end loop;
end $$;
revoke all on function public.spine_lease(text,uuid,uuid,boolean),public.spine_commit(text,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.spine_lease(text,uuid,uuid,boolean),public.spine_commit(text,uuid,uuid,jsonb) to service_role;

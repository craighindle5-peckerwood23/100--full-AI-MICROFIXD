-- Mandatory supervision: append-only telemetry and durable tenant stop controls.
create table public.metacognitive_events (
 sequence bigint generated always as identity primary key,
 event_id uuid not null unique,
 schema_version integer not null check (schema_version=1),
 policy_version text not null,
 trace_id uuid not null,
 tenant_id text not null check (length(tenant_id)>0),
 mission_id text, subtask_id text,
 agent_id text not null, action text not null,
 phase text not null check (phase in ('before','candidate','failed','recovered')),
 timestamp timestamptz not null,
 duration_ms double precision not null check (duration_ms>=0),
 input_hash text not null check (input_hash ~ '^[a-f0-9]{64}$'),
 output_hash text check (output_hash ~ '^[a-f0-9]{64}$'),
 confidence jsonb not null check (jsonb_typeof(confidence)='object'),
 assessment jsonb not null check (assessment->>'verdict' in ('allow','quarantine','escalate','halt')),
 alternatives jsonb not null check (jsonb_typeof(alternatives)='array' and jsonb_array_length(alternatives) between 1 and 8),
 selected_alternative text not null,
 exhaustive boolean not null default false check (exhaustive=false),
 error_code text,
 metrics jsonb not null default '{}'::jsonb check (jsonb_typeof(metrics)='object')
);
create index metacognitive_tenant_sequence on public.metacognitive_events(tenant_id,sequence);
create index metacognitive_mission_sequence on public.metacognitive_events(tenant_id,mission_id,sequence);
create table public.metacognitive_controls (
 tenant_id text primary key check (length(tenant_id)>0),
 halted boolean not null default false,
 updated_at timestamptz not null default now(),
 updated_by text not null
);
create table public.metacognitive_control_audit (
 sequence bigint generated always as identity primary key,
 tenant_id text not null, halted boolean not null, actor text not null, timestamp timestamptz not null default now()
);
alter table public.metacognitive_events enable row level security;
alter table public.metacognitive_controls enable row level security;
alter table public.metacognitive_control_audit enable row level security;
revoke all on public.metacognitive_events,public.metacognitive_controls,public.metacognitive_control_audit from public,anon,authenticated,service_role;
grant select,insert on public.metacognitive_events,public.metacognitive_control_audit to service_role;
grant select,insert,update on public.metacognitive_controls to service_role;
grant usage,select on sequence public.metacognitive_events_sequence_seq,public.metacognitive_control_audit_sequence_seq to service_role;
create function public.metacognitive_set_control(p_tenant text,p_halted boolean,p_actor text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_tenant is null or length(p_tenant)=0 or p_actor is null or length(p_actor)=0 or p_halted is null then raise exception 'INVALID_CONTROL'; end if;
 insert into public.metacognitive_controls(tenant_id,halted,updated_by) values(p_tenant,p_halted,p_actor)
 on conflict(tenant_id) do update set halted=excluded.halted,updated_at=now(),updated_by=excluded.updated_by;
 insert into public.metacognitive_control_audit(tenant_id,halted,actor) values(p_tenant,p_halted,p_actor);
end $$;
revoke all on function public.metacognitive_set_control(text,boolean,text) from public,anon,authenticated;
grant execute on function public.metacognitive_set_control(text,boolean,text) to service_role;

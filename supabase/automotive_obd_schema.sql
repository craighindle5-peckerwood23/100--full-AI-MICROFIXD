create table if not exists public.automotive_obd_sessions (
 tenant_id text not null,id uuid not null,sequence integer not null default 0 check(sequence>=0),
 data jsonb not null,created_at timestamptz not null default now(),primary key(tenant_id,id),
 check(data->>'id'=id::text),check((data->>'sequence')::integer=sequence)
);
alter table public.automotive_obd_sessions enable row level security;
revoke all on public.automotive_obd_sessions from public,anon,authenticated;
grant select,insert,update on public.automotive_obd_sessions to service_role;

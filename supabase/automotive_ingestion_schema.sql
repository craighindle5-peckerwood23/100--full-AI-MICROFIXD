-- NHTSA source registry and durable acquisition queue (service-role only).
create extension if not exists pgcrypto;
create table if not exists automotive_sources (
 id text primary key, base_url text not null, source_type text not null,
 license_note text not null, enabled boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists automotive_ingestion_jobs (
 id uuid primary key default gen_random_uuid(),
 source_id text not null references automotive_sources(id),
 source_key text not null, request_url text not null,
 state text not null default 'queued' check(state in ('queued','running','completed','failed')),
 attempts integer not null default 0 check(attempts >= 0),
 next_attempt_at timestamptz not null default now(),
 leased_until timestamptz, last_error text, completed_at timestamptz,
 created_at timestamptz not null default now(),
 unique(source_id,source_key)
);
create table if not exists automotive_source_records (
 id uuid primary key default gen_random_uuid(),
 source_id text not null references automotive_sources(id),
 source_key text not null, payload jsonb not null,
 content_sha256 text not null check(content_sha256 ~ '^[0-9a-f]{64}$'),
 source_url text not null, fetched_at timestamptz not null default now(),
 unique(source_id,source_key)
);
create index if not exists automotive_jobs_pending on automotive_ingestion_jobs(state,next_attempt_at);
alter table automotive_sources enable row level security;
alter table automotive_ingestion_jobs enable row level security;
alter table automotive_source_records enable row level security;
revoke all on automotive_sources,automotive_ingestion_jobs,automotive_source_records from anon,authenticated;
insert into automotive_sources(id,base_url,source_type,license_note) values
('nhtsa-recalls','https://api.nhtsa.gov/recalls/recallsByVehicle','official-api','NHTSA open data; attribute source'),
('nhtsa-complaints','https://api.nhtsa.gov/complaints/complaintsByVehicle','official-api','NHTSA complaint reports; unverified consumer reports'),
('nhtsa-vpic','https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues','official-api','NHTSA open data; rate limits apply')
on conflict(id) do nothing;

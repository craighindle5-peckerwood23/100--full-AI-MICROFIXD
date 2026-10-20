-- Additive VECTOR extension. Requires canonical supabase/vector_knowledge_foundation.sql (PR #30).
-- The original schema duplicated vehicle and DTC catalogs; this revision uses canonical references.
create extension if not exists pgcrypto;
create table if not exists public.vector_sensor_specs (
 id uuid primary key default gen_random_uuid(),
 application_id uuid references public.vector_vehicle_applications(id),
 family_code text references public.vector_module_families(code),
 parameter text not null, unit text not null,
 lower_bound numeric, upper_bound numeric,
 operating_condition jsonb not null default '{}'::jsonb,
 source_id uuid references public.vector_reference_sources(id),
 check(lower_bound is null or upper_bound is null or lower_bound <= upper_bound)
);
create table if not exists public.vector_diagnostic_test_specs (
 id uuid primary key default gen_random_uuid(),
 hypothesis_id uuid not null references public.vector_failure_hypotheses(id),
 title text not null, method text not null,
 expected_result jsonb not null default '{}'::jsonb,
 source_id uuid references public.vector_reference_sources(id)
);
create index if not exists vector_sensor_application_idx on public.vector_sensor_specs(application_id,parameter);
create index if not exists vector_diagnostic_hypothesis_idx on public.vector_diagnostic_test_specs(hypothesis_id);
alter table public.vector_sensor_specs enable row level security;
alter table public.vector_diagnostic_test_specs enable row level security;
revoke all on public.vector_sensor_specs,public.vector_diagnostic_test_specs from anon,authenticated;

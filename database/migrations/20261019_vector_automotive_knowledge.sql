-- VECTOR automotive knowledge catalog. Additive migration; no vehicle write operations.
create extension if not exists pgcrypto;
create table if not exists vector_vehicle_variants (
 id uuid primary key default gen_random_uuid(), make text not null, model text not null,
 model_year integer not null check(model_year between 1886 and 2200),
 trim text, engine_code text, transmission_code text, market text,
 unique(make,model,model_year,trim,engine_code,transmission_code,market)
);
create table if not exists vector_module_types (
 id text primary key, description text not null
);
insert into vector_module_types(id,description) values
 ('ECM','Engine control'),('TCM','Transmission control'),('BCM','Body control'),
 ('ABS','Antilock braking'),('ESC','Stability and traction control'),
 ('ADAS','Driver assistance'),('SRS','Restraints'),('EPS','Electric steering'),
 ('HVAC','Climate'),('INFOTAINMENT','Audio and infotainment'),('GATEWAY','Network gateway')
on conflict do nothing;
create table if not exists vector_variant_modules (
 id uuid primary key default gen_random_uuid(), variant_id uuid not null references vector_vehicle_variants(id),
 module_type text not null references vector_module_types(id), supplier text, hardware_id text,
 software_id text, network text, capabilities jsonb not null default '{}'::jsonb
);
create table if not exists vector_dtc_definitions (
 id uuid primary key default gen_random_uuid(), code text not null, namespace text not null,
 module_type text references vector_module_types(id), description text not null,
 source_id uuid, unique(code,namespace,module_type)
);
create table if not exists vector_knowledge_sources (
 id uuid primary key default gen_random_uuid(), title text not null, source_url text,
 publisher text, source_kind text not null, license_status text not null default 'unreviewed',
 published_at timestamptz, retrieved_at timestamptz not null default now(),
 content_sha256 text, check(content_sha256 is null or content_sha256 ~ '^[a-f0-9]{64}$')
);
alter table vector_dtc_definitions add constraint vector_dtc_source_fk
 foreign key(source_id) references vector_knowledge_sources(id);
create table if not exists vector_failure_modes (
 id uuid primary key default gen_random_uuid(), variant_id uuid references vector_vehicle_variants(id),
 module_type text references vector_module_types(id), label text not null,
 description text, source_id uuid references vector_knowledge_sources(id)
);
create table if not exists vector_dtc_failure_links (
 dtc_id uuid not null references vector_dtc_definitions(id),
 failure_id uuid not null references vector_failure_modes(id),
 evidence_grade text not null check(evidence_grade in ('anecdotal','observational','validated')),
 source_id uuid references vector_knowledge_sources(id),
 primary key(dtc_id,failure_id)
);
create table if not exists vector_sensor_specs (
 id uuid primary key default gen_random_uuid(), variant_id uuid references vector_vehicle_variants(id),
 module_type text references vector_module_types(id), parameter text not null, unit text not null,
 lower_bound numeric, upper_bound numeric, operating_condition jsonb not null default '{}'::jsonb,
 source_id uuid references vector_knowledge_sources(id),
 check(lower_bound is null or upper_bound is null or lower_bound <= upper_bound)
);
create table if not exists vector_diagnostic_tests (
 id uuid primary key default gen_random_uuid(), failure_id uuid not null references vector_failure_modes(id),
 title text not null, method text not null, expected_result jsonb not null default '{}'::jsonb,
 source_id uuid references vector_knowledge_sources(id)
);
create table if not exists vector_repair_cases (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
 variant_id uuid references vector_vehicle_variants(id), created_at timestamptz not null default now(),
 symptoms jsonb not null default '{}'::jsonb, verified_fix boolean not null default false,
 failure_id uuid references vector_failure_modes(id), validation_method text,
 evidence_quality text not null default 'unverified',
 check(not verified_fix or (failure_id is not null and validation_method is not null))
);
create table if not exists vector_case_dtcs (
 case_id uuid not null references vector_repair_cases(id) on delete cascade,
 dtc_id uuid not null references vector_dtc_definitions(id), primary key(case_id,dtc_id)
);
create table if not exists vector_failure_statistics (
 id uuid primary key default gen_random_uuid(), failure_id uuid not null references vector_failure_modes(id),
 dtc_id uuid references vector_dtc_definitions(id), population_description text not null,
 sample_size integer not null check(sample_size > 0), confirmed_count integer not null,
 methodology text not null, source_id uuid references vector_knowledge_sources(id),
 observed_at timestamptz not null default now(),
 check(confirmed_count between 0 and sample_size)
);
create table if not exists vector_geometry_assets (
 id uuid primary key default gen_random_uuid(), variant_id uuid not null references vector_vehicle_variants(id),
 component text not null, representation text not null, storage_path text,
 units text, source_id uuid references vector_knowledge_sources(id),
 check(representation in ('dimensions','mesh','cad','photo','diagram'))
);
create table if not exists vector_tool_concepts (
 id uuid primary key default gen_random_uuid(), variant_id uuid references vector_vehicle_variants(id),
 component text not null, problem text not null, proposed_geometry jsonb,
 constraints jsonb not null default '{}'::jsonb, review_status text not null default 'concept',
 check(review_status in ('concept','engineering_review','prototype','validated','rejected'))
);
create index if not exists vector_dtc_code_idx on vector_dtc_definitions(code);
create index if not exists vector_variant_lookup_idx on vector_vehicle_variants(make,model,model_year);
create index if not exists vector_cases_tenant_idx on vector_repair_cases(tenant_id,created_at desc);
-- All tables default to service-only access until explicit reviewed policies exist.
do $$ declare t text; begin
 foreach t in array array['vector_vehicle_variants','vector_module_types','vector_variant_modules',
 'vector_dtc_definitions','vector_knowledge_sources','vector_failure_modes','vector_dtc_failure_links',
 'vector_sensor_specs','vector_diagnostic_tests','vector_repair_cases','vector_case_dtcs',
 'vector_failure_statistics','vector_geometry_assets','vector_tool_concepts'] loop
 execute format('alter table public.%I enable row level security',t);
 end loop; end $$;

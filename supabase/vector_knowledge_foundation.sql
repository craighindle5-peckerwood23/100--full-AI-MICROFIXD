-- VECTOR automotive knowledge foundation. Additive, service-only until reviewed policies.
create extension if not exists pgcrypto;
create table if not exists vector_makes (
 id uuid primary key default gen_random_uuid(), name text not null unique,
 normalized_name text generated always as (lower(trim(name))) stored unique
);
create table if not exists vector_models (
 id uuid primary key default gen_random_uuid(), make_id uuid not null references vector_makes(id),
 name text not null, unique(make_id,name)
);
create table if not exists vector_vehicle_applications (
 id uuid primary key default gen_random_uuid(), model_id uuid not null references vector_models(id),
 model_year integer not null check(model_year between 1886 and 2200),
 trim text not null default '', market text not null default 'US',
 body_style text not null default '', engine_code text not null default '',
 transmission_code text not null default '', drivetrain text not null default '',
 fuel_type text not null default '', production_start date, production_end date,
 created_at timestamptz not null default now(),
 unique(model_id,model_year,trim,market,body_style,engine_code,transmission_code,drivetrain,fuel_type),
 check(production_end is null or production_start is null or production_end >= production_start)
);
create table if not exists vector_reference_sources (
 id uuid primary key default gen_random_uuid(), publisher text not null, title text not null,
 url text, source_kind text not null, rights_status text not null default 'metadata_only'
 check(rights_status in ('metadata_only','licensed','public_domain','permission_granted')),
 retrieved_at timestamptz, published_at timestamptz, citation text,
 unique(publisher,title,url)
);
create table if not exists vector_reference_documents (
 id uuid primary key default gen_random_uuid(), source_id uuid not null references vector_reference_sources(id),
 external_id text not null, title text not null, application_id uuid references vector_vehicle_applications(id),
 excerpt text, storage_key text, content_sha256 text,
 extraction_state text not null default 'pending'
 check(extraction_state in ('pending','indexed','rejected')),
 unique(source_id,external_id),
 check(storage_key is null or content_sha256 ~ '^[a-f0-9]{64}$')
);
create table if not exists vector_module_families (
 code text primary key, label text not null
);
insert into vector_module_families(code,label) values
 ('ECM','Engine'),('TCM','Transmission'),('BCM','Body'),('ABS','Antilock brakes'),
 ('ESC','Stability and traction'),('ADAS','Driver assistance'),('SRS','Restraints'),
 ('EPS','Steering'),('HVAC','Climate'),('RADIO','Infotainment'),('GATEWAY','Gateway'),
 ('HV','High voltage and hybrid') on conflict do nothing;
create table if not exists vector_application_modules (
 id uuid primary key default gen_random_uuid(),
 application_id uuid not null references vector_vehicle_applications(id),
 family_code text not null references vector_module_families(code),
 supplier text, module_part_number text, network_protocol text,
 capabilities jsonb not null default '{}'::jsonb,
 unique(application_id,family_code,module_part_number)
);
create table if not exists vector_dtc_catalog (
 id uuid primary key default gen_random_uuid(), namespace text not null,
 code text not null, family_code text references vector_module_families(code),
 label text not null, definition text, source_id uuid references vector_reference_sources(id),
 unique(namespace,code,family_code)
);
create table if not exists vector_dtc_applicability (
 dtc_id uuid not null references vector_dtc_catalog(id),
 application_id uuid not null references vector_vehicle_applications(id),
 conditions jsonb not null default '{}'::jsonb,
 primary key(dtc_id,application_id)
);
create table if not exists vector_failure_hypotheses (
 id uuid primary key default gen_random_uuid(), application_id uuid references vector_vehicle_applications(id),
 family_code text references vector_module_families(code), failure_label text not null,
 explanation text, source_id uuid references vector_reference_sources(id)
);
create table if not exists vector_dtc_hypotheses (
 dtc_id uuid not null references vector_dtc_catalog(id),
 hypothesis_id uuid not null references vector_failure_hypotheses(id),
 evidence_grade text not null check(evidence_grade in ('anecdotal','observational','validated')),
 primary key(dtc_id,hypothesis_id)
);
create table if not exists vector_diagnostic_checklists (
 id uuid primary key default gen_random_uuid(), hypothesis_id uuid not null references vector_failure_hypotheses(id),
 step_order integer not null check(step_order > 0), description text not null,
 expected_evidence jsonb not null default '{}'::jsonb,
 source_id uuid references vector_reference_sources(id),
 unique(hypothesis_id,step_order)
);
create table if not exists vector_repair_evidence (
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
 application_id uuid references vector_vehicle_applications(id),
 hypothesis_id uuid references vector_failure_hypotheses(id),
 dtc_id uuid references vector_dtc_catalog(id),
 outcome text not null check(outcome in ('unverified','confirmed','rejected')),
 verification_method text, mileage integer check(mileage is null or mileage >= 0),
 symptoms jsonb not null default '{}'::jsonb,
 observed_at timestamptz not null default now(),
 check(outcome <> 'confirmed' or (hypothesis_id is not null and verification_method is not null))
);
create table if not exists vector_failure_frequency (
 id uuid primary key default gen_random_uuid(),
 application_id uuid references vector_vehicle_applications(id),
 hypothesis_id uuid not null references vector_failure_hypotheses(id),
 dtc_id uuid references vector_dtc_catalog(id),
 source_id uuid not null references vector_reference_sources(id),
 population_definition text not null, methodology text not null,
 sample_size integer not null check(sample_size > 0),
 confirmed_cases integer not null check(confirmed_cases >= 0),
 computed_at timestamptz not null default now(),
 check(confirmed_cases <= sample_size)
);
create table if not exists vector_geometry (
 id uuid primary key default gen_random_uuid(),
 application_id uuid not null references vector_vehicle_applications(id),
 component_name text not null, asset_type text not null
 check(asset_type in ('dimensions','mesh','cad','photo','diagram')),
 asset_key text, units text, coordinate_frame text,
 dimensions jsonb not null default '{}'::jsonb,
 source_id uuid references vector_reference_sources(id),
 validation_state text not null default 'unverified'
 check(validation_state in ('unverified','reviewed','measured'))
);
create table if not exists vector_tool_designs (
 id uuid primary key default gen_random_uuid(),
 geometry_id uuid references vector_geometry(id),
 problem_statement text not null, clearance_constraints jsonb not null default '{}'::jsonb,
 proposed_solution jsonb not null default '{}'::jsonb,
 review_state text not null default 'concept'
 check(review_state in ('concept','engineering_review','prototype','validated','rejected'))
);
create index if not exists vector_application_lookup on vector_vehicle_applications(model_id,model_year,trim);
create index if not exists vector_dtc_lookup on vector_dtc_catalog(code);
create index if not exists vector_repair_tenant on vector_repair_evidence(tenant_id,observed_at desc);
create index if not exists vector_documents_application on vector_reference_documents(application_id);
do $$ declare t text; begin
 foreach t in array array['vector_makes','vector_models','vector_vehicle_applications','vector_reference_sources',
 'vector_reference_documents','vector_module_families','vector_application_modules','vector_dtc_catalog',
 'vector_dtc_applicability','vector_failure_hypotheses','vector_dtc_hypotheses',
 'vector_diagnostic_checklists','vector_repair_evidence','vector_failure_frequency',
 'vector_geometry','vector_tool_designs'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 end loop;
end $$;

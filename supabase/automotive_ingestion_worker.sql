-- Apply after supabase/automotive_ingestion_schema.sql.
alter table automotive_ingestion_jobs add column if not exists lease_token uuid;
alter table automotive_ingestion_jobs add column if not exists last_started_at timestamptz;
create or replace function automotive_claim_job()
returns setof automotive_ingestion_jobs language plpgsql security invoker
set search_path = public as $$
declare selected_id uuid;
begin
 select id into selected_id from automotive_ingestion_jobs
 where (state = 'queued' and next_attempt_at <= now())
    or (state = 'running' and leased_until < now())
 order by created_at for update skip locked limit 1;
 if selected_id is null then return; end if;
 return query update automotive_ingestion_jobs
 set state = 'running', attempts = attempts + 1,
     lease_token = gen_random_uuid(), leased_until = now() + interval '90 seconds',
     last_started_at = now(), last_error = null
 where id = selected_id returning *;
end $$;
create or replace function automotive_finish_job(
 p_id uuid, p_token uuid, p_success boolean, p_error text default null)
returns boolean language plpgsql security invoker
set search_path = public as $$
declare changed integer;
begin
 update automotive_ingestion_jobs
 set state = case when p_success then 'completed'
                  when attempts >= 5 then 'failed' else 'queued' end,
     last_error = case when p_success then null else left(coalesce(p_error,'unknown error'),500) end,
     next_attempt_at = case when p_success then next_attempt_at
          else now() + make_interval(secs => least(3600, 30 * power(2,least(attempts,6))::integer)) end,
     completed_at = case when p_success then now() else null end,
     leased_until = null, lease_token = null
 where id = p_id and lease_token = p_token and state = 'running';
 get diagnostics changed = row_count;
 return changed = 1;
end $$;
revoke all on function automotive_claim_job() from public, anon, authenticated;
revoke all on function automotive_finish_job(uuid,uuid,boolean,text) from public, anon, authenticated;
grant execute on function automotive_claim_job() to service_role;
grant execute on function automotive_finish_job(uuid,uuid,boolean,text) to service_role;

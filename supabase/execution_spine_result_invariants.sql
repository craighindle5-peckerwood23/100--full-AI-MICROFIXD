create or replace function public.spine_validate_row() returns trigger language plpgsql security invoker set search_path='' as $$
declare parent public.spine_rows; expected_id text; status text; valid boolean;
begin
 expected_id=case new.kind when 'missions' then 'mission_id' when 'tasks' then 'task_id' when 'subtasks' then 'subtask_id' when 'artifacts' then 'artifact_id' else 'message_id' end;
 if jsonb_typeof(new.data)<>'object' or new.data->>'tenant_id' is distinct from new.tenant_id or (new.data->>expected_id)::uuid is distinct from new.id then raise exception 'INVALID_IDENTITY';end if;
 if tg_op='UPDATE' and (new.tenant_id,new.mission_id,new.kind,new.id) is distinct from (old.tenant_id,old.mission_id,old.kind,old.id) then raise exception 'IMMUTABLE_IDENTITY';end if;
 if tg_op='UPDATE' and new.kind in ('artifacts','messages') then raise exception 'IMMUTABLE_OUTPUT';end if;
 if new.kind='subtasks' then
  select * into parent from public.spine_rows where tenant_id=new.tenant_id and mission_id=new.mission_id and kind='tasks' and id=(new.data->>'task_id')::uuid;
  if not found then raise exception 'INVALID_PARENT';end if;
 else
  if (new.data->>'mission_id')::uuid is distinct from new.mission_id then raise exception 'MISSION_MISMATCH';end if;
  if new.kind<>'missions' and not exists(select 1 from public.spine_rows where tenant_id=new.tenant_id and kind='missions' and id=new.mission_id) then raise exception 'INVALID_PARENT';end if;
 end if;
 status=new.data->>'status';
 valid=case new.kind when 'missions' then status in ('queued','running','waiting','failed','succeeded') when 'tasks' then status in ('queued','running','blocked','failed','succeeded') when 'subtasks' then status in ('queued','running','waiting_input','failed','succeeded') else true end;
 if valid is distinct from true then raise exception 'INVALID_STATUS';end if;
 if new.kind in ('tasks','subtasks') and (jsonb_typeof(new.data->'attempts') is distinct from 'number' or (new.data->>'attempts')::integer<0) then raise exception 'INVALID_ATTEMPTS';end if;
 if tg_op='UPDATE' and old.data->>'status'='succeeded' and new.data->>'status' is distinct from 'succeeded' then raise exception 'TERMINAL_STATE';end if;
 if new.kind='artifacts' then
  if new.data->>'type' not in ('text','json','screenshot','audio','obd_data','mission_result') or new.data->>'type' is null or new.data->>'hash' is null or new.data->>'hash'!~'^[0-9a-f]{64}$' or jsonb_typeof(new.data->'evidence') is distinct from 'object' then raise exception 'INVALID_ARTIFACT';end if;
  if new.data->>'subtask_id' is not null then
   select * into parent from public.spine_rows where tenant_id=new.tenant_id and mission_id=new.mission_id and kind='subtasks' and id=(new.data->>'subtask_id')::uuid;
   if not found or parent.data->>'task_id' is distinct from new.data->>'task_id' then raise exception 'INVALID_ARTIFACT_PARENT';end if;
  end if;
 end if;
 if new.kind='messages' then
  if not exists(select 1 from public.spine_agents where tenant_id=new.tenant_id and agent_id=(new.data->>'from_agent')::uuid) or (new.data->>'to_agent' is not null and not exists(select 1 from public.spine_agents where tenant_id=new.tenant_id and agent_id=(new.data->>'to_agent')::uuid)) then raise exception 'UNKNOWN_AGENT';end if;
  if jsonb_typeof(new.data->'confidence') is distinct from 'number' or (new.data->>'confidence')::double precision not between 0 and 1 then raise exception 'INVALID_CONFIDENCE';end if;
 end if;
 if status='succeeded' then
  if new.kind='missions' and not exists(select 1 from public.spine_rows where tenant_id=new.tenant_id and mission_id=new.mission_id and kind='artifacts' and id=(new.data->>'result_artifact_id')::uuid and data->>'type'='mission_result') then raise exception 'FINAL_ARTIFACT_REQUIRED';end if;
  if new.kind='subtasks' and not exists(select 1 from public.spine_rows where tenant_id=new.tenant_id and mission_id=new.mission_id and kind='artifacts' and data->>'subtask_id'=new.id::text) then raise exception 'SUBTASK_ARTIFACT_REQUIRED';end if;
  if new.kind='tasks' and (not exists(select 1 from public.spine_rows where tenant_id=new.tenant_id and mission_id=new.mission_id and kind='subtasks' and data->>'task_id'=new.id::text) or exists(select 1 from public.spine_rows where tenant_id=new.tenant_id and mission_id=new.mission_id and kind='subtasks' and data->>'task_id'=new.id::text and data->>'status'<>'succeeded')) then raise exception 'INCOMPLETE_SUBTASKS';end if;
 end if;
 return new;
end $$;

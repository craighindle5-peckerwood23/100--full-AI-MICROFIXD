-- Append-only dispatch evidence, isolated from existing spine tables.
CREATE TABLE IF NOT EXISTS public.mission_dispatch_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id text NOT NULL CHECK (length(task_id) BETWEEN 1 AND 255),
  mission_id text NOT NULL CHECK (length(mission_id) BETWEEN 1 AND 255),
  status text NOT NULL CHECK (status IN ('SUCCESS','FAILED')),
  response_payload jsonb,
  error_message text,
  executed_at timestamptz NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mission_dispatch_logs_one_outcome UNIQUE (mission_id,task_id)
);
CREATE INDEX IF NOT EXISTS idx_mission_dispatch_logs_mission_id ON public.mission_dispatch_logs(mission_id);
CREATE INDEX IF NOT EXISTS idx_mission_dispatch_logs_task_id ON public.mission_dispatch_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_mission_dispatch_logs_executed_at ON public.mission_dispatch_logs(executed_at DESC);
ALTER TABLE public.mission_dispatch_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mission_dispatch_logs FROM PUBLIC, anon, authenticated;
-- Only the trusted server database role may write audit records.
GRANT SELECT, INSERT ON public.mission_dispatch_logs TO service_role;
CREATE OR REPLACE FUNCTION public.prevent_dispatch_log_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'mission_dispatch_logs is append-only';
END;
$$;
DROP TRIGGER IF EXISTS mission_dispatch_logs_immutable ON public.mission_dispatch_logs;
CREATE TRIGGER mission_dispatch_logs_immutable BEFORE UPDATE OR DELETE ON public.mission_dispatch_logs
FOR EACH ROW EXECUTE FUNCTION public.prevent_dispatch_log_mutation();

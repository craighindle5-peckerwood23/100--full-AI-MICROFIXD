import { executeMemoryOrgan } from '../organs/organs/memoryOrgan';

function safeMessage(error: unknown): string {
  let message = error instanceof Error ? error.message : String(error);
  for (const [name, value] of Object.entries(process.env)) {
    if (/(KEY|TOKEN|SECRET|PASSWORD)/.test(name) && value && value.length >= 8) message = message.split(value).join('[redacted]');
  }
  return message.slice(0, 1500);
}

export async function recordCommandFailure(
  error: unknown,
  context: {cmdId: string; session_id: string; stages: string[]},
  store = executeMemoryOrgan,
) {
  const detail = error as any;
  const message = safeMessage(error);
  const failure = {
    command_id: context.cmdId, stage: String(detail?.stage || context.stages.at(-1) || 'intake'),
    code: /input tokens per minute|ITPM/i.test(message) ? 'INPUT_TOKEN_LIMIT' : String(detail?.code || 'COMMAND_FAILED'),
    status: Number(detail?.status) || undefined, message, persisted: false,
    record_id: undefined as string | undefined, persistence_error: undefined as string | undefined,
  };
  try {
    const result = await store('store', {session_id:context.session_id, organ:'command_failure',
      content:JSON.stringify({...failure, stages:context.stages}), tags:['command_failure'],
      metadata:{cmdId:context.cmdId, stage:failure.stage, code:failure.code}});
    if (!result?.stored || !result?.id) throw new Error('Failure storage did not confirm a durable record');
    failure.persisted = true; failure.record_id = result.id;
  } catch (persistenceError) {
    failure.persistence_error = safeMessage(persistenceError);
  }
  console.error('[CommandFailure]', JSON.stringify(failure));
  return failure;
}

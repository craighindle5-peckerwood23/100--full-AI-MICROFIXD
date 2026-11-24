// Text-only completions have no authority to report a new external effect.
const completedAction = /\b(?:I|we|Microfixd)(?:['’](?:ve|d)|\s+(?:have|has|had))?\s+(?:(?:just|already|successfully|actually)\s+)*(?:deployed|pushed|merged|restarted|rebooted|healed|patched|flashed|sent|deleted|executed|ran)\b/i;

export function checkTextOnlyAnswer(answer: string): void {
  if (!answer.trim()) throw new Error('EMPTY_BRAIN_ANSWER');
  if (completedAction.test(answer)) {
    throw Object.assign(new Error('An execution claim was withheld. Check the action record in Mission Control.'), {
      code: 'UNSUPPORTED_EXECUTION_CLAIM',
    });
  }
}

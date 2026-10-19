export function safetyAlerts(complaint:string,hazards:string[]):string[] {
  const alerts = new Set(hazards.map(h=>`Specialist assessment required: ${h}.`));
  if (/\b(brake|brakes|steering|fuel leak|gas leak|overheat|smoke|airbag|high voltage)\b/i.test(complaint)) alerts.add('Potential safety-critical complaint: stop driving and obtain a qualified assessment before testing.');
  return [...alerts];
}

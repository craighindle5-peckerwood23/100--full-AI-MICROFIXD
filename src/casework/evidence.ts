export interface Evidence {
  id: string; date: string; from: string; to: string; subject: string; text: string;
  labels: string[]; attachments: string[]; source: 'gmail' | 'eml' | 'demo';
  raw?: Uint8Array; note?: string;
}
export const topics = ['All', 'File requests', 'Fees / lien', 'Representation', 'Settlement', 'Other'] as const;
export function topic(e: Evidence): string {
  const s = `${e.subject}\n${e.text}`.toLowerCase();
  if (/client file|case file|my file|records request|file request/.test(s)) return 'File requests';
  if (/lien|fee|accounting|retainer/.test(s)) return 'Fees / lien';
  if (/termination|discharg|rebuttal|represent|communication/.test(s)) return 'Representation';
  if (/settlement|allocation|payment|check|browngreer/.test(s)) return 'Settlement';
  return 'Other';
}
export function chronological(rows: Evidence[]) {
  return [...rows].sort((a,b) => (Date.parse(a.date)||0)-(Date.parse(b.date)||0) || a.id.localeCompare(b.id));
}
export function report(rows: Evidence[]) {
  return ['# Correspondence review — working evidence index',
    'Scope: selected messages only. Keyword topics and user notes are review aids, not findings of malpractice. Draft messages do not prove delivery. Attachments are indexed, not analyzed. No inference of an unanswered request is made from a partial mailbox.',
    ...chronological(rows).map((e,i) => `\n## EX-${String(i+1).padStart(4,'0')} — ${e.subject}\nDate: ${e.date || 'Unknown'}\nFrom: ${e.from}\nTo: ${e.to}\nSource: ${e.source}; ID: ${e.id}\nTopic: ${topic(e)}\nLabels: ${e.labels.join(', ')}\nAttachments: ${e.attachments.join(', ') || 'None indexed'}\nUser note (unverified): ${e.note || 'None'}\n\nMessage text:\n${e.text}`)
  ].join('\n\n');
}
export const demo: Evidence[] = [
  {id:'demo-1',date:'2026-01-01T10:00:00Z',from:'client@example.invalid',to:'firm@example.invalid',subject:'DEMO: Request for client file',text:'Fictional demonstration: Please provide my client file and an itemized accounting.',labels:['SENT'],attachments:[],source:'demo'},
  {id:'demo-2',date:'2026-01-04T10:00:00Z',from:'firm@example.invalid',to:'client@example.invalid',subject:'DEMO: Response concerning file',text:'Fictional demonstration: We acknowledge your request. The attached index lists the records.',labels:['INBOX'],attachments:['fictional-index.pdf'],source:'demo'}
];

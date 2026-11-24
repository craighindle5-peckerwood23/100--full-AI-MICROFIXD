import React, {useEffect, useState} from 'react';
import type {TelemetryEvent} from '../../../cognitive-shell/src/integration/ShellAPI';

export default function DetectionRing({commandState}: {commandState: string}) {
  const [readiness, setReadiness] = useState('awaiting readiness');
  useEffect(() => {
    let expiry: ReturnType<typeof setTimeout>;
    const observe = (event: Event) => {
      const sample = (event as CustomEvent<TelemetryEvent>).detail;
      if (sample?.type !== 'system.readiness') return;
      clearTimeout(expiry);
      const age = Date.now() - sample.timestamp;
      const data = sample.data as {status?: string; storage?: {durable?: boolean}} | undefined;
      if (!Number.isFinite(age) || age < 0 || age >= 45000) { setReadiness('readiness stale'); return; }
      setReadiness(sample.severity === 'info' && data?.status === 'ok' && data.storage?.durable === true
        ? 'runtime ready' : 'readiness unconfirmed');
      expiry = setTimeout(() => setReadiness('readiness stale'), 45000 - age);
    };
    window.addEventListener('microfixd:telemetry', observe);
    return () => { clearTimeout(expiry); window.removeEventListener('microfixd:telemetry', observe); };
  }, []);
  const label = commandState === 'ERROR' ? 'command needs review' : readiness;
  return <div className="hio-detection" data-ready={label === 'runtime ready'} role="status">
    <i aria-hidden="true"/><span>{label}</span>
  </div>;
}

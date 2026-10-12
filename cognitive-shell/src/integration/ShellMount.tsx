import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ShellChannels, ShellConfig, ShellHandle } from './ShellAPI';
import { createShellStore } from '../core/shellState';
import { createCommandBus } from '../core/commandBus';
import { attachTelemetry } from '../core/telemetryBus';
import { HolographicHeadShell } from '../app/HolographicHeadShell';
import '../styles/globals.css';

type Internal = {
  root: Root;
  store: ReturnType<typeof createShellStore>;
  channels?: ShellChannels;
  unsubscribe?: () => void;
  config: ShellConfig;
};

const handles = new WeakMap<ShellHandle, Internal>();

export function initShell(config: ShellConfig): ShellHandle {
  const mount = document.querySelector<HTMLElement>(config.mountSelector);
  if (!mount) throw new Error(`Cognitive shell mount not found: ${config.mountSelector}`);

  const store = createShellStore();
  const root = createRoot(mount);

  const handle: ShellHandle = {
    id: crypto.randomUUID(),
    destroy() {
      const internal = handles.get(handle);
      internal?.unsubscribe?.();
      internal?.root.unmount();
      handles.delete(handle);
    },
  };

  const internal: Internal = { root, store, config };
  handles.set(handle, internal);

  root.render(
    <HolographicHeadShell
      store={store}
      commands={createCommandBus(() => {
        throw new Error('Command channel not attached');
      })}
      title={config.title}
      embedded={config.embedded}
    />,
  );

  return handle;
}

export function attachChannels(handle: ShellHandle, channels: ShellChannels) {
  const internal = handles.get(handle);
  if (!internal) throw new Error('Unknown or destroyed shell handle');

  internal.unsubscribe?.();
  internal.channels = channels;
  internal.unsubscribe = attachTelemetry(internal.store, channels);

  internal.root.render(
    <HolographicHeadShell
      store={internal.store}
      commands={createCommandBus(channels.sendCommand)}
      title={internal.config.title}
      embedded={internal.config.embedded}
    />,
  );

  return () => {
    internal.unsubscribe?.();
    internal.unsubscribe = undefined;
  };
}

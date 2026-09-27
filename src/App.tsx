/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { OrganProvider } from './context/OrganContext';
import OSShell from './components/os/OSShell';
import BootSequence from './components/os/BootSequence';

export default function App() {
  const [bootComplete, setBootComplete] = useState(false);

  if (!bootComplete) {
    return <BootSequence onComplete={() => setBootComplete(true)} />;
  }

  // OSShell is the fully-wired OS shell: it renders every real room
  // (Mission Control, Agents, Supabase, Autonomy, etc.) and hosts the
  // persistent holographic Avatar + glassmorphic OrbitRing room-selector.
  // (The app previously rendered MicrofyxdUI here, a flat placeholder
  // dashboard with a plain blue circle in place of the intended
  // holographic entity — OSShell + Avatar + OrbitRing were fully built
  // but never mounted anywhere.)
  return (
    <OrganProvider>
      <OSShell onReboot={() => setBootComplete(false)} />
    </OrganProvider>
  );
}


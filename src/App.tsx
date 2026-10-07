/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { OrganProvider } from './context/OrganContext';
import OSShell from './components/os/OSShell';
import BootSequence from './components/os/BootSequence';
import { BrandProvider } from './branding/BrandProvider';
import AccountGate from './components/os/AccountGate';
import { isAccountsModeEnabled } from './lib/auth';

export default function App() {
  const [bootComplete, setBootComplete] = useState(false);
  const accountsMode = isAccountsModeEnabled();

  // OSShell is the fully-wired OS shell: it renders every real room
  // (Mission Control, Agents, Supabase, Autonomy, etc.) and hosts the
  // persistent holographic Avatar + glassmorphic OrbitRing room-selector.
  // (The app previously rendered MicrofyxdUI here, a flat placeholder
  // dashboard with a plain blue circle in place of the intended
  // holographic entity — OSShell + Avatar + OrbitRing were fully built
  // but never mounted anywhere.)
  const osTree = !bootComplete ? (
    <BootSequence onComplete={() => setBootComplete(true)} />
  ) : (
    <OrganProvider>
      <OSShell onReboot={() => setBootComplete(false)} />
    </OrganProvider>
  );

  // Accounts mode (VITE_AUTH_MODE=accounts) gates the whole OS behind a
  // real Supabase Auth sign-in/sign-up screen. Deployments that leave
  // VITE_AUTH_MODE unset render osTree directly, exactly as before — this
  // is purely additive. See docs/accounts-auth-guide.md.
  return (
    <BrandProvider>
      {accountsMode ? <AccountGate>{osTree}</AccountGate> : osTree}
    </BrandProvider>
  );
}


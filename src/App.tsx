/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useState } from 'react';
const SaasLanding = lazy(() => import('./marketing/SaasLanding'));
const CaseWorkspace = lazy(() => import('./casework/CaseWorkspace'));
import { OrganProvider } from './context/OrganContext';
import HolographicOS from './components/os/HolographicOS';
import BootSequence from './components/os/BootSequence';
import { BrandProvider } from './branding/BrandProvider';
import AccountGate from './components/os/AccountGate';
import { isAccountsModeEnabled } from './lib/auth';

export default function App() {
  const [bootComplete, setBootComplete] = useState(false);
  const accountsMode = isAccountsModeEnabled();

  if (['/saas','/saas/'].includes(window.location.pathname)) return <BrandProvider><Suspense fallback={<p>Loading workspace information…</p>}><SaasLanding /></Suspense></BrandProvider>;

  if (window.location.pathname === '/case-workspace') return <Suspense fallback={<p>Loading case workspace…</p>}><CaseWorkspace /></Suspense>;

  const osTree = !bootComplete ? (
    <BootSequence onComplete={() => setBootComplete(true)} />
  ) : (
    <OrganProvider>
      <HolographicOS onReboot={() => setBootComplete(false)} />
    </OrganProvider>
  );

  return (
    <BrandProvider>
      {accountsMode ? <AccountGate>{osTree}</AccountGate> : osTree}
    </BrandProvider>
  );
}

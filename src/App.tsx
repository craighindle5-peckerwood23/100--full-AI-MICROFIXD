/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { OrganProvider } from './context/OrganContext';
import MicrofyxdUI from './components/os/MicrofyxdUI';
import BootSequence from './components/os/BootSequence';

export default function App() {
  const [bootComplete, setBootComplete] = useState(false);

  if (!bootComplete) {
    return <BootSequence onComplete={() => setBootComplete(true)} />;
  }

  return (
    <OrganProvider>
      <MicrofyxdUI />
    </OrganProvider>
  );
}


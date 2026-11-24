import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ((import.meta as any).env.PROD && 'serviceWorker' in navigator && location.pathname === '/') {
  void navigator.serviceWorker.register('/recovery-worker.js').catch(() => {});
}

createRoot(document.getElementById('root')!, {
  onUncaughtError(error) {
    console.error('Interface crashed', error);
    window.location.replace('/recovery.html');
  },
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

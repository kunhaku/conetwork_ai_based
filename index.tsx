import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import LandingPage from './LandingPage.tsx';
import BetaGate from './components/BetaGate';
import BetaTerms from './components/BetaTerms';
import AdminInvites from './components/AdminInvites';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
const path = window.location.pathname || '/';
const useApp = path === '/app' || path.startsWith('/app/');
const useTerms = path === '/beta-terms' || path === '/privacy' || path === '/terms';
const useAdminInvites = path === '/admin/invites';

const RootApp: React.FC = () => {
  const [betaAccess, setBetaAccess] = useState(false);

  useEffect(() => {
    if (!useApp) return;
    const hasStored = localStorage.getItem('beta_access') === '1';
    if (hasStored) {
      setBetaAccess(true);
    }
  }, [useApp]);

  if (useTerms) {
    return <BetaTerms />;
  }

  if (useAdminInvites) {
    return <AdminInvites />;
  }

  if (useApp && !betaAccess) {
    return <BetaGate onUnlock={() => setBetaAccess(true)} />;
  }

  return useApp ? <App /> : <LandingPage />;
};

root.render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>
);

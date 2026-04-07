import React from 'react';
import ReactDOM from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';
import App from './App';
import { registerServiceWorker } from './utils/registerServiceWorker';

const redirectPath = sessionStorage.getItem('splitit-redirect');
if (redirectPath) {
  sessionStorage.removeItem('splitit-redirect');
  window.history.replaceState(null, '', redirectPath);
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </React.StrictMode>
);

// Register service worker
registerServiceWorker();

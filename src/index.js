import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register Service Worker for Push Notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // Always default to '/sw.js' if PUBLIC_URL is unset
      const base = process.env.PUBLIC_URL || '';
      const swPath = base ? base.replace(/\/$/, '') + '/sw.js' : '/sw.js';
      const registration = await navigator.serviceWorker.register(swPath, { scope: '/' });
      console.log('Service Worker registered:', registration.scope);
      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('Service Worker update found');
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('New Service Worker available');
          }
        });
      });
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  });
}

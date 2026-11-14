import './styles.css';
import { isFramed, showFramedNotice } from './lib/framing';
import { initApp } from './ui/app';

if (isFramed(window)) showFramedNotice(document, window.location.href);
else {
  initApp();
  // Keep the app itself available offline (public/sw.js). Production only: in development the
  // worker would cache Vite's unbundled modules and get in the way of hot reload.
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
        /* Offline use is a bonus; the app works the same without it. */
      });
    });
  }
}

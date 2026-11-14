import './styles.css';
import { isFramed, showFramedNotice } from './lib/framing';
import { initApp } from './ui/app';

if (isFramed(window)) showFramedNotice(document, window.location.href);
else initApp();

// Netlify build step: writes public/config.js so the pages talk to the Railway API.
// Set MIQAT_API in Netlify › Site configuration › Environment variables, e.g. https://miqat-production.up.railway.app
const fs = require('fs');
const path = require('path');
const api = String(process.env.MIQAT_API || '').trim().replace(/\/+$/, '');
if (!api) console.warn('⚠  MIQAT_API is not set — pages will run in single-device mode (no phone control).');
else if (!/^https:\/\//.test(api)) { console.error('MIQAT_API must start with https://'); process.exit(1); }
fs.writeFileSync(path.join(__dirname, '..', 'public', 'config.js'),
  `/* generated at build time */\nwindow.MIQAT_API = ${JSON.stringify(api)};\n`);
console.log('config.js →', api || '(same origin)');

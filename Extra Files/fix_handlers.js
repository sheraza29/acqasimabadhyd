const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// The three event listeners got mangled. Fix the petrol block and re-insert fv and lpg.

// 1. Fix the orphaned petrol block (currently has no addEventListener wrapper)
code = code.replace(
    /\n    saveSealingDomain\('petrol_check', 'petrol', \{\n        violation: document\.getElementById\('petrol-violation'\)\.value\n    \}, `inspected Petrol Pump: \{target\}`\);\n\}\);/,
    `\ndocument.getElementById('save-fv-btn').addEventListener('click', () => {\n    saveSealingDomain('fv_price', 'fv', {\n        produce: document.getElementById('fv-produce').value,\n        notifiedPrice: document.getElementById('fv-notified-price').value,\n        foundPrice: document.getElementById('fv-found-price').value,\n        violation: document.getElementById('fv-violation').value\n    }, \`inspected F&V vendor: \${document.getElementById('fv-target-name').value}\`);\n});\n\ndocument.getElementById('save-lpg-btn').addEventListener('click', () => {\n    saveSealingDomain('lpg_price', 'lpg', {\n        violation: document.getElementById('lpg-violation').value,\n        notifiedPrice: document.getElementById('lpg-notified-price').value,\n        foundPrice: document.getElementById('lpg-found-price').value\n    }, \`inspected LPG outlet: {target}\`);\n});\n\ndocument.getElementById('save-petrol-btn').addEventListener('click', () => {\n    saveSealingDomain('petrol_check', 'petrol', {\n        violation: document.getElementById('petrol-violation').value\n    }, \`inspected Petrol Pump: {target}\`);\n});`
);

fs.writeFileSync('public/app.js', code);

// Verify
const result = require('fs').readFileSync('public/app.js', 'utf8');
console.log('save-fv-btn:', result.includes("document.getElementById('save-fv-btn')"));
console.log('save-lpg-btn:', result.includes("document.getElementById('save-lpg-btn')"));
console.log('save-petrol-btn:', result.includes("document.getElementById('save-petrol-btn')"));
console.log('lpg-notified-price:', result.includes('lpg-notified-price'));

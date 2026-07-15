const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// The edit removed save-fv-btn and save-lpg-btn and corrupted save-petrol-btn
// We need to re-insert them cleanly

// First check if they are missing
const hasFvBtn = code.includes("document.getElementById('save-fv-btn')");
const hasLpgBtn = code.includes("document.getElementById('save-lpg-btn')");
const hasPetrolBtn = code.includes("document.getElementById('save-petrol-btn')");

console.log('save-fv-btn:', hasFvBtn);
console.log('save-lpg-btn:', hasLpgBtn);
console.log('save-petrol-btn:', hasPetrolBtn);

// Find position of the corrupt petrol block
const petrolIdx = code.indexOf("    saveSealingDomain('petrol_check', 'petrol', {");
console.log('petrol idx:', petrolIdx);
console.log('context:', code.substring(petrolIdx - 50, petrolIdx + 200));

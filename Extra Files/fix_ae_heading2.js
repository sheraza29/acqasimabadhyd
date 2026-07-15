const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

code = code.replace(
    /let metric2Name = "Total Fines \(Rs\)";/g,
    "let metric2Name = window.currentDomain === 'anti_encroachment' ? 'Approximate value of land recovered (Rs)' : 'Total Fines (Rs)';"
);

fs.writeFileSync('public/app.js', code, 'utf8');
console.log("Updated heading");

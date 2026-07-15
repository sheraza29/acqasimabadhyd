const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// Change training trapdoor to sandbox
code = code.replace(
    'if (identifier === "training" && password === "training123") {',
    'if (identifier === "sandbox" && password === "sandbox123") {'
);

fs.writeFileSync('public/app.js', code, 'utf8');
console.log("Sandbox updated.");

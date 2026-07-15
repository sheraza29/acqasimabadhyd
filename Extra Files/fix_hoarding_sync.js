const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// Replace all instances of colName = "anti_hoarding" with colName = "hoarding_entities"
code = code.replace(/colName = "anti_hoarding"/g, 'colName = "hoarding_entities"');

fs.writeFileSync('public/app.js', code, 'utf8');
console.log("Replaced anti_hoarding colName mismatch.");

const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// Replace the bindPopup for anti_hoarding
code = code.replace(
    /marker\.bindPopup\(`<b>\$\{entity\.name\}<\/b><br>\$\{entity\.owner \|\| 'Unknown'\}<br><button onclick="window\.openEntityDashboard\('\$\{entity\.id\}', 'anti_hoarding'\)" style="margin-top:5px; width:100%;" class="primary-btn">View Dashboard<\/button>`\);/g,
    "marker.on('click', () => window.openEntityDashboard(entity.id, 'anti_hoarding'));"
);

fs.writeFileSync('public/app.js', code, 'utf8');
console.log("Fixed hoarding marker click handler.");

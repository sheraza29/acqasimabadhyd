const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

code = code.replace(
    /if \(typeof renderShops === 'function'\) renderShops\(\);\n    \}\);\n\}\);/g,
    "if (typeof renderShops === 'function') renderShops();\n        if (typeof window.renderLocalActivityFeed === 'function') window.renderLocalActivityFeed();\n    });\n});"
);

fs.writeFileSync('public/app.js', code, 'utf8');
console.log("Updated domain selection");

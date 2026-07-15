const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// viewInspection lpg block uses LF (not CRLF) — fix it directly
code = code.replace(
    "} else if (domain === 'lpg_price') {\n        fieldsHTML += row('Violation', act.violation);\n    }",
    `} else if (domain === 'lpg_price') {\n        fieldsHTML += row('Govt. Notified Rate', act.notifiedPrice ? 'Rs ' + act.notifiedPrice + '/cylinder' : null);\n        fieldsHTML += row('Rate Found at Outlet', act.foundPrice ? 'Rs ' + act.foundPrice + '/cylinder' : null);\n        fieldsHTML += row('Violation', act.violation === 'yes' ? '⚠️ Overcharging' : '✅ Compliant');\n    }`
);

fs.writeFileSync('public/app.js', code);

const result = fs.readFileSync('public/app.js', 'utf8');
console.log('LPG rates in viewInspection:', result.includes("Rate Found at Outlet"));

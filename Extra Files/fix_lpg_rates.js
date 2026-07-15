const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// 1. editInspection — populate LPG rate fields when editing
code = code.replace(
    /document\.getElementById\('lpg-violation'\)\.value = act\.violation \|\| 'none';\r\n        document\.getElementById\('lpg-fine-amount'\)\.value = act\.fineAmount \|\| '';/,
    `document.getElementById('lpg-violation').value = act.violation || 'none';\r\n        document.getElementById('lpg-notified-price').value = act.notifiedPrice || '';\r\n        document.getElementById('lpg-found-price').value = act.foundPrice || '';\r\n        document.getElementById('lpg-fine-amount').value = act.fineAmount || '';`
);

// 2. viewInspection — add LPG rate info to the row display
code = code.replace(
    /} else if \(domain === 'lpg_price'\) \{\r\n        fieldsHTML \+= row\('Violation', act\.violation\);\r\n    \}/,
    `} else if (domain === 'lpg_price') {\r\n        fieldsHTML += row('Govt. Notified Rate', act.notifiedPrice ? 'Rs ' + act.notifiedPrice + '/cylinder' : null);\r\n        fieldsHTML += row('Rate Found at Outlet', act.foundPrice ? 'Rs ' + act.foundPrice + '/cylinder' : null);\r\n        fieldsHTML += row('Violation', act.violation === 'yes' ? '⚠️ Overcharging' : '✅ Compliant');\r\n    }`
);

// 3. generateDomainReport — add LPG rates to the exported actionDesc
code = code.replace(
    /} else if \(domainKey === 'lpg_price' \|\| domainKey === 'petrol_check'\) \{\r\n                let violText = \(act\.violation && act\.violation !== 'none'\) \? act\.violation\.toUpperCase\(\)\.replace\('_', ' '\) : "No";\r\n                if \(violText !== "No" \|\| parseInt\(act\.fineAmount\) > 0 \|\| sealedStatus !== "No"\) isViolation = true;\r\n                actionDesc = `Violation: \$\{violText\}\\nFine: Rs\. \$\{act\.fineAmount \|\| 0\}\\nSealed: \$\{sealedStatus\}`;/,
    `} else if (domainKey === 'lpg_price' || domainKey === 'petrol_check') {\r\n                let violText = (act.violation && act.violation !== 'none') ? act.violation.toUpperCase().replace('_', ' ') : "No";\r\n                if (violText !== "No" || parseInt(act.fineAmount) > 0 || sealedStatus !== "No") isViolation = true;\r\n                let rateInfo = '';\r\n                if (domainKey === 'lpg_price' && (act.notifiedPrice || act.foundPrice)) {\r\n                    rateInfo = \`\\nGovt Rate: Rs. \${act.notifiedPrice || '-'} | Found: Rs. \${act.foundPrice || '-'}\`;\r\n                }\r\n                actionDesc = \`Violation: \${violText}\\nFine: Rs. \${act.fineAmount || 0}\\nSealed: \${sealedStatus}\${rateInfo}\`;`
);

fs.writeFileSync('public/app.js', code);

const result = fs.readFileSync('public/app.js', 'utf8');
console.log('LPG notified in editInspection:', result.includes("lpg-notified-price') .value = act.notifiedPrice"));
console.log('LPG rates in viewInspection:', result.includes("Rate Found at Outlet"));
console.log('LPG rates in report:', result.includes("Govt Rate: Rs."));

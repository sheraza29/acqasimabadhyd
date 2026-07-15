const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// ─── FIX 1: Guard check — add fvEntities resolution ──────────────────────────
code = code.replace(
    /if \(window\.currentDomain === 'anti_hoarding'\) entities = hoardingEntities;\s*\n\s*if \(entities\.length === 0\) return alert\("No entity data available to export\."\);/,
    `if (window.currentDomain === 'anti_hoarding') entities = hoardingEntities;\n            if (window.currentDomain === 'fv_price') entities = fvEntities;\n            \n            if (entities.length === 0) return alert("No entity data available to export.");`
);

// ─── FIX 2: confirm-export-btn — route fv_price to generateDomainReport ──────
code = code.replace(
    /\} else if \(\['retail_price', 'lpg_price', 'petrol_check', 'anti_hoarding'\]\.includes\(window\.currentDomain\)\) \{/,
    `} else if (['retail_price', 'lpg_price', 'petrol_check', 'anti_hoarding', 'fv_price'].includes(window.currentDomain)) {`
);

// ─── FIX 3a: generateDomainReport — add fv_price entity + title ──────────────
code = code.replace(
    /else if \(domainKey === 'anti_hoarding'\) \{ entities = hoardingEntities; reportTitle = "Anti-Hoarding Operations Report"; \}/,
    `else if (domainKey === 'anti_hoarding') { entities = hoardingEntities; reportTitle = "Anti-Hoarding Operations Report"; }\n    else if (domainKey === 'fv_price') { entities = fvEntities; reportTitle = "Fruits & Vegetables Price Control Report"; }`
);

// ─── FIX 3b: generateDomainReport — add fv_price columns ─────────────────────
code = code.replace(
    /} else if \(domainKey === 'anti_hoarding'\) \{\s*columns\.push\(\{ key: 'commodity', width: 20 \}\);\s*columns\.push\(\{ key: 'volume', width: 15 \}\);\s*columns\.push\(\{ key: 'fir', width: 30 \}\);\s*\}/,
    `} else if (domainKey === 'anti_hoarding') {
            columns.push({ key: 'commodity', width: 20 });
            columns.push({ key: 'volume', width: 15 });
            columns.push({ key: 'fir', width: 30 });
        } else if (domainKey === 'fv_price') {
            columns.push({ key: 'produce', width: 22 });
            columns.push({ key: 'notified_rate', width: 18 });
            columns.push({ key: 'found_rate', width: 18 });
            columns.push({ key: 'action', width: 32 });
        }`
);

// ─── FIX 3c: generateDomainReport — add fv_price header labels ───────────────
code = code.replace(
    /} else if \(domainKey === 'anti_hoarding'\) \{\s*headerObj\.commodity = 'Commodity';\s*headerObj\.volume = 'Volume \(MT\)';\s*headerObj\.fir = 'FIR Details';\s*\}/,
    `} else if (domainKey === 'anti_hoarding') {
            headerObj.commodity = 'Commodity';
            headerObj.volume = 'Volume (MT)';
            headerObj.fir = 'FIR Details';
        } else if (domainKey === 'fv_price') {
            headerObj.produce = 'Produce Type';
            headerObj.notified_rate = 'Govt. Notified Rate (PKR)';
            headerObj.found_rate = 'Rate Found at Entity (PKR)';
            headerObj.action = 'Adherence / Fine';
        }`
);

// ─── FIX 3d: generateDomainReport — add fv_price actionDesc + rowObj ─────────
code = code.replace(
    /} else if \(domainKey === 'anti_hoarding'\) \{\s*rowObj\.commodity = act\.commodity \|\| '-';\s*rowObj\.volume = act\.volumeMT \|\| '-';\s*rowObj\.fir = act\.fir \|\| 'None';\s*if \(act\.fir\) isViolation = true;\s*\}/,
    `} else if (domainKey === 'anti_hoarding') {
                rowObj.commodity = act.commodity || '-';
                rowObj.volume = act.volumeMT || '-';
                rowObj.fir = act.fir || 'None';
                if (act.fir) isViolation = true;
            } else if (domainKey === 'fv_price') {
                let adhText = act.violation === 'non_compliant' ? 'Non-Compliant' : 'Compliant';
                if (act.violation === 'non_compliant' || parseInt(act.fineAmount) > 0 || sealedStatus !== 'No') isViolation = true;
                actionDesc = \`Adherence: \${adhText}\\nFine: Rs. \${act.fineAmount || 0}\\nSealed/Seized: \${sealedStatus}\`;
                rowObj.produce = act.produce || '-';
                rowObj.notified_rate = act.notifiedPrice ? 'Rs. ' + act.notifiedPrice : '-';
                rowObj.found_rate = act.foundPrice ? 'Rs. ' + act.foundPrice : '-';
                rowObj.action = actionDesc;
            }`
);

fs.writeFileSync('public/app.js', code);
console.log("F&V report generation fully fixed");

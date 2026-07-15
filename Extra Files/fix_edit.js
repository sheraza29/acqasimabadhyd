const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// Fix entities array resolution in editInspection
code = code.replace(
    /else if \(domain === 'retail_price'\) entities = retailEntities;/g,
    `else if (domain === 'retail_price') entities = retailEntities;\n    else if (domain === 'fv_price') entities = fvEntities;`
);

// Fix modal populating logic in editInspection
code = code.replace(
    /else if \(domain === 'lpg_price'\) \{/g,
    `else if (domain === 'fv_price') {\n        document.getElementById('fv-target-name').value = entity.name;\n        document.getElementById('fv-produce').value = act.produce || '';\n        document.getElementById('fv-notified-price').value = act.notifiedPrice || '';\n        document.getElementById('fv-found-price').value = act.foundPrice || '';\n        document.getElementById('fv-violation').value = act.violation || 'compliant';\n        document.getElementById('fv-fine-amount').value = act.fineAmount || '';\n        document.getElementById('fv-sealing').value = act.sealingAction || 'none';\n        document.getElementById('fv-price-modal').style.display = 'flex';\n    } else if (domain === 'lpg_price') {`
);

fs.writeFileSync('public/app.js', code);
console.log("fv_price editInspection fixes applied");

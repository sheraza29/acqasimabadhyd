const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// Fix colName
code = code.replace(
    /if \(domainKey === 'retail_price'\) colName = "retail_entities";/g,
    `if (domainKey === 'retail_price') colName = "retail_entities";\n    if (domainKey === 'fv_price') colName = "fv_entities";`
);

// Fix modal close
code = code.replace(
    /else if \(domainKey === 'retail_price'\) document\.getElementById\('retail-price-modal'\)\.style\.display = 'none';/g,
    `else if (domainKey === 'retail_price') document.getElementById('retail-price-modal').style.display = 'none';\n    else if (domainKey === 'fv_price') document.getElementById('fv-price-modal').style.display = 'none';`
);

fs.writeFileSync('public/app.js', code);
console.log("fv_price fixes applied");

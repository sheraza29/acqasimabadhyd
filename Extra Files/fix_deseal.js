const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// Fix colName and entities resolution in adminDeSealEntity submit logic
code = code.replace(
    /else if \(domainKey === 'anti_hoarding'\) \{ colName = "anti_hoarding"; entities = hoardingEntities; \}/g,
    `else if (domainKey === 'anti_hoarding') { colName = "anti_hoarding"; entities = hoardingEntities; }\n                else if (domainKey === 'fv_price') { colName = "fv_entities"; entities = fvEntities; }`
);

fs.writeFileSync('public/app.js', code);
console.log("fv_price added to adminDeSealEntity logic");

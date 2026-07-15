const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// The original line has Unicode (🍎 and ➕)
// Let's use a regex to match it more safely
code = code.replace(
    /else if \(window\.currentDomain === 'fv_price'\) btnAddActivity\.innerText = [^\n]+/,
    "else if (window.currentDomain === 'fv_price') btnAddActivity.innerText = \"🍎 Register Stall/Shop at Current Location\";\n            else if (window.currentDomain === 'anti_hoarding') btnAddActivity.innerText = \"➕ Register Godown / Storage at this location\";\n            else if (window.currentDomain === 'tobacco_enforcement') btnAddActivity.innerText = \"➕ Register Tobacco Shop at Current Location\";"
);

fs.writeFileSync('public/app.js', code, 'utf8');
console.log("Done");

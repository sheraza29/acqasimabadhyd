const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// Find exact LPG block in editInspection
const editIdx = code.indexOf("document.getElementById('lpg-violation').value = act.violation");
console.log('editInspection lpg block idx:', editIdx);
if (editIdx > -1) {
    console.log('context:', JSON.stringify(code.substring(editIdx, editIdx + 200)));
}

// Find exact LPG block in viewInspection
const viewIdx = code.indexOf("domain === 'lpg_price') {");
console.log('\nviewInspection lpg block idx:', viewIdx);
if (viewIdx > -1) {
    console.log('context:', JSON.stringify(code.substring(viewIdx, viewIdx + 200)));
}

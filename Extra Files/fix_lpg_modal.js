const fs = require('fs');
let code = fs.readFileSync('public/index.html', 'utf8');

// 1. Remove the stray LPG fields from inside the F&V modal
// They sit between the fv-violation </select></div> and fv-fine-amount
code = code.replace(
    `            </div>\n            <div class="form-group">\n                <label>Government Notified Rate (PKR/Cylinder):</label>\n                <input type="number" id="lpg-notified-price" class="form-control" placeholder="E.g., 3000" min="0">\n            </div>\n            <div class="form-group">\n                <label>Rate Found at Outlet (PKR/Cylinder):</label>\n                <input type="number" id="lpg-found-price" class="form-control" placeholder="E.g., 3200" min="0">\n            </div>\n            <div class="form-group">\n                <label>Fine Imposed (PKR):</label>\n                <input type="number" id="fv-fine-amount"`,
    `            </div>\n            <div class="form-group">\n                <label>Fine Imposed (PKR):</label>\n                <input type="number" id="fv-fine-amount"`
);

// 2. Insert the rate fields into the LPG modal, after the violation dropdown and before Fine Imposed
code = code.replace(
    `            </div>\r\n            <div class="form-group">\r\n                <label>Fine Imposed (PKR):</label>\r\n                <input type="number" id="lpg-fine-amount"`,
    `            </div>\r\n            <div class="form-group">\r\n                <label>Government Notified Rate (PKR/Cylinder):</label>\r\n                <input type="number" id="lpg-notified-price" class="form-control" placeholder="E.g., 3000" min="0">\r\n            </div>\r\n            <div class="form-group">\r\n                <label>Rate Found at Outlet (PKR/Cylinder):</label>\r\n                <input type="number" id="lpg-found-price" class="form-control" placeholder="E.g., 3200" min="0">\r\n            </div>\r\n            <div class="form-group">\r\n                <label>Fine Imposed (PKR):</label>\r\n                <input type="number" id="lpg-fine-amount"`
);

fs.writeFileSync('public/index.html', code);

// Verify
const result = fs.readFileSync('public/index.html', 'utf8');
const fvIdx = result.indexOf('fv-price-modal');
const lpgIdx = result.indexOf('lpg-price-modal');
const notifiedIdx = result.indexOf('lpg-notified-price');
const foundIdx = result.indexOf('lpg-found-price');
console.log('fv-price-modal at char:', fvIdx);
console.log('lpg-price-modal at char:', lpgIdx);
console.log('lpg-notified-price at char:', notifiedIdx);
console.log('lpg-found-price at char:', foundIdx);
console.log('Fields inside LPG modal:', notifiedIdx > lpgIdx ? 'YES' : 'NO');
console.log('Fields NOT inside FV modal:', notifiedIdx > fvIdx + 1000 ? 'YES' : 'STILL IN FV');

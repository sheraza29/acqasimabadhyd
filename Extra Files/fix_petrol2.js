const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

const missingBlock = `
document.getElementById('save-fv-btn').addEventListener('click', () => {
    saveSealingDomain('fv_price', 'fv', {
        produce: document.getElementById('fv-produce').value,
        notifiedPrice: document.getElementById('fv-notified-price').value,
        foundPrice: document.getElementById('fv-found-price').value,
        violation: document.getElementById('fv-violation').value
    }, \`inspected F&V vendor: \${document.getElementById('fv-target-name').value}\`);
});

document.getElementById('save-lpg-btn').addEventListener('click', () => {
    saveSealingDomain('lpg_price', 'lpg', {
        violation: document.getElementById('lpg-violation').value,
        notifiedPrice: document.getElementById('lpg-notified-price').value,
        foundPrice: document.getElementById('lpg-found-price').value
    }, \`inspected LPG outlet: {target}\`);
});

document.getElementById('save-petrol-btn').addEventListener('click', () => {
    let violationVal = document.getElementById('petrol-violation').value;
    let fuelType = document.getElementById('petrol-fuel-type').value;
    let actualFuel = document.getElementById('petrol-actual-fuel').value;
    
    let fuelStr = fuelType;
    if ((violationVal === 'yes_quantity' || violationVal === 'yes_both') && actualFuel) {
        let shortAmount = 1000 - parseInt(actualFuel);
        fuelStr += \` - \${actualFuel}ml / 1000ml charge (\${shortAmount}ml short)\`;
    }

    saveSealingDomain('petrol_check', 'petrol', {
        violation: violationVal,
        fuelType: fuelType,
        actualFuel: actualFuel,
        customActionDesc: fuelStr
    }, \`inspected Petrol Pump: {target}\`);
});

document.getElementById('petrol-violation').addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'yes_quantity' || val === 'yes_both') {
        document.getElementById('petrol-actual-fuel-group').style.display = 'block';
    } else {
        document.getElementById('petrol-actual-fuel-group').style.display = 'none';
        document.getElementById('petrol-actual-fuel').value = '';
    }
});

document.getElementById('save-ah-btn').addEventListener('click', async () => {
    if (!window.activeEntity) return alert("No active entity selected!");

    let editReason = null;
    if (editingInspectionId) {
        editReason = prompt("Security Check: Please type the mandatory reason why you are amending this inspection (min 5 characters):");
        if (!editReason || editReason.trim().length < 5) {
`;

let lines = code.split('\n');
let newLines = [];
let skip = false;
let foundInsertPoint = false;
for (let i = 0; i < lines.length; i++) {
    let currentLine = lines[i];
    if (currentLine.includes("inspected retail store:")) {
        newLines.push(currentLine);
        // Wait one more line for the closing bracket
    } else if (i > 0 && lines[i-1].includes("inspected retail store:")) {
        newLines.push(currentLine); // The '});' line
        newLines.push(missingBlock.trim());
        skip = true;
        foundInsertPoint = true;
    } else if (skip) {
        if (currentLine.includes('return alert("Amendment cancelled: A valid reason is required.");')) {
            skip = false;
            newLines.push(currentLine);
        }
    } else {
        newLines.push(currentLine);
    }
}
fs.writeFileSync('public/app.js', newLines.join('\n'), 'utf8');
console.log("Done fixing app.js. Found point: " + foundInsertPoint);

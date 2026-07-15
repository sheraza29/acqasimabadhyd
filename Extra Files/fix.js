const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

code = code.replace(
    /window\.currentDomain === 'retail_price'\) \{\s*const icon = getIcon\('[^']+', '#6ee7b7'\);/g,
    `window.currentDomain === 'retail_price') {\n        const icon = getIcon('🏪', '#6ee7b7');`
);

code = code.replace(
    /window\.currentDomain === 'fv_price'\) \{\s*const icon = getIcon\('[^']+', '#6ee7b7'\);/g,
    `window.currentDomain === 'fv_price') {\n        const icon = getIcon('🍎', '#6ee7b7');`
);

code = code.replace(
    /window\.currentDomain === 'wholesale_price'\) \{\s*const icon = getIcon\('[^']+', '#6ee7b7'\);/g,
    `window.currentDomain === 'wholesale_price') {\n        const icon = getIcon('🏭', '#6ee7b7');`
);

code = code.replace(
    /window\.currentDomain === 'lpg_price'\) \{\s*const icon = getIcon\('[^']+', '#fbbf24'\);/g,
    `window.currentDomain === 'lpg_price') {\n        const icon = getIcon('🔥', '#fbbf24');`
);

code = code.replace(
    /window\.currentDomain === 'petrol_check'\) \{\s*const icon = getIcon\('[^']+', '#fbbf24'\);/g,
    `window.currentDomain === 'petrol_check') {\n        const icon = getIcon('⛽', '#fbbf24');`
);

code = code.replace(
    /window\.currentDomain === 'anti_hoarding'\) \{\s*const icon = getIcon\('[^']+', '#d97706'\);/g,
    `window.currentDomain === 'anti_hoarding') {\n        const icon = getIcon('📦', '#d97706');`
);

code = code.replace(
    /window\.currentDomain === 'anti_encroachment'\) \{\s*const icon = getIcon\('[^']+', '#dc2626'\);/g,
    `window.currentDomain === 'anti_encroachment') {\n        const icon = getIcon('🚜', '#dc2626');`
);

code = code.replace(
    /window\.currentDomain === 'tobacco_enforcement' \|\| !window\.currentDomain\) \{\s*const icon = getIcon\('[^']+', '#c084fc'\);/g,
    `window.currentDomain === 'tobacco_enforcement' || !window.currentDomain) {\n        const icon = getIcon('🚬', '#c084fc');`
);

fs.writeFileSync('public/app.js', code);
console.log("Fixed emojis");

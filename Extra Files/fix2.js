const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

const replacements = [
    { from: />\?\? Entity Sealed</g, to: '>🔒 Entity Sealed<' },
    { from: />\?\? De-Sealed</g, to: '>🔓 De-Sealed<' },
    { from: />\?\? Edit</g, to: '>✏️ Edit<' },
    { from: />\?\? De-Seal</g, to: '>🔓 De-Seal<' },
    { from: />\?\? Generate Report</g, to: '>📊 Generate Report<' },
    { from: /"Y"' Entity Sealed"/g, to: '"🔒 Entity Sealed"' },
    { from: /"Y"" De-Sealed"/g, to: '"🔓 De-Sealed"' },
    { from: /"o\?\? Edit"/g, to: '"✏️ Edit"' }
];

replacements.forEach(r => {
    code = code.replace(r.from, r.to);
});

fs.writeFileSync('public/app.js', code);
console.log("Fixed other emojis");

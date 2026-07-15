const fs = require('fs');
let code = fs.readFileSync('public/index.html', 'utf8');

code = code.replace('<script src="app.js?v=3.3"></script>', '<script src="app.js?v=3.4"></script>');
code = code.replace('<link rel="stylesheet" href="style.css?v=1.3" />', '<link rel="stylesheet" href="style.css?v=1.4" />');

fs.writeFileSync('public/index.html', code, 'utf8');

let sw = fs.readFileSync('public/sw.js', 'utf8');
sw = sw.replace(/const CACHE_NAME = 'qasimabad-v\d+';/, "const CACHE_NAME = 'qasimabad-v26';");
fs.writeFileSync('public/sw.js', sw, 'utf8');

console.log("Bumped version to v3.4 and sw to v26");

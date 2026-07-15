const fs = require('fs');
let code = fs.readFileSync('public/index.html', 'utf8');

code = code.replace('<script src="app.js?v=3.1"></script>', '<script src="app.js?v=3.2"></script>');
code = code.replace('<link rel="stylesheet" href="style.css?v=1.1" />', '<link rel="stylesheet" href="style.css?v=1.2" />');

fs.writeFileSync('public/index.html', code, 'utf8');

let sw = fs.readFileSync('public/sw.js', 'utf8');
sw = sw.replace(/const CACHE_NAME = 'qasimabad-v\d+';/, "const CACHE_NAME = 'qasimabad-v24';");
fs.writeFileSync('public/sw.js', sw, 'utf8');

console.log("Bumped version");

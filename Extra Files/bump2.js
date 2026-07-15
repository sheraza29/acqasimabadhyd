const fs = require('fs');
let code = fs.readFileSync('public/index.html', 'utf8');

code = code.replace('<script src="app.js?v=3.0"></script>', '<script src="app.js?v=3.1"></script>');
code = code.replace('<link rel="stylesheet" href="style.css" />', '<link rel="stylesheet" href="style.css?v=1.1" />');

fs.writeFileSync('public/index.html', code, 'utf8');
console.log("Bumped version");

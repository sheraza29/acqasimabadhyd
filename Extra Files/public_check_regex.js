const fs = require('fs');
const html = fs.readFileSync('D:/Hyderabad Maps/Map_App/public/index.html', 'utf8');
const js = fs.readFileSync('D:/Hyderabad Maps/Map_App/public/app.js', 'utf8');

const missing = [];
const matches = [...js.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)];

for (const match of matches) {
    const id = match[1];
    if (!html.includes('id="' + id + '"') && !html.includes("id='" + id + "'")) {
        missing.push(id);
    }
}

console.log("Missing IDs globally referenced:", [...new Set(missing)]);

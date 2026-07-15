const fs = require('fs');
const html = fs.readFileSync('D:/Hyderabad Maps/Map_App/public/index.html', 'utf8');
const js = fs.readFileSync('D:/Hyderabad Maps/Map_App/public/app.js', 'utf8');

const missingIds = [];

// Check direct addEventListeners
const directMatches = [...js.matchAll(/document\.getElementById\('([^']+)'\)\.addEventListener/g)];
for (const match of directMatches) {
    const id = match[1];
    if (!html.includes('id="' + id + '"')) {
        missingIds.push(id);
    }
}

// Check stored variables that might be added listeners to
const varMatches = [...js.matchAll(/const\s+(\w+)\s*=\s*document\.getElementById\('([^']+)'\)/g)];
for (const match of varMatches) {
    const id = match[2];
    if (!html.includes('id="' + id + '"')) {
        missingIds.push(id);
    }
}

console.log("Missing IDs:", missingIds);

const fs = require('fs');
const html = fs.readFileSync('D:/Hyderabad Maps/Map_App/public/index.html', 'utf8');
const js = fs.readFileSync('D:/Hyderabad Maps/Map_App/public/app.js', 'utf8');

const missingIds = [];
const missingSelectors = [];

// Check getElementById
const idRegex = /getElementById\(['"`](.+?)['"`]\)/g;
let match;
while ((match = idRegex.exec(js)) !== null) {
    const id = match[1];
    if (!html.includes('id="' + id + '"') && !html.includes("id='" + id + "'")) {
        // Exclude dynamically generated ids
        if (!id.includes('${')) {
            missingIds.push(id);
        }
    }
}

// Check querySelector
const queryRegex = /querySelector\(['"`](.+?)['"`]\)/g;
while ((match = queryRegex.exec(js)) !== null) {
    const selector = match[1];
    // Very basic check for ID selectors
    if (selector.startsWith('#')) {
        const id = selector.substring(1).split(' ')[0]; // Extract ID part
        if (!html.includes('id="' + id + '"') && !html.includes("id='" + id + "'")) {
            missingSelectors.push(selector);
        }
    }
}

console.log("Missing IDs:", [...new Set(missingIds)]);
console.log("Missing Selectors:", [...new Set(missingSelectors)]);

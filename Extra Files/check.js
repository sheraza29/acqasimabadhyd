const fs = require('fs');
const appJs = fs.readFileSync('public/app.js', 'utf8');
const html = fs.readFileSync('public/index.html', 'utf8');
const regex = /document\.getElementById\(['"`](.*?)['"`]\)(?:\?)?\.addEventListener/g;
let match;
while((match = regex.exec(appJs)) !== null) {
    if(!html.includes('id="' + match[1] + '"')) {
        console.log('MISSING:', match[1]);
    }
}

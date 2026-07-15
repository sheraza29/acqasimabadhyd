const fs = require('fs');
const acorn = require('acorn');
const walk = require('acorn-walk');

const html = fs.readFileSync('D:/Hyderabad Maps/Map_App/public/index.html', 'utf8');
const js = fs.readFileSync('D:/Hyderabad Maps/Map_App/public/app.js', 'utf8');

const ast = acorn.parse(js, { ecmaVersion: 2022, sourceType: 'module' });

const missing = [];
const topLevelExpressions = [];

walk.simple(ast, {
    CallExpression(node) {
        if (node.callee && node.callee.object && node.callee.object.name === 'document' && node.callee.property && node.callee.property.name === 'getElementById') {
            const id = node.arguments[0].value;
            if (id && !html.includes('id="' + id + '"') && !html.includes("id='" + id + "'")) {
                missing.push(id);
            }
        }
    }
});

console.log("Missing IDs globally referenced:", [...new Set(missing)]);

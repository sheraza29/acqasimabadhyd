const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require('fs');

const html = fs.readFileSync('D:/Hyderabad Maps/Map_App/public/index.html', 'utf8');
const js = fs.readFileSync('D:/Hyderabad Maps/Map_App/public/app.js', 'utf8');

const dom = new JSDOM(html, { runScripts: "dangerously" });

// Polyfill and Mock
dom.window.fbOnAuthStateChanged = function() {};
dom.window.fbCollection = function() {};
dom.window.fbDoc = function() {};
dom.window.fbSetDoc = async function() { return Promise.resolve(); };
dom.window.fbGetDocs = function() {};
dom.window.fbGetDoc = function() {};
dom.window.fbOnSnapshot = function() {};
dom.window.fbQuery = function() {};
dom.window.fbWhere = function() {};
dom.window.L = { 
    map: () => ({ setView: () => ({}) }), 
    control: { zoom: () => ({ addTo: () => {} }) }, 
    tileLayer: () => ({ addTo: () => {} }),
    imageOverlay: { rotated: () => ({ addTo: () => {} }) },
    latLng: () => ({}),
    divIcon: () => ({})
};
dom.window.alert = function(msg) { console.log("ALERT:", msg); };
dom.window.console.error = function(...args) { console.log("JSDOM CONSOLE ERROR:", ...args); };
dom.window.console.log = function(...args) { console.log("JSDOM CONSOLE LOG:", ...args); };

try {
    dom.window.eval(js);
    console.log("APP.JS EXECUTED GLOBALLY.");
} catch (e) {
    console.log("APP.JS THREW GLOBAL ERROR:", e);
}

try {
    // Set user profile
    dom.window.userProfile = { name: 'Test', designation: 'Test', role: 'admin' };
    
    console.log("Clicking nav-profile-btn...");
    const btn = dom.window.document.getElementById('nav-profile-btn');
    if (!btn) {
        console.log("ERROR: nav-profile-btn NOT FOUND IN DOM!");
    } else {
        btn.click();
        console.log("Button clicked. Modal display:", dom.window.document.getElementById('user-profile-modal').style.display);
    }
} catch (e) {
    console.log("CLICK THREW ERROR:", e);
}

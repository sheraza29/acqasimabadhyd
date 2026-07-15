const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

const viewerLogic = `
// ==========================================
// GLOBAL IMAGE VIEWER LOGIC
// ==========================================
let currentZoom = 1;
window.openImageViewer = function(src) {
    const modal = document.getElementById('image-viewer-modal');
    const img = document.getElementById('iv-image');
    const dl = document.getElementById('iv-download');
    
    if (!modal || !img || !dl) return;
    
    img.src = src;
    dl.href = src;
    currentZoom = 1;
    img.style.transform = \`scale(\${currentZoom})\`;
    
    modal.style.display = 'flex';
};

document.addEventListener('DOMContentLoaded', () => {
    const img = document.getElementById('iv-image');
    const zoomInBtn = document.getElementById('iv-zoom-in');
    const zoomOutBtn = document.getElementById('iv-zoom-out');
    const zoomResetBtn = document.getElementById('iv-zoom-reset');
    
    if(img && zoomInBtn && zoomOutBtn && zoomResetBtn) {
        zoomInBtn.addEventListener('click', () => {
            currentZoom += 0.25;
            img.style.transform = \`scale(\${currentZoom})\`;
            img.style.cursor = 'zoom-in';
        });
        
        zoomOutBtn.addEventListener('click', () => {
            if (currentZoom > 0.5) currentZoom -= 0.25;
            img.style.transform = \`scale(\${currentZoom})\`;
            img.style.cursor = 'zoom-out';
        });
        
        zoomResetBtn.addEventListener('click', () => {
            currentZoom = 1;
            img.style.transform = \`scale(\${currentZoom})\`;
            img.style.cursor = 'zoom-in';
        });
        
        img.addEventListener('click', () => {
            currentZoom += 0.5;
            img.style.transform = \`scale(\${currentZoom})\`;
        });
    }
});
`;

if (!code.includes('GLOBAL IMAGE VIEWER LOGIC')) {
    code += '\n' + viewerLogic;
    fs.writeFileSync('public/app.js', code, 'utf8');
    console.log("Added image viewer logic to app.js");
} else {
    console.log("Viewer logic already exists.");
}

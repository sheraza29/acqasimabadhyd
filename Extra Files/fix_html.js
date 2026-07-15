const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

// Update #about-modal
let originalAboutModal = html.match(/<div id="about-modal"[\s\S]*?<\/div>\s*<\/div>/)[0];
let newAboutModal = originalAboutModal.replace(
    '<div class="modal-content" style="max-width:460px; text-align:center; padding:30px 28px;">',
    '<div class="modal-content" style="max-width:460px; text-align:center; padding:30px 28px; max-height:80vh; overflow-y:auto;">'
);
html = html.replace(originalAboutModal, newAboutModal);

// Update #global-nav action buttons container
let originalNav = html.match(/<div id="global-nav"[\s\S]*?<\/div>\s*<\/div>/)[0];
if (!originalNav.includes('action-buttons-container')) {
    let newNav = originalNav.replace(
        '<div style="display:flex; gap:10px; align-items:center;">',
        '<div class="action-buttons-container" style="display:flex; gap:10px; align-items:center;">'
    );
    html = html.replace(originalNav, newNav);
}

// Update #shop-dashboard-modal
let shopModalRegex = /<div id="shop-dashboard-modal" class="modal-overlay">([\s\S]*?)<button id="close-dashboard-btn" class="primary-btn btn-cancel" style="margin-top:15px;">Close<\/button>\s*<\/div>\s*<\/div>/;
let shopModalMatch = html.match(shopModalRegex);
if (shopModalMatch && !shopModalMatch[0].includes('modal-body-scrollable')) {
    let innerContent = shopModalMatch[1];
    
    // Extract Header
    let headerRegex = /<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">[\s\S]*?<\/div>\s*<\/div>/;
    let headerMatch = innerContent.match(headerRegex)[0];
    
    // The rest is body
    let bodyContent = innerContent.replace(headerMatch, '').trim();
    
    let newShopModal = `
    <div id="shop-dashboard-modal" class="modal-overlay">
        <div class="modal-content flex-modal">
            <div class="modal-header-fixed">
                ${headerMatch}
            </div>
            <div class="modal-body-scrollable">
                ${bodyContent}
            </div>
            <div class="modal-footer-fixed">
                <button id="close-dashboard-btn" class="primary-btn btn-cancel" style="width:100%;">Close</button>
            </div>
        </div>
    </div>`;
    
    html = html.replace(shopModalMatch[0], newShopModal);
}

// Update #entity-dashboard-modal
let entityModalRegex = /<div id="entity-dashboard-modal" class="modal-overlay">([\s\S]*?)<div style="margin-top:20px; text-align:right;">\s*<button id="close-entity-dashboard-btn" class="primary-btn btn-cancel" style="width:100%;">Close<\/button>\s*<\/div>\s*<\/div>\s*<\/div>/;
let entityModalMatch = html.match(entityModalRegex);
if (entityModalMatch && !entityModalMatch[0].includes('modal-body-scrollable')) {
    let innerContent = entityModalMatch[1];
    
    // Extract Header
    let headerRegex = /<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">[\s\S]*?<\/div>\s*<\/div>/;
    let headerMatch = innerContent.match(headerRegex)[0];
    
    // The rest is body
    let bodyContent = innerContent.replace(headerMatch, '').trim();
    
    let newEntityModal = `
    <div id="entity-dashboard-modal" class="modal-overlay">
        <div class="modal-content flex-modal">
            <div class="modal-header-fixed">
                ${headerMatch}
            </div>
            <div class="modal-body-scrollable">
                ${bodyContent}
            </div>
            <div class="modal-footer-fixed">
                <button id="close-entity-dashboard-btn" class="primary-btn btn-cancel" style="width:100%;">Close</button>
            </div>
        </div>
    </div>`;
    
    html = html.replace(entityModalMatch[0], newEntityModal);
}

// Check #image-viewer-modal width/height
let imageViewerModalRegex = /<div id="image-viewer-modal"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;
let imageViewerMatch = html.match(imageViewerModalRegex);
if (imageViewerMatch) {
    let newImageViewer = imageViewerMatch[0].replace(
        '<img id="iv-image" src="" style="max-width:100%; max-height:100%; object-fit:contain; transition:transform 0.3s ease; transform-origin:center center; cursor:zoom-in;">',
        '<img id="iv-image" src="" style="max-width:90vw; max-height:80vh; object-fit:contain; transition:transform 0.3s ease; transform-origin:center center; cursor:zoom-in;">'
    );
    html = html.replace(imageViewerMatch[0], newImageViewer);
}

fs.writeFileSync('public/index.html', html, 'utf8');
console.log("Updated HTML structures.");

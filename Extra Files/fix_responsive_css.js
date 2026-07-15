const fs = require('fs');
let code = fs.readFileSync('public/style.css', 'utf8');

// 1. Fixing Modals Global & Domain Modals Structure
let modalFixes = `
/* UI Overhaul CSS */

/* Fix Global Modal Content Scaling */
.modal-content {
    max-height: 80vh !important;
    overflow-y: auto !important;
    width: 95vw !important;
    max-width: 500px !important;
    padding: 20px !important;
    word-wrap: break-word !important;
}

/* Modals with Fixed Headers and Footers (Dashboard Modals) */
.modal-content.flex-modal {
    padding: 0 !important;
    display: flex !important;
    flex-direction: column !important;
    max-height: 85vh !important;
    overflow: hidden !important; /* The outer wrapper shouldn't scroll */
}

.modal-header-fixed {
    padding: 15px 20px;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
    background: #ffffff;
    z-index: 10;
}

.modal-body-scrollable {
    padding: 20px;
    flex-grow: 1;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch;
}

.modal-footer-fixed {
    padding: 15px 20px;
    border-top: 1px solid #e2e8f0;
    flex-shrink: 0;
    background: #ffffff;
    z-index: 10;
}

/* Thumbnails strictly 1:1 */
.shop-dir-photo, .thumbnail-wrapper img, .raid-photo-gallery img {
    aspect-ratio: 1 / 1 !important;
    object-fit: cover !important;
}

/* Fix text overflow globally */
p, h1, h2, h3, h4, span, div {
    word-wrap: break-word;
}
`;

// Replace existing .modal-content
code = code.replace(/\.modal-content\s*\{[\s\S]*?max-height:\s*90vh;\s*overflow-y:\s*auto;\s*\}/g, '');

if (!code.includes('UI Overhaul CSS')) {
    code = code + '\n' + modalFixes;
}

// Update Top Navigation Bar CSS inside media queries
code = code.replace(
    /nav-btn-container \{ flex-wrap: nowrap !important; overflow-x: auto; -webkit-overflow-scrolling: touch; width: 100%; justify-content: flex-start !important; padding-bottom: 2px; \}/g,
    'nav-btn-container { flex-wrap: nowrap !important; overflow-x: auto !important; -webkit-overflow-scrolling: touch; width: 100%; justify-content: flex-start !important; padding-bottom: 2px; }'
);

let navTitleFix = `
/* Top Navigation Adjustments */
#global-nav {
    flex-wrap: nowrap !important;
    overflow: hidden;
}

#global-nav .action-buttons-container {
    display: flex;
    gap: 10px;
    align-items: center;
    overflow-x: auto !important;
    flex-wrap: nowrap !important;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 2px;
}

@media (max-width: 600px) {
    #global-nav h2 {
        font-size: 0.9rem !important;
        white-space: normal;
        word-wrap: break-word;
    }
}
@media (max-width: 480px) {
    #global-nav h2 {
        font-size: 0.8rem !important;
    }
}
`;

if (!code.includes('Top Navigation Adjustments')) {
    code = code + '\n' + navTitleFix;
}

fs.writeFileSync('public/style.css', code, 'utf8');
console.log("Updated style.css");

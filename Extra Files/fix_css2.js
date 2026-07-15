const fs = require('fs');
let code = fs.readFileSync('public/style.css', 'utf8');

const mediaQueries = `
/* =========================================
   RESPONSIVE UI ADJUSTMENTS (MOBILE & TABLET)
========================================= */

@media (max-width: 768px) {
    /* Hide top nav items to prevent overlap */
    #nav-controls {
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
    }
    
    /* Make dashboard cards stack */
    .metric-card {
        min-width: 100% !important;
        flex: 1 1 100% !important;
    }
    
    /* Adjust modal sizes */
    .modal-content {
        width: 95% !important;
        margin: 10px auto;
        padding: 15px !important;
        max-height: 90vh !important;
    }
    
    /* Adjust top search bar width */
    #search-box {
        width: 150px !important;
    }

    /* Adjust map overlay container */
    #map-overlay-container {
        padding: 10px !important;
        flex-direction: column !important;
    }
    
    #map-panel {
        width: 100% !important;
        margin-right: 0 !important;
        margin-bottom: 10px !important;
    }
    
    #domain-nav {
        flex-wrap: nowrap !important;
        overflow-x: auto !important;
    }
}

@media (max-width: 480px) {
    /* Further adjustments for small phones */
    #app-container {
        padding-bottom: 80px; /* Leave space for bottom nav */
    }
    
    /* Resize fonts slightly */
    h1 { font-size: 1.5rem !important; }
    h2 { font-size: 1.2rem !important; }
    
    /* Login screen adjustments */
    .glass-panel {
        padding: 20px !important;
    }
}
`;

if (!code.includes('RESPONSIVE UI ADJUSTMENTS')) {
    code += '\n' + mediaQueries;
    fs.writeFileSync('public/style.css', code, 'utf8');
    console.log("Added responsive CSS");
} else {
    console.log("Responsive CSS already exists");
}

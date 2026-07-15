const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// 1. Add Delete Button in openEntityDashboard (Line ~971)
code = code.replace(
    /(\$\{canEdit \? `<button class="secondary-btn" style="width:auto; padding:5px 10px; font-size:0\.8rem; height:fit-content;" onclick="editInspection\('\$\{window\.currentDomain\}', '\$\{entity\.id\}', '\$\{act\.id\}'\)">✏️ Edit<\/button>` : ''\})/g,
    `$1\n                    \$\{canEdit ? \`<button class="secondary-btn" style="width:auto; padding:5px 10px; font-size:0.8rem; height:fit-content; background:#ef4444; color:white; border:none; margin-left:5px;" onclick="deleteInspection('\$\{window.currentDomain\}', '\$\{entity.id\}', '\$\{act.id\}')">🗑️ Delete</button>\` : ''\}`
);

// 2. Add Delete Button in renderDashboard (Line ~3241)
code = code.replace(
    /(\$\{canEdit \? `<button class="secondary-btn" style="width:auto; padding:5px 10px; font-size:0\.8rem; height:fit-content;" onclick="editInspection\('\$\{window\.currentDomain\}', '\$\{log\.entityId\}', '\$\{log\.id\}'\)">✏️ Edit<\/button>` : ''\})/g,
    `$1\n                    \$\{canEdit ? \`<button class="secondary-btn" style="width:auto; padding:5px 10px; font-size:0.8rem; height:fit-content; background:#ef4444; color:white; border:none; margin-left:5px;" onclick="deleteInspection('\$\{window.currentDomain\}', '\$\{log.entityId\}', '\$\{log.id\}')">🗑️ Delete</button>\` : ''\}`
);

// 3. Inject window.deleteInspection
const deleteFunc = `
window.deleteInspection = async function(domain, entityId, logId) {
    let entities = [];
    let colName = "";
    if (domain === 'wholesale_price') { entities = wholesaleEntities; colName = "wholesale_entities"; }
    else if (domain === 'retail_price') { entities = retailEntities; colName = "retail_entities"; }
    else if (domain === 'fv_price') { entities = fvEntities; colName = "fv_entities"; }
    else if (domain === 'lpg_price') { entities = lpgEntities; colName = "lpg_entities"; }
    else if (domain === 'petrol_check') { entities = petrolEntities; colName = "petrol_entities"; }
    else if (domain === 'anti_hoarding') { entities = hoardingEntities; colName = "anti_hoarding"; }
    
    let entity = entities.find(e => e.id === entityId);
    if (!entity) return;
    
    let actIndex = entity.activities.findIndex(a => a.id === logId);
    if (actIndex === -1) return;
    
    let act = entity.activities[actIndex];
    
    let reason = prompt("Security Check: Please state the reason for deleting this inspection log (min 5 chars):");
    if (!reason || reason.trim().length < 5) {
        return alert("Deletion cancelled. A valid reason is required.");
    }
    
    if (!confirm("Are you sure you want to permanently delete this log?")) return;
    
    // Remove it
    entity.activities.splice(actIndex, 1);
    
    // Log the deletion trail
    if (typeof window.logActivity === 'function') {
        window.logActivity('delete_inspection', window.userProfile ? window.userProfile.name : "Admin", \`deleted an inspection log for '\${entity.name}'\`, null, act, reason);
    }
    
    // Save
    await window.fbSetDoc(window.fbDoc(window.firebaseDB, getCollection(colName), entity.id), entity, { merge: true });
    
    alert("Inspection log deleted successfully.");
    
    // Refresh UIs
    if (window.activeEntity && window.activeEntity.id === entity.id) {
        window.openEntityDashboard(entity.id, domain);
    }
    if (document.getElementById('dashboard-view').style.display === 'block') {
        renderDashboard();
    }
};
`;

// Insert the function before window.editInspection
code = code.replace(/window\.editInspection = function\(domain/g, deleteFunc + '\nwindow.editInspection = function(domain');

fs.writeFileSync('public/app.js', code);
console.log("Delete Inspection implemented");

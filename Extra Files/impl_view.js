const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// ─── 1. Inject the viewInspection function BEFORE deleteInspection ────────────
const viewFunc = `
window.viewInspection = function(domain, entityId, logId) {
    let entities = [];
    if (domain === 'wholesale_price') entities = wholesaleEntities;
    else if (domain === 'retail_price') entities = retailEntities;
    else if (domain === 'fv_price') entities = fvEntities;
    else if (domain === 'lpg_price') entities = lpgEntities;
    else if (domain === 'petrol_check') entities = petrolEntities;
    else if (domain === 'anti_hoarding') entities = hoardingEntities;

    const entity = entities.find(e => e.id === entityId);
    if (!entity) return;
    const act = (entity.activities || []).find(a => a.id === logId);
    if (!act) return;

    // Populate common fields
    const domainLabels = {
        wholesale_price: '🏭 Wholesale Price Check',
        retail_price: '🏪 Retail Price Check',
        fv_price: '🍎 Fruits & Vegetables Inspection',
        lpg_price: '🔥 LPG Price Check',
        petrol_check: '⛽ Petrol Pump Inspection',
        anti_hoarding: '📦 Anti-Hoarding Raid'
    };
    document.getElementById('view-insp-title').textContent = domainLabels[domain] || 'Inspection Log';
    document.getElementById('view-insp-entity').textContent = entity.name || entity.ownerName || '—';
    document.getElementById('view-insp-officer').textContent = act.officer || '—';
    document.getElementById('view-insp-date').textContent = act.timestamp ? new Date(act.timestamp).toLocaleString() : '—';
    document.getElementById('view-insp-fine').textContent = 'Rs ' + (act.fineAmount || 0);

    // Domain-specific fields
    let fieldsHTML = '';
    const row = (label, val) => val ? \`<div style="display:flex; justify-content:space-between; border-bottom:1px solid #e2e8f0; padding-bottom:6px; gap:10px;"><span style="color:#64748b; font-size:0.85rem;">\${label}</span><span style="font-weight:600; color:#0f172a; font-size:0.85rem; text-align:right;">\${val}</span></div>\` : '';

    if (domain === 'wholesale_price') {
        fieldsHTML += row('Commodity', act.commodity);
        fieldsHTML += row('Notified Price', act.notifiedPrice ? 'Rs ' + act.notifiedPrice + '/kg' : null);
        fieldsHTML += row('Found Price', act.foundPrice ? 'Rs ' + act.foundPrice + '/kg' : null);
        fieldsHTML += row('Violation', act.violation === 'yes' ? '⚠️ Yes' : act.violation === 'no' ? '✅ No' : act.violation);
    } else if (domain === 'retail_price') {
        fieldsHTML += row('Category', act.category);
        fieldsHTML += row('Rate List Displayed?', act.ratelist);
        fieldsHTML += row('Violation', act.violation === 'yes' ? '⚠️ Yes' : act.violation === 'no' ? '✅ No' : act.violation);
    } else if (domain === 'fv_price') {
        fieldsHTML += row('Produce Type', act.produce);
        fieldsHTML += row('Govt. Notified Rate', act.notifiedPrice ? 'Rs ' + act.notifiedPrice : null);
        fieldsHTML += row('Rate Found at Entity', act.foundPrice ? 'Rs ' + act.foundPrice : null);
        fieldsHTML += row('Auction Rate Adherence', act.violation === 'compliant' ? '✅ Compliant' : act.violation === 'non_compliant' ? '⚠️ Non-Compliant' : act.violation);
    } else if (domain === 'lpg_price') {
        fieldsHTML += row('Violation', act.violation);
    } else if (domain === 'petrol_check') {
        fieldsHTML += row('Violation', act.violation);
    } else if (domain === 'anti_hoarding') {
        fieldsHTML += row('FIR Details', act.firDetails);
        fieldsHTML += row('Packets Seized', act.packets);
    }

    if (act.notes) fieldsHTML += row('Notes', act.notes);
    document.getElementById('view-insp-fields').innerHTML = fieldsHTML || '<p style="color:#94a3b8; font-size:0.85rem;">No additional details recorded.</p>';

    // Status badges
    let statusHTML = '';
    if (act.isSealed) {
        statusHTML += \`<span style="background:#fef2f2; border:1px solid #fca5a5; color:#b91c1c; border-radius:20px; padding:4px 12px; font-size:0.8rem; font-weight:700;">🔒 Sealed</span>\`;
    } else if (act.sealingAction && act.sealingAction !== 'none') {
        statusHTML += \`<span style="background:#fef9c3; border:1px solid #fde047; color:#854d0e; border-radius:20px; padding:4px 12px; font-size:0.8rem; font-weight:700;">⚠️ \${act.sealingAction}</span>\`;
    } else {
        statusHTML += \`<span style="background:#f0fdf4; border:1px solid #86efac; color:#15803d; border-radius:20px; padding:4px 12px; font-size:0.8rem; font-weight:700;">✅ No Sealing</span>\`;
    }
    document.getElementById('view-insp-status-row').innerHTML = statusHTML;

    // De-seal section
    const desealSection = document.getElementById('view-insp-deseal-section');
    if (act.desealedAt) {
        document.getElementById('view-insp-deseal-time').textContent = act.desealedAt;
        document.getElementById('view-insp-deseal-reason').textContent = act.desealReason || '—';
        desealSection.style.display = 'block';
    } else {
        desealSection.style.display = 'none';
    }

    // Photo
    const photoCont = document.getElementById('view-insp-photo-container');
    if (act.photo) {
        document.getElementById('view-insp-photo').src = act.photo;
        photoCont.style.display = 'block';
    } else {
        photoCont.style.display = 'none';
    }

    document.getElementById('view-inspection-modal').style.display = 'flex';
};
`;

code = code.replace(/window\.deleteInspection = async function/, viewFunc + '\nwindow.deleteInspection = async function');

// ─── 2. Inject View button in openEntityDashboard activity list ──────────────
// The view button goes BEFORE the edit button in the entity profile
code = code.replace(
    /(\$\{canEdit \? `<button class="secondary-btn" style="width:auto; padding:5px 10px; font-size:0\.8rem; height:fit-content;" onclick="editInspection\('\$\{window\.currentDomain\}', '\$\{entity\.id\}', '\$\{act\.id\}'\)">)/g,
    `\${'<button class="secondary-btn" style="width:auto; padding:5px 10px; font-size:0.8rem; height:fit-content; background:#1c5629; color:white; border:none; margin-bottom:4px;" onclick="viewInspection(\\'' + window.currentDomain + '\\', \\'' + entity.id + '\\', \\'' + act.id + '\\')">👁️ View</button>'}\n                    $1`
);

// ─── 3. Inject View button in renderDashboard timeline ───────────────────────
code = code.replace(
    /(\$\{canEdit \? `<button class="secondary-btn" style="width:auto; padding:5px 10px; font-size:0\.8rem; height:fit-content;" onclick="editInspection\('\$\{window\.currentDomain\}', '\$\{log\.entityId\}', '\$\{log\.id\}'\)">)/g,
    `\${'<button class="secondary-btn" style="width:auto; padding:5px 10px; font-size:0.8rem; height:fit-content; background:#1c5629; color:white; border:none; margin-bottom:4px;" onclick="viewInspection(\\'' + window.currentDomain + '\\', \\'' + log.entityId + '\\', \\'' + log.id + '\\')">👁️ View</button>'}\n                    $1`
);

fs.writeFileSync('public/app.js', code);
console.log('viewInspection injected successfully');

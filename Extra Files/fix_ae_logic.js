const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// 1. Clear AE inputs on open
code = code.replace(
    "document.getElementById('anti-encroachment-modal').style.display = 'flex';",
    "document.getElementById('ae-location').value = '';\n        document.getElementById('ae-reclaimed-size').value = '';\n        document.getElementById('ae-value-pkr').value = '';\n        if(document.getElementById('ae-reason')) document.getElementById('ae-reason').value = 'Court Order';\n        if(document.getElementById('ae-reason-other-group')) document.getElementById('ae-reason-other-group').style.display = 'none';\n        if(document.getElementById('ae-reason-other')) document.getElementById('ae-reason-other').value = '';\n        window.photoCache['ae-photo-before'] = null;\n        window.photoCache['ae-photo-after'] = null;\n        document.getElementById('anti-encroachment-modal').style.display = 'flex';"
);

// 2. Change marker popup to click listener
code = code.replace(
    /marker\.bindPopup\(`<b>\$\{log\.targetName \|\| 'Unknown'\}<\/b><br>Reclaimed: \n\$\{log\.reclaimedSize \|\| ''\}`\);/g,
    "marker.on('click', () => { if(typeof openAELogDetails === 'function') openAELogDetails(log); else alert('Details viewer not ready.'); });"
);

// Fallback regex if newlines don't match:
code = code.replace(
    /marker\.bindPopup\(`<b>\$\{log\.targetName \|\| 'Unknown'\}<\/b><br>Reclaimed: \$\{log\.reclaimedSize \|\| ''\}`\);/g,
    "marker.on('click', () => { if(typeof openAELogDetails === 'function') openAELogDetails(log); else alert('Details viewer not ready.'); });"
);

// 3. Update saving logic
let originalSave = `
document.getElementById('save-ae-btn').addEventListener('click', async () => {
    const loc = document.getElementById('ae-location').value.trim();
    const size = document.getElementById('ae-reclaimed-size').value;
    const val = document.getElementById('ae-value-pkr').value;
    if (!loc) return alert("Location is required.");

    document.getElementById('status-msg').innerHTML = "⏳ Saving...";
    const logId = generateId();
    let doc = {
        id: logId, lat: currentLat, lng: currentLng, targetName: loc, reclaimedSize: size, valuePKR: val,
        officer: userProfile ? userProfile.name : "Unknown", timestamp: Date.now()
    };
    if (window.photoCache['ae-photo-before']) doc.photoBefore = window.photoCache['ae-photo-before'];
    if (window.photoCache['ae-photo-after']) doc.photoAfter = window.photoCache['ae-photo-after'];
    encroachmentLogs.push(doc);
    await window.fbSetDoc(window.fbDoc(window.firebaseDB, getCollection('anti_encroachment_logs'), logId), doc);
    document.getElementById('status-msg').innerHTML = "✅ Saved";
    document.getElementById('anti-encroachment-modal').style.display = 'none';
    window.photoCache['ae-photo-before'] = null;
    window.photoCache['ae-photo-after'] = null;
    if (typeof renderShops === 'function') renderShops();
});
`;

let newSave = `
let editingAELogId = null;
document.getElementById('save-ae-btn').addEventListener('click', async () => {
    const loc = document.getElementById('ae-location').value.trim();
    const size = document.getElementById('ae-reclaimed-size').value;
    const val = document.getElementById('ae-value-pkr').value;
    const reasonEl = document.getElementById('ae-reason');
    const reasonOtherEl = document.getElementById('ae-reason-other');
    const reason = reasonEl ? reasonEl.value : '';
    const reasonOther = (reason === 'Other' && reasonOtherEl) ? reasonOtherEl.value : '';
    const finalReason = reason === 'Other' ? reasonOther : reason;
    
    if (!loc) return alert("Location is required.");
    
    let editReason = null;
    if (editingAELogId) {
        editReason = prompt("Security Check: Please type the reason why you are amending this encroachment log (min 5 characters):");
        if (!editReason || editReason.trim().length < 5) return alert("Amendment cancelled: Valid reason required.");
    }

    document.getElementById('status-msg').innerHTML = "⏳ Saving...";
    const logId = editingAELogId || generateId();
    
    let doc = {
        id: logId, targetName: loc, reclaimedSize: size, valuePKR: val, reason: finalReason,
        officer: userProfile ? userProfile.name : "Unknown", timestamp: Date.now()
    };
    if (!editingAELogId) {
        doc.lat = currentLat; doc.lng = currentLng;
    } else {
        const existing = encroachmentLogs.find(l => l.id === logId);
        if (existing) {
            doc.lat = existing.lat; doc.lng = existing.lng; doc.timestamp = existing.timestamp; // preserve coords and time
            if (typeof window.logActivity === 'function') window.logActivity('edit_inspection', window.userProfile ? window.userProfile.name : "Admin", \`edited Anti-Encroachment log '\${loc}'\`, null, existing, editReason);
        }
    }
    
    if (window.photoCache['ae-photo-before']) doc.photoBefore = window.photoCache['ae-photo-before'];
    if (window.photoCache['ae-photo-after']) doc.photoAfter = window.photoCache['ae-photo-after'];
    
    if (editingAELogId) {
        const idx = encroachmentLogs.findIndex(l => l.id === logId);
        if (idx > -1) encroachmentLogs[idx] = Object.assign({}, encroachmentLogs[idx], doc);
    } else {
        encroachmentLogs.push(doc);
    }
    
    await window.fbSetDoc(window.fbDoc(window.firebaseDB, getCollection('anti_encroachment_logs'), logId), doc, {merge:true});
    document.getElementById('status-msg').innerHTML = "✅ Saved";
    document.getElementById('anti-encroachment-modal').style.display = 'none';
    window.photoCache['ae-photo-before'] = null;
    window.photoCache['ae-photo-after'] = null;
    editingAELogId = null;
    if (typeof renderShops === 'function') renderShops();
});

window.openAELogDetails = function(log) {
    // Generate an ad-hoc modal for details
    let modalHTML = \`
    <div id="temp-ae-modal" class="modal-overlay" style="display:flex; z-index:9999;">
        <div class="modal-content">
            <h2 style="color:#dc2626;">Encroachment Details</h2>
            <p><b>Location:</b> \${log.targetName}</p>
            <p><b>Size:</b> \${log.reclaimedSize || '-'}</p>
            <p><b>Value:</b> \${log.valuePKR || '-'} Million PKR</p>
            <p><b>Reason:</b> \${log.reason || '-'}</p>
            <div style="display:flex; gap:10px; margin-top:15px; margin-bottom:15px;">
                \${log.photoBefore ? \`<img src="\${log.photoBefore}" style="width:50%; height:100px; object-fit:cover; border-radius:8px; cursor:pointer;" onclick="if(window.openImageViewer) window.openImageViewer('\${log.photoBefore}')">\` : ''}
                \${log.photoAfter ? \`<img src="\${log.photoAfter}" style="width:50%; height:100px; object-fit:cover; border-radius:8px; cursor:pointer;" onclick="if(window.openImageViewer) window.openImageViewer('\${log.photoAfter}')">\` : ''}
            </div>
            <div class="btn-group">
                <button class="primary-btn btn-cancel" onclick="document.getElementById('temp-ae-modal').remove()">Close</button>
                <button class="primary-btn" style="background:#f59e0b;" onclick="window.editAELog('\${log.id}'); document.getElementById('temp-ae-modal').remove()">Edit</button>
                <button class="primary-btn" style="background:#ef4444;" onclick="window.deleteAELog('\${log.id}'); document.getElementById('temp-ae-modal').remove()">Delete</button>
            </div>
        </div>
    </div>\`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.editAELog = function(id) {
    const log = encroachmentLogs.find(l => l.id === id);
    if (!log) return;
    editingAELogId = id;
    document.getElementById('ae-location').value = log.targetName || '';
    document.getElementById('ae-reclaimed-size').value = log.reclaimedSize || '';
    document.getElementById('ae-value-pkr').value = log.valuePKR || '';
    if(document.getElementById('ae-reason')) {
        let r = log.reason || 'Court Order';
        let isOther = !['Court Order', 'Orders of DC Hyderabad', 'Orders of Commissioner Hyderabad', 'Encroachment Report by Office'].includes(r);
        if (isOther) {
            document.getElementById('ae-reason').value = 'Other';
            document.getElementById('ae-reason-other').value = r;
            document.getElementById('ae-reason-other-group').style.display = 'block';
        } else {
            document.getElementById('ae-reason').value = r;
            document.getElementById('ae-reason-other-group').style.display = 'none';
        }
    }
    document.getElementById('anti-encroachment-modal').style.display = 'flex';
};

window.deleteAELog = async function(id) {
    const log = encroachmentLogs.find(l => l.id === id);
    if (!log) return;
    let delReason = prompt("Security Check: Please type the reason why you are deleting this encroachment log (min 5 characters):");
    if (!delReason || delReason.trim().length < 5) return alert("Deletion cancelled: Valid reason required.");
    
    if (confirm("Are you sure you want to delete this log permanently?")) {
        if (typeof window.logActivity === 'function') window.logActivity('delete_inspection', window.userProfile ? window.userProfile.name : "Admin", \`deleted Anti-Encroachment log '\${log.targetName}'\`, null, log, delReason);
        await window.fbDeleteDoc(window.fbDoc(window.firebaseDB, getCollection('anti_encroachment_logs'), id));
        encroachmentLogs = encroachmentLogs.filter(l => l.id !== id);
        if (typeof renderShops === 'function') renderShops();
    }
};
`;

code = code.replace(
    /document\.getElementById\('save-ae-btn'\)\.addEventListener\('click', async \(\) => \{[\s\S]*?if \(typeof renderShops === 'function'\) renderShops\(\);\n\}\);/m,
    newSave
);

fs.writeFileSync('public/app.js', code, 'utf8');
console.log("Updated AE Logic");

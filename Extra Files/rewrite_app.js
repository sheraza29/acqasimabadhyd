const fs = require('fs');
let appJs = fs.readFileSync('public/app.js', 'utf8');

const startMarker = "document.querySelectorAll('.export-btn').forEach(btn => {";
const endMarker = `    } catch (error) {\n        console.error("Excel Export Error:", error);\n        alert("An error occurred while generating the Excel file. Please try again.");\n    }\n});`;

const startIndex = appJs.indexOf(startMarker);
if (startIndex === -1) {
    console.error("Start marker not found");
    process.exit(1);
}

let endIndex = appJs.indexOf(endMarker, startIndex);
if (endIndex === -1) {
    const altEndMarker = endMarker.replace(/\n/g, '\r\n');
    endIndex = appJs.indexOf(altEndMarker, startIndex);
    if (endIndex === -1) {
        console.error("End marker not found");
        process.exit(1);
    }
    endIndex += altEndMarker.length;
} else {
    endIndex += endMarker.length;
}

const newLogic = `
document.querySelectorAll('.export-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        if (!window.currentDomain || window.currentDomain === 'tobacco_enforcement') {
            if (shops.length === 0) return alert("No shop data available to export.");
            let hasData = false;
            shops.forEach(s => { if(s.raids && s.raids.length > 0) hasData = true; });
            if (!hasData) return alert("You have added shops, but no raids have been logged yet to export.");
        } else if (window.currentDomain === 'wholesale_price') {
            if (wholesaleEntities.length === 0) return alert("No wholesale data available to export.");
            let hasData = false;
            wholesaleEntities.forEach(s => { if(s.activities && s.activities.length > 0) hasData = true; });
            if (!hasData) return alert("You have added wholesale entities, but no inspections have been logged yet to export.");
        } else {
            return alert("Reporting is not yet supported for this domain.");
        }

        // Clear previous inputs
        document.getElementById('export-from-date').value = "";
        document.getElementById('export-to-date').value = "";
        
        exportModal.style.display = "flex";
    });
});

document.getElementById('confirm-export-btn').addEventListener('click', async function() {
    exportModal.style.display = "none";

    const fromDateStr = document.getElementById('export-from-date').value;
    const toDateStr = document.getElementById('export-to-date').value;

    let fromTimestamp = null;
    let toTimestamp = null;

    if (fromDateStr) fromTimestamp = new Date(fromDateStr).getTime();
    if (toDateStr) {
        toTimestamp = new Date(toDateStr + 'T23:59:59').getTime();
    }

    if (!window.currentDomain || window.currentDomain === 'tobacco_enforcement') {
        await generateTobaccoReport(fromTimestamp, toTimestamp, fromDateStr, toDateStr);
    } else if (window.currentDomain === 'wholesale_price') {
        await generateWholesaleReport(fromTimestamp, toTimestamp, fromDateStr, toDateStr);
    }
});

// Helper to stitch multiple photos horizontally to avoid Excel coordinate bugs
const stitchImagesHorizontally = async (base64Array) => {
    if (!base64Array || base64Array.length === 0) return null;
    if (base64Array.length === 1) return base64Array[0];

    return new Promise((resolve) => {
        const images = [];
        let loadedCount = 0;
        base64Array.forEach((b64, i) => {
            const img = new Image();
            img.onload = () => {
                images[i] = img;
                loadedCount++;
                if (loadedCount === base64Array.length) {
                    const canvas = document.createElement('canvas');
                    const w = 80, h = 80, gap = 5;
                    canvas.width = (w * images.length) + (gap * (images.length - 1));
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    images.forEach((loadedImg, idx) => {
                        ctx.drawImage(loadedImg, idx * (w + gap), 0, w, h);
                    });
                    resolve(canvas.toDataURL('image/jpeg', 0.6));
                }
            };
            img.src = b64;
        });
    });
};

const getMonogramBase64 = () => {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            canvas.getContext('2d').drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png').split(',')[1]);
        };
        img.onerror = () => resolve(null);
        img.src = 'sindh_monogram.webp';
    });
};

async function generateTobaccoReport(fromTimestamp, toTimestamp, fromDateStr, toDateStr) {
    let allRaids = [];
    shops.forEach(shop => {
        if (shop.deleted) return;
        (shop.raids || []).forEach(raid => {
            const [day, month, year] = raid.date.split('/');
            const raidTimestamp = new Date(\`\${year}-\${month}-\${day}T\${raid.time}\`).getTime();
            
            let include = true;
            if (fromTimestamp && raidTimestamp < fromTimestamp) include = false;
            if (toTimestamp && raidTimestamp > toTimestamp) include = false;

            if (include) {
                allRaids.push({ 
                    ...raid, 
                    shopName: shop.name, 
                    owner: shop.owner, 
                    ownerPhone: shop.ownerPhone,
                    shopkeeperName: shop.shopkeeperName,
                    shopkeeperPhone: shop.shopkeeperPhone,
                    lat: shop.lat, 
                    lng: shop.lng, 
                    shopPhoto: shop.photo 
                });
            }
        });
    });

    allRaids.sort((a, b) => {
        const dateA = a.date.split('/').reverse().join('-');
        const dateB = b.date.split('/').reverse().join('-');
        return new Date(dateA + 'T' + a.time) - new Date(dateB + 'T' + b.time);
    });

    let reportStartDateStr = "N/A";
    let reportEndDateStr = "N/A";
    let diffDays = 1;

    if (allRaids.length > 0) {
        reportStartDateStr = fromDateStr ? new Date(fromDateStr).toLocaleDateString('en-GB') : allRaids[0].date;
        reportEndDateStr = toDateStr ? new Date(toDateStr).toLocaleDateString('en-GB') : allRaids[allRaids.length - 1].date;
        
        const [sDay, sMonth, sYear] = reportStartDateStr.split('/');
        const [eDay, eMonth, eYear] = reportEndDateStr.split('/');
        const d1 = new Date(\`\${sYear}-\${sMonth}-\${sDay}\`);
        const d2 = new Date(\`\${eYear}-\${eMonth}-\${eDay}\`);
        diffDays = Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
    }

    let daysString = diffDays === 1 ? "1 Day" : \`\${diffDays} Days\`;

    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Official Raid Report');

        worksheet.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 };

        worksheet.columns = [
            { key: 'officer', width: 28 },
            { key: 'date', width: 16 },
            { key: 'time', width: 14 },
            { key: 'packets', width: 22 },
            { key: 'location', width: 48 },
            { key: 'shop_image', width: 16 },
            { key: 'evidence', width: 48 }
        ];

        const titleRow = worksheet.addRow([]);
        worksheet.mergeCells('A1:G1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = {
            richText: [
                { text: \`Illegal Tobacco Confiscation Report (\${reportStartDateStr} - \${reportEndDateStr}) - \${daysString}\\n\`, font: { name: 'Instrument Serif', size: 20, bold: true } },
                { text: 'Assistant Commissioner Qasimabad, District Hyderabad', font: { name: 'Instrument Serif', size: 16, bold: false } }
            ]
        };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        titleRow.height = 85;

        const monoBase64 = await getMonogramBase64();
        if (monoBase64) {
            const monoId = workbook.addImage({ base64: monoBase64, extension: 'png' });
            worksheet.addImage(monoId, { tl: { col: 0.2, row: 0.2 }, ext: { width: 75, height: 75 } });
        }

        const headerRow = worksheet.addRow({
            officer: 'Name and Designation of authorized officer',
            date: 'Date of seizure',
            time: 'Time of seizure',
            packets: 'No. of packets of cigarettes seized',
            location: 'Location of the Retail outlet/warehouse/road where seizure was made',
            shop_image: 'Shop Profile Photo',
            evidence: 'Photographic Evidence (Seized Goods)'
        });
        
        headerRow.font = { name: 'Instrument Serif', bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        headerRow.height = 55;

        let exportedRowsCount = 0;
        let currentRowIndex = 3; 

        for (const r of allRaids) {
            exportedRowsCount++;
            let safeLat = "0.00000"; let safeLng = "0.00000";
            try { safeLat = Number(r.lat).toFixed(5); safeLng = Number(r.lng).toFixed(5); } catch(e) {}

            const row = worksheet.addRow({
                officer: \`\${r.officer}\\n(\${r.designation})\`,
                date: r.date,
                time: r.time,
                packets: r.packets,
                location: \`Shop Name: \${r.shopName}\\nLocation: \${safeLat}, \${safeLng}\\nOwner: \${r.owner || 'N/A'}\\nContact of Owner: \${r.ownerPhone || 'N/A'}\\nShopkeeper: \${r.shopkeeperName || 'N/A'}\\nContact of Shopkeeper: \${r.shopkeeperPhone || 'N/A'}\`,
                shop_image: '',
                evidence: ''
            });

            row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            row.height = 90; 

            if (r.shopPhoto && r.shopPhoto.includes('base64,')) {
                try {
                    const base64Data = r.shopPhoto.split(',')[1];
                    const imageId = workbook.addImage({ base64: base64Data, extension: 'jpeg' });
                    worksheet.addImage(imageId, { tl: { col: 5, row: currentRowIndex - 1 }, ext: { width: 80, height: 80 }, editAs: 'oneCell' });
                } catch(e) { console.error("Error adding shop image", e); }
            }

            if (r.photos && r.photos.length > 0) {
                try {
                    const stitchedB64 = await stitchImagesHorizontally(r.photos);
                    if (stitchedB64) {
                        const base64Data = stitchedB64.split(',')[1];
                        const imageId = workbook.addImage({ base64: base64Data, extension: 'jpeg' });
                        const totalWidth = (r.photos.length * 80) + ((r.photos.length - 1) * 5);
                        worksheet.addImage(imageId, { tl: { col: 6, row: currentRowIndex - 1 }, ext: { width: totalWidth, height: 80 }, editAs: 'oneCell' });
                    }
                } catch(e) { console.error("Error adding seizure image", e); }
            }

            row.eachCell((cell, colNumber) => {
                cell.font = Object.assign(cell.font || {}, { name: 'Instrument Sans', size: 12 });
                cell.border = {
                    top: {style:'thin', color: {argb:'FFCBD5E1'}}, left: {style:'thin', color: {argb:'FFCBD5E1'}},
                    bottom: {style:'thin', color: {argb:'FFCBD5E1'}}, right: {style:'thin', color: {argb:'FFCBD5E1'}}
                };
                const isEven = row.number % 2 === 0;
                if (colNumber !== 4) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF8FAFC' : 'FFFFFFFF' } };
            });

            const pkts = parseInt(r.packets) || 0;
            const packetsCell = row.getCell('packets');
            packetsCell.font = { name: 'Instrument Sans', bold: true, size: 12 };
            if (pkts >= 100) {
                packetsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
                packetsCell.font = { name: 'Instrument Sans', bold: true, color: { argb: 'FF0F172A' } };
            } else if (pkts > 0) {
                packetsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                packetsCell.font = { name: 'Instrument Sans', bold: true, color: { argb: 'FF334155' } };
            } else {
                packetsCell.font = { name: 'Instrument Sans', color: { argb: 'FF64748B' } };
            }

            currentRowIndex++;
        }

        if (exportedRowsCount === 0) return alert("No raids found for the selected date range.");

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        let filename = \`FBR_Seizure_Report_\${new Date().toISOString().slice(0,10)}\`;
        if (fromDateStr && toDateStr) filename += \`_(\${fromDateStr}_to_\${toDateStr})\`;
        filename += '.xlsx';

        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
    } catch (error) {
        console.error("Excel Export Error:", error);
        alert("An error occurred while generating the Excel file.");
    }
}

async function generateWholesaleReport(fromTimestamp, toTimestamp, fromDateStr, toDateStr) {
    let allActs = [];
    wholesaleEntities.forEach(entity => {
        if (entity.deleted) return;
        (entity.activities || []).forEach(act => {
            let include = true;
            if (fromTimestamp && act.timestamp < fromTimestamp) include = false;
            if (toTimestamp && act.timestamp > toTimestamp) include = false;

            if (include) {
                allActs.push({ 
                    ...act, 
                    entityName: entity.name, 
                    entityOwner: entity.owner, 
                    entityPhone: entity.phone,
                    entityLicense: entity.license,
                    entityLat: entity.lat, 
                    entityLng: entity.lng, 
                    entityPhoto: entity.photo 
                });
            }
        });
    });

    allActs.sort((a, b) => a.timestamp - b.timestamp);

    let reportStartDateStr = "N/A";
    let reportEndDateStr = "N/A";
    let diffDays = 1;

    if (allActs.length > 0) {
        reportStartDateStr = fromDateStr ? new Date(fromDateStr).toLocaleDateString('en-GB') : new Date(allActs[0].timestamp).toLocaleDateString('en-GB');
        reportEndDateStr = toDateStr ? new Date(toDateStr).toLocaleDateString('en-GB') : new Date(allActs[allActs.length - 1].timestamp).toLocaleDateString('en-GB');
        
        const [sDay, sMonth, sYear] = reportStartDateStr.split('/');
        const [eDay, eMonth, eYear] = reportEndDateStr.split('/');
        const d1 = new Date(\`\${sYear}-\${sMonth}-\${sDay}\`);
        const d2 = new Date(\`\${eYear}-\${eMonth}-\${eDay}\`);
        diffDays = Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
    }

    let daysString = diffDays === 1 ? "1 Day" : \`\${diffDays} Days\`;

    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Wholesale Checking Report');

        worksheet.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 };

        worksheet.columns = [
            { key: 'officer', width: 28 },
            { key: 'datetime', width: 20 },
            { key: 'entity_info', width: 48 },
            { key: 'commodity', width: 30 },
            { key: 'pricing', width: 20 },
            { key: 'action', width: 30 },
            { key: 'entity_image', width: 16 },
            { key: 'evidence_image', width: 16 }
        ];

        const titleRow = worksheet.addRow([]);
        worksheet.mergeCells('A1:H1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = {
            richText: [
                { text: \`Wholesale Price Checking Report (\${reportStartDateStr} - \${reportEndDateStr}) - \${daysString}\\n\`, font: { name: 'Instrument Serif', size: 20, bold: true } },
                { text: 'Assistant Commissioner Qasimabad, District Hyderabad', font: { name: 'Instrument Serif', size: 16, bold: false } }
            ]
        };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        titleRow.height = 85;

        const monoBase64 = await getMonogramBase64();
        if (monoBase64) {
            const monoId = workbook.addImage({ base64: monoBase64, extension: 'png' });
            worksheet.addImage(monoId, { tl: { col: 0.2, row: 0.2 }, ext: { width: 75, height: 75 } });
        }

        const headerRow = worksheet.addRow({
            officer: 'Authorized Officer',
            datetime: 'Date & Time',
            entity_info: 'Entity Details (Name, Contact, Location)',
            commodity: 'Commodity',
            pricing: 'Notified vs Found Price (Rs)',
            action: 'Enforcement Action / Fine',
            entity_image: 'Profile Photo',
            evidence_image: 'Inspection Evidence'
        });
        
        headerRow.font = { name: 'Instrument Serif', bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        headerRow.height = 55;

        let exportedRowsCount = 0;
        let currentRowIndex = 3; 

        for (const act of allActs) {
            exportedRowsCount++;
            let safeLat = "0.00000"; let safeLng = "0.00000";
            try { safeLat = Number(act.entityLat).toFixed(5); safeLng = Number(act.entityLng).toFixed(5); } catch(e) {}

            const actionDesc = \`Violation: \${act.violation || 'None'}\\nFine: Rs \${act.fineAmount || 0}\\nSealed: \${act.sealingAction === 'yes' ? 'Yes' : 'No'}\`;

            const row = worksheet.addRow({
                officer: \`\${act.officer}\`,
                datetime: \`\${new Date(act.timestamp).toLocaleDateString()}\\n\${new Date(act.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}\`,
                entity_info: \`Name: \${act.entityName}\\nLocation: \${safeLat}, \${safeLng}\\nOwner: \${act.entityOwner || 'N/A'}\\nContact: \${act.entityPhone || 'N/A'}\\nLicense: \${act.entityLicense || 'N/A'}\`,
                commodity: act.commodity || 'N/A',
                pricing: \`Notified: \${act.notifiedPrice || '-'}\\nFound: \${act.foundPrice || '-'}\`,
                action: actionDesc,
                entity_image: '',
                evidence_image: ''
            });

            row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            row.height = 90; 

            if (act.entityPhoto && act.entityPhoto.includes('base64,')) {
                try {
                    const base64Data = act.entityPhoto.split(',')[1];
                    const imageId = workbook.addImage({ base64: base64Data, extension: 'jpeg' });
                    worksheet.addImage(imageId, { tl: { col: 6, row: currentRowIndex - 1 }, ext: { width: 80, height: 80 }, editAs: 'oneCell' });
                } catch(e) { console.error("Error adding entity image", e); }
            }

            if (act.photo && act.photo.includes('base64,')) {
                try {
                    const base64Data = act.photo.split(',')[1];
                    const imageId = workbook.addImage({ base64: base64Data, extension: 'jpeg' });
                    worksheet.addImage(imageId, { tl: { col: 7, row: currentRowIndex - 1 }, ext: { width: 80, height: 80 }, editAs: 'oneCell' });
                } catch(e) { console.error("Error adding inspection evidence", e); }
            }

            row.eachCell((cell, colNumber) => {
                cell.font = Object.assign(cell.font || {}, { name: 'Instrument Sans', size: 12 });
                cell.border = {
                    top: {style:'thin', color: {argb:'FFCBD5E1'}}, left: {style:'thin', color: {argb:'FFCBD5E1'}},
                    bottom: {style:'thin', color: {argb:'FFCBD5E1'}}, right: {style:'thin', color: {argb:'FFCBD5E1'}}
                };
                const isEven = row.number % 2 === 0;
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF8FAFC' : 'FFFFFFFF' } };
            });

            // Highlight Violations
            const actionCell = row.getCell('action');
            if (act.sealingAction === 'yes' || parseInt(act.fineAmount) > 0) {
                actionCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } }; // Light Red for enforcement actions
                actionCell.font = { name: 'Instrument Sans', bold: true, color: { argb: 'FFBE123C' } }; // Dark red font
            }

            currentRowIndex++;
        }

        if (exportedRowsCount === 0) return alert("No activities found for the selected date range.");

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        let filename = \`Wholesale_Report_\${new Date().toISOString().slice(0,10)}\`;
        if (fromDateStr && toDateStr) filename += \`_(\${fromDateStr}_to_\${toDateStr})\`;
        filename += '.xlsx';

        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
    } catch (error) {
        console.error("Excel Export Error:", error);
        alert("An error occurred while generating the Wholesale Excel file.");
    }
}
`;

appJs = appJs.replace(appJs.substring(startIndex, endIndex), newLogic);
fs.writeFileSync('public/app.js', appJs);
console.log("Successfully replaced export logic.");

const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// 1. Fix auth container logic
code = code.replace(
    /userProfile = null;\s*document\.getElementById\('app-container'\)\.style\.display = 'none';\s*document\.getElementById\('auth-container'\)\.style\.display = 'flex';/g,
    `userProfile = null;
            document.getElementById('app-loading-screen').style.display = 'none';
            document.getElementById('app-container').style.display = 'none';
            document.getElementById('auth-container').style.display = 'flex';`
);

code = code.replace(
    /function proceedToApp\(\) \{\s*if \(!userProfile\) return;\s*document\.getElementById\('sync-status-container'\)\.style\.display = 'flex';/g,
    `function proceedToApp() {
        if (!userProfile) return;
        document.getElementById('app-loading-screen').style.display = 'none';
        document.getElementById('sync-status-container').style.display = 'flex';`
);

// 2. Fix Locate Me / Geofence
const locateLogicOld = `            if (userMarker) {
                if (!userManuallyMoved) {
                    userMarker.setLatLng([currentLat, currentLng]);
                }
                userCircle.setLatLng([trueLat, trueLng]);
                userCircle.setRadius(acc);
            } else {
                userMarker = L.marker([currentLat, currentLng], { draggable: true, title: "Drag to adjust exact shop location" }).addTo(map);
                userMarker.bindPopup("You are here. Drag pin to adjust manually.").openPopup();
                
                userMarker.on('drag', function() {
                    userManuallyMoved = true;
                    const pos = userMarker.getLatLng();
                    currentLat = pos.lat;
                    currentLng = pos.lng;
                });

                userCircle = L.circle([currentLat, currentLng], { radius: acc }).addTo(map);
                map.setView([currentLat, currentLng], 18); // Zoom in close to shop level
            }`;

const locateLogicNew = `            window.lastTrueLat = trueLat;
            window.lastTrueLng = trueLng;

            if (userMarker) {
                if (!userManuallyMoved) {
                    userMarker.setLatLng([currentLat, currentLng]);
                    map.setView([currentLat, currentLng], 18);
                }
                userCircle.setLatLng([trueLat, trueLng]);
                userCircle.setRadius(500); // 500m geofence
            } else {
                userMarker = L.marker([currentLat, currentLng], { draggable: true, title: "Drag to adjust exact shop location" }).addTo(map);
                userMarker.bindPopup("You are here. Drag pin to adjust manually.").openPopup();
                
                userMarker.on('dragend', function() {
                    userManuallyMoved = true;
                    const pos = userMarker.getLatLng();
                    const dist = map.distance(pos, [window.lastTrueLat, window.lastTrueLng]);
                    
                    if (dist > 500) {
                        alert("SECURITY ALERT: You cannot place the inspection marker more than 500 meters away from your actual GPS location.");
                        userMarker.setLatLng([window.lastTrueLat, window.lastTrueLng]);
                        currentLat = window.lastTrueLat;
                        currentLng = window.lastTrueLng;
                    } else {
                        currentLat = pos.lat;
                        currentLng = pos.lng;
                    }
                });

                userCircle = L.circle([currentLat, currentLng], { radius: 500 }).addTo(map);
                map.setView([currentLat, currentLng], 18); // Zoom in close to shop level
            }`;
code = code.replace(locateLogicOld, locateLogicNew);

// 3. Fix Activity Feed domain filtering
const feedLogicOld = `    domainSections.forEach(section => {
        let sectionLogs = amendments.filter(log => {
            let logDomain = log.domain;`;
            
const feedLogicNew = `    domainSections.forEach(section => {
        if (window.currentDomain && section.key !== window.currentDomain) return; // Filter by active domain
        
        let sectionLogs = amendments.filter(log => {
            let logDomain = log.domain;`;

code = code.replace(feedLogicOld, feedLogicNew);

fs.writeFileSync('public/app.js', code, 'utf8');
console.log("Successfully patched app.js");

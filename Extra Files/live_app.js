// --- NATIVE PWA INSTALLATION ENGINE ---
window.photoCache = {};
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const pwaBanner = document.getElementById('pwa-install-banner');
    if(pwaBanner) pwaBanner.style.display = 'block';
});

document.addEventListener('DOMContentLoaded', () => {
    const pwaInstallBtn = document.getElementById('pwa-install-btn');
    const pwaDismissBtn = document.getElementById('pwa-dismiss-btn');
    const pwaBanner = document.getElementById('pwa-install-banner');

    if(pwaInstallBtn) {
        pwaInstallBtn.addEventListener('click', async () => {
            if (deferredPrompt) {
                pwaBanner.style.display = 'none';
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                deferredPrompt = null;
            }
        });
    }

    if(pwaDismissBtn) {
        pwaDismissBtn.addEventListener('click', () => {
            if(pwaBanner) pwaBanner.style.display = 'none';
        });
    }
});

// --- CRYPTO & AUTHENTICATION ENGINE ---
if (!window.crypto || !window.crypto.subtle) {
    alert("CRITICAL SECURITY ERROR: Web Crypto API is not available. This device or browser cannot perform secure encryption.");
}

let userProfile = null; // Dynamically loaded from Firestore Auth
let currentSessionPassword = ""; // Needed for export encryption

let isSandboxMode = false;
function getCollection(name) {
    return isSandboxMode ? `sandbox_${name}` : name;
}

async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getEncryptionKey(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), {name: "PBKDF2"}, false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
        keyMaterial, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
    );
}

async function encryptData(jsonData, password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(jsonData);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await getEncryptionKey(password, salt);
    const encryptedContent = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, data);
    
    const encryptedBuffer = new Uint8Array(salt.byteLength + iv.byteLength + encryptedContent.byteLength);
    encryptedBuffer.set(salt, 0);
    encryptedBuffer.set(iv, salt.byteLength);
    encryptedBuffer.set(new Uint8Array(encryptedContent), salt.byteLength + iv.byteLength);
    return encryptedBuffer;
}

async function decryptData(encryptedBuffer, password) {
    try {
        const data = new Uint8Array(encryptedBuffer);
        const salt = data.slice(0, 16);
        const iv = data.slice(16, 28);
        const encryptedContent = data.slice(28);
        
        const key = await getEncryptionKey(password, salt);
        const decryptedContent = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, encryptedContent);
        const decoder = new TextDecoder();
        return decoder.decode(decryptedContent);
    } catch(e) { return null; } // Invalid password
}

// UI Initialization and Authentication Routing
window.addEventListener('firebase-ready', () => {
    // Auth UI Navigation
    document.getElementById('link-signup').addEventListener('click', () => {
        document.getElementById('auth-login-view').style.display = 'none';
        document.getElementById('auth-signup-view').style.display = 'block';
    });
    document.getElementById('link-back-login').addEventListener('click', () => {
        document.getElementById('auth-signup-view').style.display = 'none';
        document.getElementById('auth-login-view').style.display = 'block';
    });
    document.getElementById('pending-logout-btn').addEventListener('click', () => {
        window.fbSignOut(window.firebaseAuth);
    });

    // --- AUTHENTICATION LOGIC ---

    function proceedToApp() {
        if (!userProfile) return;
        document.getElementById('app-loading-screen').style.display = 'none';
        document.getElementById('sync-status-container').style.display = 'flex';
        if (typeof updateSyncStatusUI === 'function') updateSyncStatusUI();
        if (userProfile.status === 'pending') {
            document.getElementById('auth-login-view').style.display = 'none';
            document.getElementById('auth-signup-view').style.display = 'none';
            document.getElementById('auth-pending-view').style.display = 'block';
            document.getElementById('app-container').style.display = 'none';
        } else if (userProfile.status === 'approved') {
            document.getElementById('auth-container').style.display = 'none';
            document.getElementById('app-container').style.display = 'block';
            
            if (userProfile.role === 'admin') {
                document.getElementById('nav-admin-btn').style.display = 'block';
                if (typeof window.initAdminConsole === 'function') window.initAdminConsole();
            } else {
                document.getElementById('nav-admin-btn').style.display = 'none';
            }
            
            if (typeof window.initTrainingMachine === 'function') window.initTrainingMachine();
            if (typeof window.initLiveShopsSync === 'function') window.initLiveShopsSync();
            document.getElementById('nav-instructions-btn').style.display = 'block';
            
            setTimeout(() => { if (btnHome) btnHome.click(); }, 500);
        } else if (userProfile.status === 'suspended') {
            alert("SECURITY ALERT: Your account has been suspended by the District Administration.");
            window.fbSignOut(window.firebaseAuth);
        }
    }

    window.fbOnAuthStateChanged(window.firebaseAuth, async (user) => {
        if (user) {
            // User is signed in. Fetch profile from Firestore.
            const userDocRef = window.fbDoc(window.firebaseDB, "users", user.uid);
            
            // Listen to profile changes so Admin approvals unlock the app in real-time
            window.fbOnSnapshot(userDocRef, (docSnap) => {
                if (docSnap.exists()) {
                    userProfile = docSnap.data();
                    proceedToApp();
                } else {
                    // Profile data missing, force signout
                    window.fbSignOut(window.firebaseAuth);
                }
            });
        } else {
            // User is signed out
            userProfile = null;
            document.getElementById('app-loading-screen').style.display = 'none';
            document.getElementById('app-container').style.display = 'none';
            document.getElementById('auth-container').style.display = 'flex';
            document.getElementById('auth-pending-view').style.display = 'none';
            document.getElementById('auth-login-view').style.display = 'block';
            document.getElementById('auth-signup-view').style.display = 'none';
        }
    });

    // Registration Logic (Dual-Auth & Profile)
    document.getElementById('register-btn').addEventListener('click', async () => {
        const name = document.getElementById('signup-name').value.trim();
        const username = document.getElementById('signup-username').value.trim().toLowerCase();
        const email = document.getElementById('signup-email').value.trim();
        const designation = document.getElementById('signup-designation').value.trim();
        const doj = document.getElementById('signup-doj').value;
        const reporting = document.getElementById('signup-reporting').value.trim();
        const dob = document.getElementById('signup-dob').value;
        const password = document.getElementById('signup-password').value;
        
        if (!name || !username || !email || !designation || !password) return alert("Please fill all mandatory fields.");
        if (password.length < 6) return alert("Password must be at least 6 characters.");
        
        try {
            document.getElementById('register-btn').innerText = "Registering Securely...";
            // We register using their Official Email natively. Username is stored for lookup.
            const userCredential = await window.fbCreateUser(window.firebaseAuth, email, password);
            const user = userCredential.user;
            
            // Create user profile in Firestore
            await window.fbSetDoc(window.fbDoc(window.firebaseDB, "users", user.uid), {
                uid: user.uid,
                name: name,
                username: username,
                email: email,
                designation: designation,
                doj: doj,
                reporting: reporting,
                dob: dob,
                role: 'field', // Automatically restricted to field role
                status: 'pending', // Requires admin approval to access DB
                needsTraining: true,
                trainingMandatory: false,
                createdAt: new Date().toISOString()
            });
            
            if (typeof window.logActivity === 'function') window.logActivity('register', name, `created a new profile and is awaiting Admin approval.`);
            
            document.getElementById('register-btn').innerText = "💾 Register Profile";
        } catch (error) {
            document.getElementById('register-btn').innerText = "💾 Register Profile";
            alert("Registration Error: " + error.message);
        }
    });

    // Dual-Auth Login & Sandbox Logic
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const identifier = document.getElementById('login-identifier').value.trim().toLowerCase();
        const password = document.getElementById('login-password').value;
        
        if (!identifier || !password) return;

        // Sandbox Trapdoor
        if (identifier === "sandbox" && password === "sandbox123") {
            isSandboxMode = true;
            document.getElementById('sandbox-banner').style.display = 'block';
            document.getElementById('login-btn').innerText = "Entering Sandbox...";
            // For Sandbox, we just fake an auth bypass
            userProfile = {
                uid: 'sandbox_user',
                name: 'Training Officer',
                username: 'training',
                designation: 'Trainee',
                role: 'admin',
                status: 'approved',
                needsTraining: false
            };
            document.getElementById('auth-container').style.display = 'none';
            document.getElementById('app-container').style.display = 'block';
            document.getElementById('nav-admin-btn').style.display = 'block';
            document.getElementById('nav-instructions-btn').style.display = 'block';
            if (typeof window.initLiveShopsSync === 'function') window.initLiveShopsSync();
            window.initAdminConsole();
            return;
        }
        
        try {
            document.getElementById('login-btn').innerText = "Authenticating...";
            window.isLoginButtonClicked = true;
            
            // Check if we are already securely authenticated in the background via browserLocalPersistence
            if (window.firebaseAuth.currentUser) {
                if (!userProfile) {
                    // Profile is still loading in the background. onSnapshot will handle the transition shortly.
                    return;
                }
                // If they are logging in as a different user while already logged in, sign out first
                if (window.firebaseAuth.currentUser.email !== identifier && userProfile.username !== identifier) {
                    await window.fbSignOut(window.firebaseAuth);
                    userProfile = null;
                } else {
                    proceedToApp();
                    return;
                }
            }

            // Persistence
            const rememberMe = document.getElementById('auth-remember').checked;
            const persistenceType = rememberMe ? window.fbBrowserLocal : window.fbBrowserSession;
            await window.fbSetPersistence(window.firebaseAuth, persistenceType);

            let loginEmail = identifier;
            
            // If it doesn't contain @, it's a Username. We must query Firestore for the Email.
            if (!identifier.includes('@')) {
                const usersRef = window.fbCollection(window.firebaseDB, 'users');
                const q = window.fbQuery(usersRef, window.fbWhere('username', '==', identifier));
                const querySnapshot = await window.fbGetDocs(q);
                if (querySnapshot.empty) {
                    throw new Error("Username not found.");
                }
                loginEmail = querySnapshot.docs[0].data().email;
            }
            
            await window.fbSignIn(window.firebaseAuth, loginEmail, password);
            currentSessionPassword = password; // Save for legacy local exports
            document.getElementById('login-btn').innerText = "🔐 Secure Login";
        } catch (error) {
            window.isLoginButtonClicked = false;
            document.getElementById('login-btn').innerText = "🔒 Secure Login";
            alert("Invalid credentials or account not found.");
        }
    });

    // Forgot Password Logic
    const forgotBtn = document.getElementById('link-forgot-password');
    if (forgotBtn) {
        forgotBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const email = prompt("Enter your official registered email address to receive a secure password reset link:");
            if (!email) return;
            
            try {
                await window.fbSendPasswordResetEmail(window.firebaseAuth, email.trim());
                alert("✅ Password Reset Link Sent!\n\nPlease check your email inbox (and spam folder) for an official Firebase link to reset your password. Once you have created a new password, return here to log in.");
            } catch (error) {
                alert("Error sending reset link. Please ensure your email is typed correctly or contact the Admin.");
            }
        });
    }
});

// Initialize map centered on Qasimabad coordinates
const map = L.map('map', { maxZoom: 24, zoomControl: false }).setView([25.4286, 68.3438], 13);
L.control.zoom({ position: 'bottomright' }).addTo(map);

// Add Google Maps
L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    attribution: '&copy; Google Maps'
}).addTo(map);

// Draw the Vector Digital Boundary from boundaryGeoJSON
if (typeof boundaryGeoJSON !== 'undefined' && boundaryGeoJSON.features && boundaryGeoJSON.features.length > 0) {
    L.geoJSON(boundaryGeoJSON, {
        style: {
            color: '#dc2626',     // Red boundary line
            weight: 3,
            fillColor: '#ef4444', // Slight reddish tint
            fillOpacity: 0.15     // Separating it from the rest of the map
        }
    }).addTo(map);

    // Overlay the digitalized Deh map image
    const dehImageBounds = [[25.371600, 68.299584], [25.485886, 68.387950]];
    const dehImageOverlay = L.imageOverlay('./qasimabad_deh_map.png', dehImageBounds, {
        opacity: 0.7,
        interactive: false
    }).addTo(map);

    // Bind opacity slider to the Deh map
    const opacitySlider = document.getElementById('map-opacity');
    if (opacitySlider) {
        opacitySlider.addEventListener('input', function(e) {
            dehImageOverlay.setOpacity(e.target.value);
        });
    }
}

// Minimize Map Controls Panel
let isPanelMinimized = false;
document.getElementById('minimize-panel-btn').addEventListener('click', function() {
    isPanelMinimized = !isPanelMinimized;
    const content = document.getElementById('map-panel-content');
    const footer = document.getElementById('map-panel-footer');
    
    if (isPanelMinimized) {
        content.style.display = 'none';
        footer.style.display = 'none';
        this.innerText = '➕';
        this.title = 'Maximize Panel';
    } else {
        content.style.display = 'block';
        footer.style.display = 'block';
        this.innerText = '➖';
        this.title = 'Minimize Panel';
    }
});

// --- RAID DATABASE// Cloud Synchronization Engine
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

window.logActivity = async function(type, officer, details, officerUid = null, priorState = null, amendmentReason = null) {
    const act = {
        type: type,
        domain: window.currentDomain || 'tobacco_enforcement',
        officer: officer,
        officerUid: officerUid || (window.userProfile ? window.userProfile.uid : null),
        details: details,
        priorState: priorState,
        amendmentReason: amendmentReason,
        timestamp: Date.now(),
        dateString: new Date().toLocaleString()
    };
    
    localAuditLogs.push(act);
    // Live update the local Admin Activity Feed if it is open
    if (typeof window.renderLocalActivityFeed === 'function') window.renderLocalActivityFeed();

    if (!window.firebaseDB) return;
    try {
        const activityRef = window.fbDoc(window.fbCollection(window.firebaseDB, getCollection('activity_log')));
        await window.fbSetDoc(activityRef, act);
    } catch(e) { console.error("Logging failed", e); }
};

let shops = []; // Tobacco shops
let wholesaleEntities = [];
let retailEntities = [];
let lpgEntities = [];
let petrolEntities = [];
let hoardingEntities = [];

let wholesalePriceLogs = [];
let retailPriceLogs = [];
let fvEntities = [];
let lpgPriceLogs = [];
let petrolCheckLogs = [];
let hoardingLogs = [];
let encroachmentLogs = [];

let unsubShops, unsubWholesale, unsubRetail, unsubFv, unsubLpg, unsubPetrol, unsubHoarding, unsubEncroachment, unsubActivityLog;
let unsubWholesaleEntities, unsubRetailEntities, unsubFvEntities, unsubLpgEntities, unsubPetrolEntities, unsubHoardingEntities;
let localAuditLogs = [];

// --- Local Storage Persistence Removed ---
// The app now relies entirely on Firebase's native IndexedDB persistentLocalCache for offline support.
// This resolves synchronization conflicts between localStorage and Firebase's cache, specifically fixing Incognito data loss.

window.initLiveShopsSync = function() {
    if (!window.firebaseDB) return;
    
    const collections = [
        { key: 'shops', setter: (v) => shops = v, ref: unsubShops, setRef: (v) => unsubShops = v, domain: 'tobacco_enforcement' },
        { key: 'wholesale_entities', setter: (v) => wholesaleEntities = v, ref: unsubWholesaleEntities, setRef: (v) => unsubWholesaleEntities = v, domain: 'wholesale_price' },
        { key: 'retail_entities', setter: (v) => retailEntities = v, ref: unsubRetailEntities, setRef: (v) => unsubRetailEntities = v, domain: 'retail_price' },
        { key: 'lpg_entities', setter: (v) => lpgEntities = v, ref: unsubLpgEntities, setRef: (v) => unsubLpgEntities = v, domain: 'lpg_price' },
        { key: 'petrol_entities', setter: (v) => petrolEntities = v, ref: unsubPetrolEntities, setRef: (v) => unsubPetrolEntities = v, domain: 'petrol_check' },
        { key: 'hoarding_entities', setter: (v) => hoardingEntities = v, ref: unsubHoardingEntities, setRef: (v) => unsubHoardingEntities = v, domain: 'anti_hoarding' },
        { key: 'wholesale_price_logs', setter: (v) => wholesalePriceLogs = v, ref: unsubWholesale, setRef: (v) => unsubWholesale = v, domain: 'wholesale_price' },
        { key: 'retail_price_logs', setter: (v) => retailPriceLogs = v, ref: unsubRetail, setRef: (v) => unsubRetail = v, domain: 'retail_price' },
        { key: 'fv_entities', setter: (v) => fvEntities = v, ref: unsubFvEntities, setRef: (v) => unsubFvEntities = v, domain: 'fv_price' },
        { key: 'lpg_price_logs', setter: (v) => lpgPriceLogs = v, ref: unsubLpg, setRef: (v) => unsubLpg = v, domain: 'lpg_price' },
        { key: 'petrol_check_logs', setter: (v) => petrolCheckLogs = v, ref: unsubPetrol, setRef: (v) => unsubPetrol = v, domain: 'petrol_check' },
        { key: 'anti_hoarding_logs', setter: (v) => hoardingLogs = v, ref: unsubHoarding, setRef: (v) => unsubHoarding = v, domain: 'anti_hoarding' },
        { key: 'anti_encroachment_logs', setter: (v) => encroachmentLogs = v, ref: unsubEncroachment, setRef: (v) => unsubEncroachment = v, domain: 'anti_encroachment' },
        { key: 'activity_log', setter: (v) => { 
            localAuditLogs = v; 
            if (typeof window.renderLocalActivityFeed === 'function') window.renderLocalActivityFeed();
            if (typeof window.renderAmendmentsFeed === 'function') window.renderAmendmentsFeed(); 
        }, ref: unsubActivityLog, setRef: (v) => unsubActivityLog = v, domain: 'all' }
    ];

    collections.forEach(col => {
        if (col.ref) col.ref(); // Unsubscribe existing
        if (col.domain !== 'all') {
            if (!window.currentDomain && col.domain !== 'tobacco_enforcement') return;
            if (window.currentDomain && col.domain !== window.currentDomain) return;
        }
        
        const fbRef = window.fbCollection(window.firebaseDB, getCollection(col.key));
        col.setRef(window.fbOnSnapshot(fbRef, (snapshot) => {
            const logs = [];
            snapshot.forEach(doc => logs.push(doc.data()));
            col.setter(logs);
            console.log(`[LiveSync] Collection '${col.key}' updated: ${logs.length} docs`, logs);
            if (col.domain !== 'all' && window.currentDomain === col.domain) renderShops();
            if (col.domain !== 'all' && typeof renderDashboard === 'function') renderDashboard();
        }));
    });
};

window.addEventListener('firebase-ready', () => {
    console.log("Firebase initialized, waiting for Auth to connect...");
});

async function uploadBase64ToStorage(base64String, path) {
    if (!window.firebaseStorage || !base64String || !base64String.startsWith('data:image')) return base64String;
    try {
        const storageRef = window.fbRef(window.firebaseStorage, path);
        await window.fbUploadString(storageRef, base64String, 'data_url');
        return await window.fbGetDownloadURL(storageRef);
    } catch (e) {
        console.error("Storage upload failed", e);
        return base64String; // fallback
    }
}

async function saveShopsToStorage(targetShopId = null) {
    try {
        if (!window.firebaseDB) return false;
        document.getElementById('status-msg').innerHTML = "⏳ Syncing to Cloud...";
        
        for (let i = 0; i < shops.length; i++) {
            let shop = shops[i];
            
            // OPTIMIZATION: Skip unrelated shops to save Firebase bandwidth and write quota
            if (targetShopId && shop.id !== targetShopId) continue;
            if (!shop.id) shop.id = generateId();
            
            // Upload shop photo to Firebase Storage
            if (shop.photo && shop.photo.startsWith('data:image')) {
                shop.photo = await uploadBase64ToStorage(shop.photo, `shops/${shop.id}/main.jpg`);
            }
            
            // Upload raid photos to Firebase Storage
            if (shop.raids) {
                for (let r = 0; r < shop.raids.length; r++) {
                    let raid = shop.raids[r];
                    if (!raid.id) raid.id = generateId();
                    if (raid.photos) {
                        for (let p = 0; p < raid.photos.length; p++) {
                            if (raid.photos[p] && raid.photos[p].startsWith('data:image')) {
                                raid.photos[p] = await uploadBase64ToStorage(raid.photos[p], `shops/${shop.id}/raids/${raid.id}_${p}.jpg`);
                            }
                        }
                    }
                }
            }
            
            const shopDoc = window.fbDoc(window.firebaseDB, getCollection('shops'), shop.id);
            await window.fbSetDoc(shopDoc, shop, { merge: true });
        }
        
        document.getElementById('status-msg').innerHTML = "✅ Cloud Synced";
        setTimeout(() => { document.getElementById('status-msg').innerHTML = ""; }, 3000);
        return true;
    } catch (e) {
        console.error(e);
        alert("Cloud Save Error: " + e.message);
        return false;
    }
}

// Removed unsafe synchronous legacy patch logic
let shopMarkers = [];
let currentLat = null;
let currentLng = null;
let activeShopId = null;

function renderShops() {
    // Clear existing markers
    shopMarkers.forEach(m => map.removeLayer(m));
    shopMarkers = [];

    const getIcon = (emoji, color) => L.divIcon({
        html: `<div style="background-color:${color}; width:24px; height:24px; border-radius:4px; border:2px solid white; display:flex; align-items:center; justify-content:center; color:white; font-size:12px; box-shadow:0 2px 4px rgba(0,0,0,0.5);">${emoji}</div>`,
        className: 'custom-shop-icon',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    if (window.currentDomain === 'tobacco_enforcement') {
        const icon = getIcon('🚬', '#c084fc');
        shops.forEach(shop => {
            if (shop.deleted || !shop.lat || !shop.lng) return;
            const marker = L.marker([shop.lat, shop.lng], { icon: icon, zIndexOffset: 1000 }).addTo(map);
            marker.on('click', () => window.openShopDashboard(shop.id));
            shopMarkers.push(marker);
        });
    } else if (window.currentDomain === 'wholesale_price') {
        const icon = getIcon('🏭', '#6ee7b7');
        wholesaleEntities.forEach(entity => {
            if (entity.deleted || !entity.lat || !entity.lng) return;
            const marker = L.marker([entity.lat, entity.lng], { icon: icon, zIndexOffset: 1000 }).addTo(map);
            marker.on('click', () => window.openEntityDashboard(entity.id, 'wholesale_price'));
            shopMarkers.push(marker);
        });
    } else if (window.currentDomain === 'retail_price') {
        const icon = getIcon('🏪', '#6ee7b7');
        retailEntities.forEach(entity => {
            if (entity.deleted || !entity.lat || !entity.lng) return;
            const marker = L.marker([entity.lat, entity.lng], { icon: icon, zIndexOffset: 1000 }).addTo(map);
            marker.on('click', () => window.openEntityDashboard(entity.id, 'retail_price'));
            shopMarkers.push(marker);
        });
    } else if (window.currentDomain === 'fv_price') {
        const icon = getIcon('🍎', '#6ee7b7');
        fvEntities.forEach(entity => {
            if (entity.deleted || !entity.lat || !entity.lng) return;
            const marker = L.marker([entity.lat, entity.lng], { icon: icon, zIndexOffset: 1000 }).addTo(map);
            marker.on('click', () => window.openEntityDashboard(entity.id, 'fv_price'));
            shopMarkers.push(marker);
        });
    } else if (window.currentDomain === 'lpg_price') {
        const icon = getIcon('🔥', '#fbbf24');
        lpgEntities.forEach(entity => {
            if (entity.deleted || !entity.lat || !entity.lng) return;
            const marker = L.marker([entity.lat, entity.lng], { icon: icon, zIndexOffset: 1000 }).addTo(map);
            marker.on('click', () => window.openEntityDashboard(entity.id, 'lpg_price'));
            shopMarkers.push(marker);
        });
    } else if (window.currentDomain === 'petrol_check') {
        const icon = getIcon('⛽', '#fbbf24');
        petrolEntities.forEach(entity => {
            if (entity.deleted || !entity.lat || !entity.lng) return;
            const marker = L.marker([entity.lat, entity.lng], { icon: icon, zIndexOffset: 1000 }).addTo(map);
            marker.on('click', () => window.openEntityDashboard(entity.id, 'petrol_check'));
            shopMarkers.push(marker);
        });
    } else if (window.currentDomain === 'anti_hoarding') {
        const icon = getIcon('📦', '#d97706');
        hoardingEntities.forEach(entity => {
            if (entity.deleted || !entity.lat || !entity.lng) return;
            const marker = L.marker([entity.lat, entity.lng], { icon: icon, zIndexOffset: 1000 }).addTo(map);
            marker.on('click', () => window.openEntityDashboard(entity.id, 'anti_hoarding'));
            shopMarkers.push(marker);
        });
    } else if (window.currentDomain === 'anti_encroachment') {
        const icon = getIcon('🚜', '#dc2626');
        encroachmentLogs.forEach(log => {
            if (!log.lat || !log.lng) return;
            const marker = L.marker([log.lat, log.lng], { icon: icon, zIndexOffset: 1000 }).addTo(map);
            marker.on('click', () => { if(typeof openAELogDetails === 'function') openAELogDetails(log); else alert('Details viewer not ready.'); });
            shopMarkers.push(marker);
        });
    }
}

// Locate Me Feature
let userMarker = null;
let userCircle = null;
let userManuallyMoved = false;
window.watchPositionId = null;

window.stopGPSAndClearPin = function() {
    if (window.watchPositionId) {
        navigator.geolocation.clearWatch(window.watchPositionId);
        window.watchPositionId = null;
    }
    if (userMarker) {
        map.removeLayer(userMarker);
        userMarker = null;
    }
    if (userCircle) {
        map.removeLayer(userCircle);
        userCircle = null;
    }
    const addActBtn = document.getElementById('add-activity-btn');
    if (addActBtn) addActBtn.style.display = 'none';
    const statusMsg = document.getElementById('status-msg');
    if (statusMsg) statusMsg.innerText = "Status: Idle.";
    const locateBtn = document.getElementById('locate-btn');
    if (locateBtn) locateBtn.innerText = "📍 Locate Me";
};

document.getElementById('locate-btn').addEventListener('click', function() {
    userManuallyMoved = false; // Reset manual override if clicked again
    const statusMsg = document.getElementById('status-msg');
    statusMsg.innerText = "Acquiring highly accurate GPS lock...";
    
    if (!navigator.geolocation) {
        statusMsg.innerText = "Geolocation is not supported.";
        return;
    }

    window.watchPositionId = navigator.geolocation.watchPosition(
        (position) => {
            if (!userManuallyMoved) {
                currentLat = position.coords.latitude;
                currentLng = position.coords.longitude;
            }
            
            const trueLat = position.coords.latitude;
            const trueLng = position.coords.longitude;
            const acc = position.coords.accuracy;

            statusMsg.innerText = `Location updated. Accuracy: ${Math.round(acc)}m`;
            
            // Show Add Activity Button when GPS is acquired
            const addActBtn = document.getElementById('add-activity-btn');
            if (addActBtn) addActBtn.style.display = "block";

            if (userMarker) {
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
            }
        },
        (error) => { 
            statusMsg.innerText = `Error: ${error.message}`;
            const locateBtnEl = document.getElementById('locate-btn');
            if (locateBtnEl) locateBtnEl.innerText = "📍 Locate Me";
            alert("Location access denied or unavailable. Please enable GPS/Location access in your browser settings.");
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );
    if (typeof window.trainingHookLocationFound === 'function') window.trainingHookLocationFound();
});

// --- ADD SHOP MODAL & COMPRESSION ---
const addShopModal = document.getElementById('add-shop-modal');
let compressedPhotoData = "";
let editingShopId = null;

const isSameCheckbox = document.getElementById('is-same-checkbox');
const shopkeeperNameInput = document.getElementById('new-shopkeeper-name');
const shopkeeperPhoneInput = document.getElementById('new-shopkeeper-phone');

isSameCheckbox.addEventListener('change', function() {
    if (this.checked) {
        shopkeeperNameInput.disabled = true;
        shopkeeperPhoneInput.disabled = true;
        shopkeeperNameInput.style.backgroundColor = '#e2e8f0';
        shopkeeperPhoneInput.style.backgroundColor = '#e2e8f0';
        shopkeeperNameInput.style.cursor = 'not-allowed';
        shopkeeperPhoneInput.style.cursor = 'not-allowed';
    } else {
        shopkeeperNameInput.disabled = false;
        shopkeeperPhoneInput.disabled = false;
        shopkeeperNameInput.style.backgroundColor = '#ffffff';
        shopkeeperPhoneInput.style.backgroundColor = '#ffffff';
        shopkeeperNameInput.style.cursor = 'text';
        shopkeeperPhoneInput.style.cursor = 'text';
    }
});

document.getElementById('add-activity-btn').addEventListener('click', function() {
    if (!currentLat || !currentLng) return alert("Waiting for GPS location...");
    
    // Route to different modals based on currentDomain
    if (['wholesale_price', 'retail_price', 'lpg_price', 'petrol_check', 'anti_hoarding', 'fv_price'].includes(window.currentDomain)) {
        openAddEntityModal();

    } else if (window.currentDomain === 'anti_encroachment') {
        document.getElementById('ae-location').value = '';
        document.getElementById('ae-reclaimed-size').value = '';
        document.getElementById('ae-value-pkr').value = '';
        if(document.getElementById('ae-reason')) document.getElementById('ae-reason').value = 'Court Order';
        if(document.getElementById('ae-reason-other-group')) document.getElementById('ae-reason-other-group').style.display = 'none';
        if(document.getElementById('ae-reason-other')) document.getElementById('ae-reason-other').value = '';
        window.photoCache['ae-photo-before'] = null;
        window.photoCache['ae-photo-after'] = null;
        document.getElementById('anti-encroachment-modal').style.display = 'flex';
    } else {
        // Fallback or tobacco_enforcement
        openTobaccoModal();
    }
});

function openTobaccoModal() {
    editingShopId = null;
    document.getElementById('add-shop-modal-title').innerText = "Add New Tobacco Shop";
    document.getElementById('new-shop-name').value = "";
    document.getElementById('new-shop-owner').value = "";
    document.getElementById('new-owner-phone').value = "";
    
    isSameCheckbox.checked = true;
    isSameCheckbox.dispatchEvent(new Event('change'));
    
    shopkeeperNameInput.value = "";
    shopkeeperPhoneInput.value = "";
    
    document.getElementById('shop-photo-input').value = "";
    document.getElementById('shop-photo-preview').style.display = "none";
    compressedPhotoData = "";
    addShopModal.style.display = "flex";
}

let editingEntityId = null;
let compressedEntityPhotoData = "";

function openAddEntityModal() {
    editingEntityId = null;
    let title = "Add New Entity";
    let nameLabel = "Entity Name:";
    if (window.currentDomain === 'wholesale_price') { title = "Add Flour Mill / Chaki"; nameLabel = "Mill Name:"; }
    if (window.currentDomain === 'retail_price') { title = "Add Retail Store"; nameLabel = "Store Name:"; }
    if (window.currentDomain === 'lpg_price') { title = "Add LPG Outlet"; nameLabel = "Outlet Name:"; }
    if (window.currentDomain === 'petrol_check') { title = "Add Petrol Pump"; nameLabel = "Station Name:"; }
    if (window.currentDomain === 'anti_hoarding') { title = "Add Godown / Storage"; nameLabel = "Godown Name:"; }

    if (window.currentDomain === 'fv_price') {
        document.getElementById('fv-type-group').style.display = "block";
        document.getElementById('fv-vendor-type').value = "Shop";
        title = "Add F&V Vendor";
        nameLabel = "Vendor / Stall Name:";
    } else {
        const typeGrp = document.getElementById('fv-type-group');
        if(typeGrp) typeGrp.style.display = "none";
    }

    document.getElementById('add-entity-modal-title').innerText = title;
    document.getElementById('add-entity-name-label').innerText = nameLabel;
    document.getElementById('new-entity-name').value = "";
    document.getElementById('new-entity-owner').value = "";
    document.getElementById('new-entity-phone').value = "";
    
    document.getElementById('entity-photo-input').value = "";
    document.getElementById('entity-photo-preview').style.display = "none";
    compressedEntityPhotoData = "";
    document.getElementById('add-entity-modal').style.display = "flex";
}
window.compressImage = function(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};

document.getElementById('save-entity-btn').addEventListener('click', async () => {
    const name = document.getElementById('new-entity-name').value.trim();
    const owner = document.getElementById('new-entity-owner').value.trim();
    const phone = document.getElementById('new-entity-phone').value.trim();
    
    if (!name) return alert("Entity Name is required");

    let editReason = null;
    if (editingEntityId) {
        editReason = prompt("Security Check: Please type the mandatory reason why you are amending these details (min 5 characters):");
        if (!editReason || editReason.trim().length < 5) {
            return alert("Amendment cancelled: A valid reason is required.");
        }
    }
    
    const entityId = editingEntityId || generateId();
    let colName = "";
    if (window.currentDomain === 'wholesale_price') colName = "wholesale_entities";
    if (window.currentDomain === 'retail_price') colName = "retail_entities";
    if (window.currentDomain === 'lpg_price') colName = "lpg_entities";
    if (window.currentDomain === 'petrol_check') colName = "petrol_entities";
    if (window.currentDomain === 'anti_hoarding') colName = "hoarding_entities";

    if (window.currentDomain === 'fv_price') colName = "fv_entities";

    const docRef = window.fbDoc(window.firebaseDB, getCollection(colName), entityId);
    
    let entityData = {
        name, owner, phone,
        photo: window.photoCache['entity-photo'] || compressedEntityPhotoData,
        lastEditedBy: userProfile.name,
        lastEditedAt: new Date().toISOString()
    };
    
    if (window.currentDomain === 'fv_price') {
        entityData.vendorType = document.getElementById('fv-vendor-type').value;
    }

    if (!editingEntityId) {
        entityData.id = entityId;
        if (!currentLat || !currentLng) {
            return alert("❌ GPS location is not yet acquired. Please click 'Locate Me', wait for a GPS lock, then try again.");
        }
        entityData.lat = currentLat;
        entityData.lng = currentLng;
        entityData.createdBy = userProfile.name;
        entityData.createdAt = new Date().toISOString();
        entityData.deleted = false;
        entityData.activities = [];
    }

    try {
        let targetArray = null;
        if (window.currentDomain === 'wholesale_price') targetArray = wholesaleEntities;
        else if (window.currentDomain === 'retail_price') targetArray = retailEntities;
        else if (window.currentDomain === 'fv_price') targetArray = fvEntities;
        else if (window.currentDomain === 'lpg_price') targetArray = lpgEntities;
        else if (window.currentDomain === 'petrol_check') targetArray = petrolEntities;
        else if (window.currentDomain === 'anti_hoarding') targetArray = hoardingEntities;
        
        let oldEntityState = null;
        if (targetArray) {
            if (editingEntityId) {
                const idx = targetArray.findIndex(e => e.id === editingEntityId);
                if (idx !== -1) {
                    oldEntityState = { ...targetArray[idx] };
                    targetArray[idx] = { ...targetArray[idx], ...entityData };
                }
            } else {
                targetArray.push(entityData);
            }
            }

        window.fbSetDoc(docRef, entityData, { merge: true });
        document.getElementById('add-entity-modal').style.display = 'none';
        window.photoCache['entity-photo'] = null;
        
        if (editingEntityId) {
            alert("Profile Updated!");
            if (typeof window.logActivity === 'function') window.logActivity('edit_entity', window.userProfile ? window.userProfile.name : "Admin", `edited the profile details of '${name}'.`, null, oldEntityState, editReason);
        } else {
            alert("Profile Created Successfully!");
        }

        window.stopGPSAndClearPin();
        if (typeof renderShops === 'function') renderShops();
        if (typeof renderDashboard === 'function') renderDashboard();
    } catch(e) {
        alert("Error saving: " + e.message);
    }
});

document.getElementById('cancel-add-entity').addEventListener('click', () => { 
    document.getElementById('add-entity-modal').style.display = 'none'; 
    window.photoCache['entity-photo'] = null;
});

window.activeEntity = null;

window.openEntityDashboard = function(entityId, domain) {
    let entities = [];
    if (domain === 'wholesale_price') entities = wholesaleEntities;
    if (domain === 'retail_price') entities = retailEntities;
    if (domain === 'fv_price') entities = fvEntities;
    if (domain === 'lpg_price') entities = lpgEntities;
    if (domain === 'petrol_check') entities = petrolEntities;

    const entity = entities.find(e => e.id === entityId);
    if (!entity) return;
    
    window.activeEntity = entity;
    
    document.getElementById('dash-entity-name').innerText = entity.name;
    document.getElementById('dash-entity-owner-name').innerText = entity.owner || "Unknown";
    document.getElementById('dash-entity-owner-phone').innerText = entity.phone || "";
    
    const photoEl = document.getElementById('dash-entity-photo');
    if (entity.photo) {
        photoEl.src = entity.photo;
        photoEl.style.display = 'block';
    } else {
        photoEl.style.display = 'none';
    }

    const historyList = document.getElementById('entity-activities-list');
    if (!entity.activities || entity.activities.length === 0) {
        historyList.innerHTML = '<p style="color:#64748b;">No activities logged yet.</p>';
    } else {
        let html = '';
        let sortedActs = [...entity.activities].sort((a,b) => b.timestamp - a.timestamp);
        let isAdmin = window.userProfile ? window.userProfile.role === 'admin' : true;
        sortedActs.forEach(act => {
            let canEdit = isAdmin || (window.userProfile && window.userProfile.name === act.officer);
            html += `<div style="background:#fff; border-left:4px solid #ef4444; padding:10px; margin-bottom:10px; border-radius:4px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <p style="margin:0; font-size:0.85rem; color:#64748b;">${new Date(act.timestamp).toLocaleString()}</p>
                        <p style="margin:4px 0 0; color:#1e293b; font-weight:bold;">Officer: ${act.officer}</p>
                        <p style="margin:4px 0 0; color:#334155; font-size:0.9rem;">Fine Imposed: Rs ${act.fineAmount || 0}</p>
                        ${act.isSealed ? `<p style="margin:4px 0 0; color:#b91c1c; font-weight:bold; font-size:0.85rem;">🔒 Entity Sealed</p>` : ''}
                        ${act.desealedAt ? `<p style="margin:4px 0 0; color:#059669; font-weight:bold; font-size:0.85rem;">🔓 De-Sealed</p>` : ''}
                        ${act.photo ? `<img src="${act.photo}" onclick="if(window.openImageViewer) window.openImageViewer(this.src)" style="cursor:pointer; width:50px; height:50px; object-fit:cover; border-radius:4px; margin-top:8px; border:1px solid #cbd5e1;">` : ''}
                    </div>
                    ${'<button class="secondary-btn" style="width:auto; padding:5px 10px; font-size:0.8rem; height:fit-content; background:#1c5629; color:white; border:none; margin-bottom:4px;" onclick="viewInspection(\'' + window.currentDomain + '\', \'' + entity.id + '\', \'' + act.id + '\')">👁️ View</button>'}
                    ${canEdit ? `<button class="secondary-btn" style="width:auto; padding:5px 10px; font-size:0.8rem; height:fit-content;" onclick="editInspection('${window.currentDomain}', '${entity.id}', '${act.id}')">✏️ Edit</button>` : ''}
                    ${canEdit ? `<button class="secondary-btn" style="width:auto; padding:5px 10px; font-size:0.8rem; height:fit-content; background:#ef4444; color:white; border:none; margin-left:5px;" onclick="deleteInspection('${window.currentDomain}', '${entity.id}', '${act.id}')">🗑️ Delete</button>` : ''}
                </div>
            </div>`;
        });
        historyList.innerHTML = html;
    }

    if (userProfile && userProfile.role === 'admin') {
        document.getElementById('delete-entity-btn').style.display = 'inline-block';
    }

    document.getElementById('entity-dashboard-modal').style.display = 'flex';
};

document.getElementById('close-entity-dash').addEventListener('click', () => { 
    document.getElementById('entity-dashboard-modal').style.display = 'none'; 
    window.activeEntity = null;
});

document.getElementById('edit-entity-btn').addEventListener('click', () => {
    if (!window.activeEntity) return;
    editingEntityId = window.activeEntity.id;
    
    let title = "Edit Entity";
    let nameLabel = "Entity Name:";
    if (window.currentDomain === 'wholesale_price') { title = "Edit Flour Mill / Chaki"; nameLabel = "Mill Name:"; }
    else if (window.currentDomain === 'retail_price') { title = "Edit Retail Store"; nameLabel = "Store Name:"; }
    else if (window.currentDomain === 'lpg_price') { title = "Edit LPG Outlet"; nameLabel = "Outlet Name:"; }
    else if (window.currentDomain === 'petrol_check') { title = "Edit Petrol Pump"; nameLabel = "Station Name:"; }

    if (window.currentDomain === 'fv_price') {
        document.getElementById('fv-type-group').style.display = "block";
        document.getElementById('fv-vendor-type').value = "Shop";
        title = "Add F&V Vendor";
        nameLabel = "Vendor / Stall Name:";
    } else {
        const typeGrp = document.getElementById('fv-type-group');
        if(typeGrp) typeGrp.style.display = "none";
    }

    document.getElementById('add-entity-modal-title').innerText = title;
    document.getElementById('add-entity-name-label').innerText = nameLabel;
    
    document.getElementById('new-entity-name').value = window.activeEntity.name || "";
    document.getElementById('new-entity-owner').value = window.activeEntity.owner || "";
    document.getElementById('new-entity-phone').value = window.activeEntity.phone || "";
    const photoPreview = document.getElementById('entity-photo-preview');
    if (window.activeEntity.photo) {
        photoPreview.src = window.activeEntity.photo;
        photoPreview.style.display = "block";
    } else {
        photoPreview.style.display = "none";
    }
    compressedEntityPhotoData = window.activeEntity.photo || "";
    
    document.getElementById('entity-dashboard-modal').style.display = 'none';
    document.getElementById('add-entity-modal').style.display = 'flex';
});

document.getElementById('delete-entity-btn').addEventListener('click', () => {
    if (!window.activeEntity) return;
    
    if (confirm(`Are you sure you want to permanently delete '${window.activeEntity.name}'?`)) {
        let targetArray = null;
        let colName = "";
        
        if (window.currentDomain === 'wholesale_price') { targetArray = wholesaleEntities; colName = "wholesale_entities"; }
        else if (window.currentDomain === 'retail_price') { targetArray = retailEntities; colName = "retail_entities"; }
        else if (window.currentDomain === 'fv_price') { targetArray = fvEntities; colName = "fv_entities"; }
        else if (window.currentDomain === 'lpg_price') { targetArray = lpgEntities; colName = "lpg_entities"; }
        else if (window.currentDomain === 'petrol_check') { targetArray = petrolEntities; colName = "petrol_entities"; }
        else if (window.currentDomain === 'anti_hoarding') { targetArray = hoardingEntities; colName = "hoarding_entities"; }
        
        if (targetArray) {
            const idx = targetArray.findIndex(e => e.id === window.activeEntity.id);
            if (idx !== -1) {
                targetArray[idx].deleted = true;
                targetArray[idx].deletedAt = new Date().toISOString();
                targetArray[idx].deletedBy = window.userProfile ? window.userProfile.name : "Unknown Admin";
            }
            if (typeof window.logActivity === 'function') window.logActivity('delete_entity', window.userProfile ? window.userProfile.name : "Admin", `permanently deleted entity '${window.activeEntity.name}'`);
        }
        
        const docRef = window.fbDoc(window.firebaseDB, getCollection(colName), window.activeEntity.id);
        window.fbSetDoc(docRef, { deleted: true, deletedAt: new Date().toISOString(), deletedBy: window.userProfile ? window.userProfile.name : "Unknown Admin" }, { merge: true });
        
        document.getElementById('entity-dashboard-modal').style.display = 'none';
        window.activeEntity = null;
        
        if (typeof renderShops === 'function') renderShops();
        if (typeof renderDashboard === 'function') renderDashboard();
        
        alert("Entity successfully deleted.");
    }
});

let editingInspectionId = null;

document.getElementById('open-entity-activity-form-btn').addEventListener('click', () => {
    editingInspectionId = null;
    document.getElementById('entity-dashboard-modal').style.display = 'none';
    if (window.currentDomain === 'wholesale_price') {
        document.getElementById('wp-target-name').value = window.activeEntity.name;
        document.getElementById('wp-commodity').value = '';
        document.getElementById('wp-notified-price').value = '';
        document.getElementById('wp-found-price').value = '';
        document.getElementById('wp-violation').value = 'no';
        document.getElementById('wp-fine-amount').value = '';
        document.getElementById('wp-sealing').value = 'none';
        document.getElementById('wholesale-price-modal').style.display = 'flex';
    } else if (window.currentDomain === 'retail_price') {
        document.getElementById('rp-target-name').value = window.activeEntity.name;
        document.getElementById('rp-category').value = '';
        document.getElementById('rp-ratelist').value = 'displayed';
        document.getElementById('rp-violation').value = 'no';
        document.getElementById('rp-fine-amount').value = '';
        document.getElementById('rp-sealing').value = 'none';
        document.getElementById('retail-price-modal').style.display = 'flex';
    } else if (window.currentDomain === 'fv_price') {
        document.getElementById('fv-target-name').value = window.activeEntity.name;
        document.getElementById('fv-produce').value = '';
        document.getElementById('fv-violation').value = 'compliant';
        document.getElementById('fv-fine-amount').value = '';
        document.getElementById('fv-sealing').value = 'none';
        const label = window.activeEntity.vendorType === 'Stall' ? 'Seize / Confiscate Stall:' : 'Sealing Action:';
        document.getElementById('fv-sealing-label').innerText = label;
        document.getElementById('fv-sealing-opt1').innerText = window.activeEntity.vendorType === 'Stall' ? 'Confiscated with Fine' : 'Sealed with Fine';
        document.getElementById('fv-sealing-opt2').innerText = window.activeEntity.vendorType === 'Stall' ? 'Confiscated pending payment' : 'Sealed pending payment';
        document.getElementById('fv-price-modal').style.display = 'flex';
    } else if (window.currentDomain === 'lpg_price') {
        document.getElementById('lpg-target-name').value = window.activeEntity.name;
        document.getElementById('lpg-violation').value = 'none';
        document.getElementById('lpg-fine-amount').value = '';
        document.getElementById('lpg-sealing').value = 'none';
        document.getElementById('lpg-price-modal').style.display = 'flex';
    } else if (window.currentDomain === 'petrol_check') {
        document.getElementById('petrol-target-name').value = window.activeEntity.name;
        document.getElementById('petrol-violation').value = 'none';
        document.getElementById('petrol-fine-amount').value = '';
        document.getElementById('petrol-sealing').value = 'none';
        document.getElementById('petrol-check-modal').style.display = 'flex';
    } else if (window.currentDomain === 'anti_hoarding') {
        document.getElementById('ah-target-name').value = window.activeEntity.name;
        document.getElementById('ah-commodity').value = 'wheat';
        document.getElementById('ah-volume-mt').value = '';
        document.getElementById('ah-fir-details').value = '';
        document.getElementById('anti-hoarding-modal').style.display = 'flex';
    }
});



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
    const row = (label, val) => val ? `<div style="display:flex; justify-content:space-between; border-bottom:1px solid #e2e8f0; padding-bottom:6px; gap:10px;"><span style="color:#64748b; font-size:0.85rem;">${label}</span><span style="font-weight:600; color:#0f172a; font-size:0.85rem; text-align:right;">${val}</span></div>` : '';

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
        fieldsHTML += row('Govt. Notified Rate', act.notifiedPrice ? 'Rs ' + act.notifiedPrice + '/cylinder' : null);
        fieldsHTML += row('Rate Found at Outlet', act.foundPrice ? 'Rs ' + act.foundPrice + '/cylinder' : null);
        fieldsHTML += row('Violation', act.violation === 'yes' ? '⚠️ Overcharging' : '✅ Compliant');
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
        statusHTML += `<span style="background:#fef2f2; border:1px solid #fca5a5; color:#b91c1c; border-radius:20px; padding:4px 12px; font-size:0.8rem; font-weight:700;">🔒 Sealed</span>`;
    } else if (act.sealingAction && act.sealingAction !== 'none') {
        statusHTML += `<span style="background:#fef9c3; border:1px solid #fde047; color:#854d0e; border-radius:20px; padding:4px 12px; font-size:0.8rem; font-weight:700;">⚠️ ${act.sealingAction}</span>`;
    } else {
        statusHTML += `<span style="background:#f0fdf4; border:1px solid #86efac; color:#15803d; border-radius:20px; padding:4px 12px; font-size:0.8rem; font-weight:700;">✅ No Sealing</span>`;
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

window.deleteInspection = async function(domain, entityId, logId) {
    let entities = [];
    let colName = "";
    if (domain === 'wholesale_price') { entities = wholesaleEntities; colName = "wholesale_entities"; }
    else if (domain === 'retail_price') { entities = retailEntities; colName = "retail_entities"; }
    else if (domain === 'fv_price') { entities = fvEntities; colName = "fv_entities"; }
    else if (domain === 'lpg_price') { entities = lpgEntities; colName = "lpg_entities"; }
    else if (domain === 'petrol_check') { entities = petrolEntities; colName = "petrol_entities"; }
    else if (domain === 'anti_hoarding') { entities = hoardingEntities; colName = "hoarding_entities"; }
    
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
        window.logActivity('delete_inspection', window.userProfile ? window.userProfile.name : "Admin", `deleted an inspection log for '${entity.name}'`, null, act, reason);
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

window.editInspection = function(domain, entityId, logId) {
    let entities = [];
    if (domain === 'wholesale_price') entities = wholesaleEntities;
    else if (domain === 'retail_price') entities = retailEntities;
    else if (domain === 'fv_price') entities = fvEntities;
    else if (domain === 'lpg_price') entities = lpgEntities;
    else if (domain === 'petrol_check') entities = petrolEntities;
    
    let entity = entities.find(e => e.id === entityId);
    if (!entity) return;
    
    let act = entity.activities.find(a => a.id === logId);
    if (!act) return;
    
    window.activeEntity = entity;
    editingInspectionId = logId;
    
    document.getElementById('entity-dashboard-modal').style.display = 'none';
    
    if (domain === 'wholesale_price') {
        document.getElementById('wp-target-name').value = entity.name;
        document.getElementById('wp-commodity').value = act.commodity || '';
        document.getElementById('wp-notified-price').value = act.notifiedPrice || '';
        document.getElementById('wp-found-price').value = act.foundPrice || '';
        document.getElementById('wp-violation').value = act.violation || 'no';
        document.getElementById('wp-fine-amount').value = act.fineAmount || '';
        document.getElementById('wp-sealing').value = act.sealingAction || 'none';
        document.getElementById('wholesale-price-modal').style.display = 'flex';
    } else if (domain === 'retail_price') {
        document.getElementById('rp-target-name').value = entity.name;
        document.getElementById('rp-category').value = act.category || '';
        document.getElementById('rp-ratelist').value = act.ratelist || 'displayed';
        document.getElementById('rp-violation').value = act.violation || 'no';
        document.getElementById('rp-fine-amount').value = act.fineAmount || '';
        document.getElementById('rp-sealing').value = act.sealingAction || 'none';
        document.getElementById('retail-price-modal').style.display = 'flex';
    } else if (domain === 'fv_price') {
        document.getElementById('fv-target-name').value = entity.name;
        document.getElementById('fv-produce').value = act.produce || '';
        document.getElementById('fv-notified-price').value = act.notifiedPrice || '';
        document.getElementById('fv-found-price').value = act.foundPrice || '';
        document.getElementById('fv-violation').value = act.violation || 'compliant';
        document.getElementById('fv-fine-amount').value = act.fineAmount || '';
        document.getElementById('fv-sealing').value = act.sealingAction || 'none';
        document.getElementById('fv-price-modal').style.display = 'flex';
    } else if (domain === 'lpg_price') {
        document.getElementById('lpg-target-name').value = entity.name;
        document.getElementById('lpg-violation').value = act.violation || 'none';
        document.getElementById('lpg-notified-price').value = act.notifiedPrice || '';
        document.getElementById('lpg-found-price').value = act.foundPrice || '';
        document.getElementById('lpg-fine-amount').value = act.fineAmount || '';
        document.getElementById('lpg-sealing').value = act.sealingAction || 'none';
        document.getElementById('lpg-price-modal').style.display = 'flex';
    } else if (domain === 'petrol_check') {
        document.getElementById('petrol-target-name').value = entity.name;
        document.getElementById('petrol-violation').value = act.violation || 'none';
        document.getElementById('petrol-fine-amount').value = act.fineAmount || '';
        document.getElementById('petrol-sealing').value = act.sealingAction || 'none';
        document.getElementById('petrol-check-modal').style.display = 'flex';
    }
};

document.getElementById('cancel-wp-btn').addEventListener('click', () => { document.getElementById('wholesale-price-modal').style.display = 'none'; window.photoCache['wp-photo'] = null; });
document.getElementById('cancel-rp-btn').addEventListener('click', () => { document.getElementById('retail-price-modal').style.display = 'none'; window.photoCache['rp-photo'] = null; });
document.getElementById('cancel-fv-btn').addEventListener('click', () => { document.getElementById('fv-price-modal').style.display = 'none'; window.photoCache['fv-photo'] = null; });
document.getElementById('cancel-lpg-btn').addEventListener('click', () => { document.getElementById('lpg-price-modal').style.display = 'none'; window.photoCache['lpg-photo'] = null; });
document.getElementById('cancel-petrol-btn').addEventListener('click', () => { document.getElementById('petrol-check-modal').style.display = 'none'; window.photoCache['petrol-photo'] = null; });
document.getElementById('cancel-ah-btn').addEventListener('click', () => { document.getElementById('anti-hoarding-modal').style.display = 'none'; window.photoCache['ah-photo-proof'] = null; });
document.getElementById('cancel-ae-btn').addEventListener('click', () => { document.getElementById('anti-encroachment-modal').style.display = 'none'; window.photoCache['ae-photo-before'] = null; window.photoCache['ae-photo-after'] = null; });

async function saveSealingDomain(domainKey, modalPrefix, dataObj, successMsg) {
    if (!window.activeEntity) return alert("No active entity selected!");
    
    let editReason = null;
    if (editingInspectionId) {
        editReason = prompt("Security Check: Please type the mandatory reason why you are amending this inspection (min 5 characters):");
        if (!editReason || editReason.trim().length < 5) {
            return alert("Amendment cancelled: A valid reason is required.");
        }
    }

    const fine = document.getElementById(`${modalPrefix}-fine-amount`).value;
    const sealing = document.getElementById(`${modalPrefix}-sealing`).value;
    const customTimeEl = document.getElementById(`${modalPrefix}-sealing-time`);
    const customTime = customTimeEl ? customTimeEl.value : null;
    
    if (window.photoCache[`${modalPrefix}-photo`]) {
        dataObj.photo = window.photoCache[`${modalPrefix}-photo`];
    }
    
    document.getElementById('status-msg').innerHTML = "⏳ Saving...";
    const logId = editingInspectionId || generateId();
    
    let sealedAt = null;
    let isSealed = false;
    if (sealing === 'sealed_fine' || sealing === 'sealed_pending') {
        isSealed = true;
        if (customTime) {
            sealedAt = new Date(customTime).getTime();
        } else {
            sealedAt = Date.now();
        }
    }

    let act = {
        id: logId, fineAmount: fine, sealingAction: sealing,
        isSealed: isSealed, sealedAt: sealedAt, desealedAt: null,
        officer: userProfile ? userProfile.name : "Unknown", timestamp: Date.now(),
        ...dataObj
    };
    
    window.activeEntity.activities = window.activeEntity.activities || [];
    
    if (editingInspectionId) {
        let idx = window.activeEntity.activities.findIndex(a => a.id === editingInspectionId);
        let oldState = null;
        if (idx !== -1) {
            oldState = { ...window.activeEntity.activities[idx] };
            act.officer = window.activeEntity.activities[idx].officer;
            act.timestamp = window.activeEntity.activities[idx].timestamp;
            act.desealedAt = window.activeEntity.activities[idx].desealedAt;
            window.activeEntity.activities[idx] = { ...window.activeEntity.activities[idx], ...act };
        }
        editingInspectionId = null;
        if (typeof window.logActivity === 'function') window.logActivity('edit_inspection', window.userProfile ? window.userProfile.name : "Admin", `edited a previously logged inspection for '${window.activeEntity.name}'.`, null, oldState, editReason);
    } else {
        window.activeEntity.activities.push(act);
    }
    
    let colName = "";
    if (domainKey === 'wholesale_price') colName = "wholesale_entities";
    if (domainKey === 'retail_price') colName = "retail_entities";
    if (domainKey === 'fv_price') colName = "fv_entities";
    if (domainKey === 'lpg_price') colName = "lpg_entities";
    if (domainKey === 'petrol_check') colName = "petrol_entities";
    if (domainKey === 'anti_hoarding') colName = "hoarding_entities";

    window.openEntityDashboard(window.activeEntity.id, domainKey);
    document.getElementById('status-msg').innerHTML = "✅ Saved";
    window.photoCache[`${modalPrefix}-photo`] = null;
    
    if (domainKey === 'wholesale_price') document.getElementById('wholesale-price-modal').style.display = 'none';
    else if (domainKey === 'retail_price') document.getElementById('retail-price-modal').style.display = 'none';
    else if (domainKey === 'fv_price') document.getElementById('fv-price-modal').style.display = 'none';
    else if (domainKey === 'lpg_price') document.getElementById('lpg-price-modal').style.display = 'none';
    else if (domainKey === 'petrol_check') document.getElementById('petrol-check-modal').style.display = 'none';
    
    if (typeof window.logActivity === 'function') window.logActivity(domainKey, act.officer, successMsg.replace('{target}', window.activeEntity.name));

    await window.fbSetDoc(window.fbDoc(window.firebaseDB, getCollection(colName), window.activeEntity.id), window.activeEntity, { merge: true });
}

document.getElementById('save-wp-btn').addEventListener('click', () => {
    saveSealingDomain('wholesale_price', 'wp', {
        commodity: document.getElementById('wp-commodity').value,
        notifiedPrice: document.getElementById('wp-notified-price').value,
        foundPrice: document.getElementById('wp-found-price').value,
        violation: document.getElementById('wp-violation').value
    }, `inspected wholesale mill: {target}`);
});

function checkWPViolation() {
    const notified = parseFloat(document.getElementById('wp-notified-price').value);
    const found = parseFloat(document.getElementById('wp-found-price').value);
    const violationSelect = document.getElementById('wp-violation');
    if (!isNaN(notified) && !isNaN(found)) {
        if (found > notified) {
            violationSelect.value = 'yes';
        } else {
            violationSelect.value = 'no';
        }
    }
}

document.getElementById('wp-notified-price').addEventListener('input', checkWPViolation);
document.getElementById('wp-found-price').addEventListener('input', checkWPViolation);

document.getElementById('save-rp-btn').addEventListener('click', () => {
    saveSealingDomain('retail_price', 'rp', {
        category: document.getElementById('rp-category').value,
        ratelist: document.getElementById('rp-ratelist').value,
        violation: document.getElementById('rp-violation').value
    }, `inspected retail store: {target}`);
});
document.getElementById('save-fv-btn').addEventListener('click', () => {
    saveSealingDomain('fv_price', 'fv', {
        produce: document.getElementById('fv-produce').value,
        notifiedPrice: document.getElementById('fv-notified-price').value,
        foundPrice: document.getElementById('fv-found-price').value,
        violation: document.getElementById('fv-violation').value
    }, `inspected F&V vendor: ${document.getElementById('fv-target-name').value}`);
});

document.getElementById('save-lpg-btn').addEventListener('click', () => {
    saveSealingDomain('lpg_price', 'lpg', {
        violation: document.getElementById('lpg-violation').value,
        notifiedPrice: document.getElementById('lpg-notified-price').value,
        foundPrice: document.getElementById('lpg-found-price').value
    }, `inspected LPG outlet: {target}`);
});

document.getElementById('save-petrol-btn').addEventListener('click', () => {
    let violationVal = document.getElementById('petrol-violation').value;
    let fuelType = document.getElementById('petrol-fuel-type').value;
    let actualFuel = document.getElementById('petrol-actual-fuel').value;
    
    let fuelStr = fuelType;
    if ((violationVal === 'yes_quantity' || violationVal === 'yes_both') && actualFuel) {
        let shortAmount = 1000 - parseInt(actualFuel);
        fuelStr += ` - ${actualFuel}ml / 1000ml charge (${shortAmount}ml short)`;
    }

    saveSealingDomain('petrol_check', 'petrol', {
        violation: violationVal,
        fuelType: fuelType,
        actualFuel: actualFuel,
        customActionDesc: fuelStr
    }, `inspected Petrol Pump: {target}`);
});

document.getElementById('petrol-violation').addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'yes_quantity' || val === 'yes_both') {
        document.getElementById('petrol-actual-fuel-group').style.display = 'block';
    } else {
        document.getElementById('petrol-actual-fuel-group').style.display = 'none';
        document.getElementById('petrol-actual-fuel').value = '';
    }
});

document.getElementById('save-ah-btn').addEventListener('click', async () => {
    if (!window.activeEntity) return alert("No active entity selected!");

    let editReason = null;
    if (editingInspectionId) {
        editReason = prompt("Security Check: Please type the mandatory reason why you are amending this inspection (min 5 characters):");
        if (!editReason || editReason.trim().length < 5) {
            return alert("Amendment cancelled: A valid reason is required.");
        }
    }

    const commodity = document.getElementById('ah-commodity').value;
    const vol = document.getElementById('ah-volume-mt').value;
    const fir = document.getElementById('ah-fir-details').value;

    document.getElementById('status-msg').innerHTML = "⏳ Saving...";
    const logId = editingInspectionId || generateId();
    let doc = {
        id: logId, commodity: commodity, volumeMT: vol, fir: fir,
        officer: userProfile ? userProfile.name : "Unknown", timestamp: Date.now()
    };
    if (window.photoCache['ah-photo-proof']) doc.photo = window.photoCache['ah-photo-proof'];

    if (editingInspectionId) {
        const oldActIndex = window.activeEntity.activities.findIndex(a => a.id === editingInspectionId);
        if (oldActIndex > -1) {
            const oldAct = window.activeEntity.activities[oldActIndex];
            if (typeof window.logActivity === 'function') window.logActivity('edit_inspection', window.userProfile ? window.userProfile.name : "Admin", `edited Anti-Hoarding details for '${window.activeEntity.name}'`, null, oldAct, editReason);
            window.activeEntity.activities[oldActIndex] = doc;
        }
    } else {
        if (!window.activeEntity.activities) window.activeEntity.activities = [];
        window.activeEntity.activities.push(doc);
    }

    const docRef = window.fbDoc(window.firebaseDB, getCollection('anti_hoarding'), window.activeEntity.id);
    await window.fbSetDoc(docRef, window.activeEntity, { merge: true });

    document.getElementById('status-msg').innerHTML = "✅ Saved";
    document.getElementById('anti-hoarding-modal').style.display = 'none';
    window.photoCache['ah-photo-proof'] = null;

    if (typeof renderDashboard === 'function') renderDashboard();
    window.openEntityDashboard(window.activeEntity.id, 'anti_hoarding');

    if (typeof window.logActivity === 'function') window.logActivity('anti_hoarding', doc.officer, `raided godown ${window.activeEntity.name}`);
});

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
    if (typeof window.logActivity === 'function') window.logActivity('anti_encroachment', doc.officer, `cleared encroachment at ${loc}`);
});

window.editShopProfile = function(shopId) {
    const shop = shops.find(s => s.id === shopId);
    if (!shop) return;
    
    editingShopId = shopId;
    dashboardModal.style.display = "none";
    
    document.getElementById('add-shop-modal-title').innerText = "Edit Shop Profile";
    document.getElementById('new-shop-name').value = shop.name;
    document.getElementById('new-shop-owner').value = shop.owner;
    document.getElementById('new-owner-phone').value = shop.ownerPhone || "";
    
    isSameCheckbox.checked = shop.isOwnerShopkeeperSame;
    isSameCheckbox.dispatchEvent(new Event('change'));
    
    shopkeeperNameInput.value = shop.shopkeeperName || "";
    shopkeeperPhoneInput.value = shop.shopkeeperPhone || "";
    
    compressedPhotoData = shop.photo || "";
    const preview = document.getElementById('shop-photo-preview');
    if (compressedPhotoData) {
        preview.src = compressedPhotoData;
        preview.style.display = "block";
    } else {
        preview.style.display = "none";
    }
    
    addShopModal.style.display = "flex";
};

document.getElementById('cancel-add-shop').addEventListener('click', () => {
    addShopModal.style.display = "none";
    window.photoCache['shop-photo'] = null;
});

document.getElementById('save-shop-btn').addEventListener('click', function() {
    const name = document.getElementById('new-shop-name').value.trim();
    const owner = document.getElementById('new-shop-owner').value.trim();
    const ownerPhone = document.getElementById('new-owner-phone').value.trim();
    const isSame = isSameCheckbox.checked;
    const shopkeeperName = isSame ? owner : shopkeeperNameInput.value.trim();
    const shopkeeperPhone = isSame ? ownerPhone : shopkeeperPhoneInput.value.trim();

    if (!name) return alert("Shop name is required!");

    let editReason = null;
    if (editingShopId) {
        editReason = prompt("Security Check: Please type the mandatory reason why you are amending these details (min 5 characters):");
        if (!editReason || editReason.trim().length < 5) {
            return alert("Amendment cancelled: A valid reason is required.");
        }
    }

    if (editingShopId) {
        const targetShop = shops.find(s => s.id === editingShopId);
        
        const oldState = {
            name: targetShop.name,
            owner: targetShop.owner,
            ownerPhone: targetShop.ownerPhone,
            shopkeeperName: targetShop.shopkeeperName,
            shopkeeperPhone: targetShop.shopkeeperPhone,
            isOwnerShopkeeperSame: targetShop.isOwnerShopkeeperSame
        };

        // Save audit log
        targetShop.shopHistory.push({
            ...oldState,
            photo: targetShop.photo,
            editedOn: new Date().toLocaleString()
        });

        if (typeof window.logActivity === 'function') {
            window.logActivity('edit_shop', window.userProfile ? window.userProfile.name : "Admin", `edited the profile details of '${name}'.`, null, oldState, editReason);
        }

        targetShop.name = name;
        targetShop.owner = owner;
        targetShop.ownerPhone = ownerPhone;
        targetShop.shopkeeperName = shopkeeperName;
        targetShop.shopkeeperPhone = shopkeeperPhone;
        targetShop.isOwnerShopkeeperSame = isSame;
        if (compressedPhotoData) targetShop.photo = compressedPhotoData;

    } else {
        const newShop = {
            id: Date.now().toString(),
            lat: currentLat,
            lng: currentLng,
            name: name,
            owner: owner,
            ownerPhone: ownerPhone,
            shopkeeperName: shopkeeperName,
            shopkeeperPhone: shopkeeperPhone,
            isOwnerShopkeeperSame: isSame,
            photo: compressedPhotoData,
            createdBy: userProfile ? userProfile.name : "Unknown",
            raids: [],
            shopHistory: []
        };
        shops.push(newShop);
        if (typeof window.logActivity === 'function') window.logActivity('create_shop', userProfile ? userProfile.name : "Admin", `profiled a new shop named '${name}'.`);
        if (typeof window.trainingHookShopCreated === 'function') window.trainingHookShopCreated();
    }

    let targetIdToSave = editingShopId;
    if (!editingShopId) targetIdToSave = shops[shops.length - 1].id;
    
    saveShopsToStorage(targetIdToSave);
    window.stopGPSAndClearPin();
    renderShops();
    addShopModal.style.display = "none";
    if (editingShopId) window.openShopDashboard(editingShopId); // Reopen dashboard if edited
});

// --- SHOP DASHBOARD ---
const dashboardModal = document.getElementById('shop-dashboard-modal');

window.openShopDashboard = function(shopId) {
    activeShopId = shopId;
    const shop = shops.find(s => s.id === shopId);
    if (!shop) return;

    document.getElementById('dash-shop-name').innerText = shop.name;
    document.getElementById('dash-owner-name').innerText = shop.owner || "Unknown";
    document.getElementById('dash-owner-phone').innerText = shop.ownerPhone ? `(Ph: ${shop.ownerPhone})` : "";
    document.getElementById('dash-shopkeeper-name').innerText = shop.shopkeeperName || shop.owner || "Unknown";
    document.getElementById('dash-shopkeeper-phone').innerText = shop.shopkeeperPhone ? `(Ph: ${shop.shopkeeperPhone})` : "";
    
    document.getElementById('edit-shop-btn').onclick = () => window.editShopProfile(shop.id);
    
    const deleteBtn = document.getElementById('delete-shop-btn');
    if (userProfile && (shop.createdBy === userProfile.name || userProfile.role === 'admin')) {
        deleteBtn.style.display = "block";
        deleteBtn.onclick = () => window.deleteShop(shop.id);
    } else {
        deleteBtn.style.display = "none";
    }
    
    // Render Shop History Audit Log
    const shopHistoryContainer = document.getElementById('shop-history-container');
    shopHistoryContainer.innerHTML = "";
    if (shop.shopHistory && shop.shopHistory.length > 0) {
        let hHTML = '<div class="audit-log-container" style="background:#fff7ed; border-color:#fed7aa;"><h4 style="font-size:0.75rem; color:#c2410c; margin-top:0px; margin-bottom:5px;">⚠️ Shop Profile Version History:</h4>';
        shop.shopHistory.slice().reverse().forEach((sh, idx) => {
            const shPhoto = sh.photo ? `<img src="${sh.photo}" onclick="if(window.openImageViewer) window.openImageViewer(this.src)" style="cursor:pointer; width:50px; height:50px; object-fit:cover; border-radius:4px; margin-top:5px; border:1px solid #fdba74;">` : '';
            hHTML += `
                <div class="audit-log-item" style="border-left-color:#fdba74;">
                    <p style="font-size:0.7rem; color:#9a3412; margin-bottom:2px;">Original Profile before Edit #${shop.shopHistory.length - idx}:</p>
                    <p><strong>Name:</strong> ${sh.name}</p>
                    <p><strong>Owner:</strong> ${sh.owner} ${sh.ownerPhone ? '('+sh.ownerPhone+')' : ''}</p>
                    <p style="font-size:0.7rem;">Logged on: ${sh.editedOn}</p>
                    ${shPhoto}
                </div>
            `;
        });
        hHTML += '</div>';
        shopHistoryContainer.innerHTML = hHTML;
    }

    const photoEl = document.getElementById('dash-shop-photo');
    if (shop.photo) {
        photoEl.src = shop.photo;
        photoEl.style.display = "block";
    } else {
        photoEl.style.display = "none";
    }

    // Render Raids
    const historyContainer = document.getElementById('raid-history-container');
    historyContainer.innerHTML = "";
    
    if (shop.raids.length === 0) {
        historyContainer.innerHTML = "<p style='color:#94a3b8;'>No raids logged yet.</p>";
    } else {
        let historyHTMLBuffer = '';
        shop.raids.slice().reverse().forEach((raid, index) => {
            const raidNum = shop.raids.length - index;
            
            // Build Audit History HTML if exists
            let historyHTML = '';
            if (raid.history && raid.history.length > 0) {
                historyHTML = '<div class="audit-log-container"><h4 style="font-size:0.75rem; color:#64748b; margin-top:10px; margin-bottom:5px;">Version History (Personal Log):</h4>';
                // Reverse history to show newest edits first
                raid.history.slice().reverse().forEach((hist, hIdx) => {
                    let histPhotoHTML = '';
                    if (hist.photos && hist.photos.length > 0) {
                        histPhotoHTML = `<div class="raid-photo-gallery">` + hist.photos.map(p => `<img src="${p}" onclick="if(window.openImageViewer) window.openImageViewer(this.src)" style="cursor:pointer;">`).join('') + `</div>`;
                    }
                    historyHTML += `
                        <div class="audit-log-item">
                            <p style="font-size:0.7rem; color:#94a3b8; margin-bottom:2px;">Original Entry before Edit #${raid.history.length - hIdx}:</p>
                            <p><strong>Packets:</strong> ${hist.packets} | <strong>Officer:</strong> ${hist.officer}</p>
                            <p style="font-size:0.7rem;">Logged on: ${hist.date} ${hist.time}</p>
                            ${histPhotoHTML}
                        </div>
                    `;
                });
                historyHTML += '</div>';
            }

            let raidPhotoHTML = '';
            if (raid.photos && raid.photos.length > 0) {
                raidPhotoHTML = `<div class="raid-photo-gallery">` + raid.photos.map(p => `<img src="${p}" onclick="if(window.openImageViewer) window.openImageViewer(this.src)" style="cursor:pointer;">`).join('') + `</div>`;
            }

            let actionButtons = '';
            if (userProfile && (userProfile.role === 'admin' || raid.createdByUid === userProfile.uid || raid.officer === userProfile.name)) {
                actionButtons = `
                    <div class="raid-actions">
                        <button class="raid-action-btn edit-btn" onclick="editRaid('${shop.id}', '${raid.id}')">✏️ Edit</button>
                        <button class="raid-action-btn delete-btn" onclick="deleteRaid('${shop.id}', '${raid.id}')">🗑️ Delete</button>
                    </div>
                `;
            }

            historyHTMLBuffer += `
                <div class="raid-history-item">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:5px;">
                        <strong style="display:block;">Raid #${raidNum} - ${raid.date} ${raid.time}</strong>
                        ${actionButtons}
                    </div>
                    <p><strong>Officer:</strong> ${raid.officer}</p>
                    <p><strong>Packets Seized:</strong> <span style="color:#ef4444; font-weight:bold;">${raid.packets}</span></p>
                    ${raidPhotoHTML}
                    ${historyHTML}
                </div>
            `;
        });
        historyContainer.innerHTML = historyHTMLBuffer;
    }

    dashboardModal.style.display = "flex";
}

document.getElementById('close-dashboard-btn').addEventListener('click', () => {
    dashboardModal.style.display = "none";
});

// --- RAID FORM LOGIC ---
const raidFormModal = document.getElementById('raid-log-modal');
let editingRaidId = null;
let compressedRaidPhotosArray = [];

function renderRaidPhotoPreviews() {
    const container = document.getElementById('raid-photo-preview-container');
    let bufferHTML = "";
    compressedRaidPhotosArray.forEach((photoData, index) => {
        bufferHTML += `
            <div class="thumbnail-wrapper">
                <img src="${photoData}">
                <button class="delete-photo-btn" onclick="removeRaidPhoto(${index})">X</button>
            </div>
        `;
    });
    container.innerHTML = bufferHTML;
}

window.removeRaidPhoto = function(index) {
    compressedRaidPhotosArray.splice(index, 1);
    renderRaidPhotoPreviews();
};

document.getElementById('open-raid-form-btn').addEventListener('click', function() {
    dashboardModal.style.display = "none";
    editingRaidId = null; // Ensure fresh form
    document.querySelector('#raid-log-modal h2').innerText = "Log Official Raid Seizure";
    
    // Reset photo
    document.getElementById('raid-photo-input').value = "";
    compressedRaidPhotosArray = [];
    renderRaidPhotoPreviews();
    
    // Auto-fill officer details from previous saves
    document.getElementById('raid-officer').value = localStorage.getItem('raidOfficerName') || (userProfile ? userProfile.name : "Sheraz Ahmed");
    document.getElementById('raid-designation').value = localStorage.getItem('raidOfficerDesignation') || (userProfile ? userProfile.designation : "Mukhtiarkar (U.T)");
    document.getElementById('raid-packets').value = 0;
    
    raidFormModal.style.display = "flex";
});

document.getElementById('cancel-raid-btn').addEventListener('click', () => {
    raidFormModal.style.display = "none";
    window.openShopDashboard(activeShopId); // Re-open dashboard
});

// Raid Image Clean Up
document.getElementById('raid-photo-input').addEventListener('click', () => {
});

document.getElementById('save-raid-btn').addEventListener('click', function() {
    const officer = document.getElementById('raid-officer').value.trim();
    const designation = document.getElementById('raid-designation').value.trim();
    const packets = document.getElementById('raid-packets').value;

    if (!officer || !packets) return alert("Please fill all mandatory fields.");

    let editReason = null;
    if (editingRaidId) {
        editReason = prompt("Security Check: Please type the mandatory reason why you are amending this raid (min 5 characters):");
        if (!editReason || editReason.trim().length < 5) {
            return alert("Amendment cancelled: A valid reason is required.");
        }
    }

    // Save officer defaults for future
    localStorage.setItem('raidOfficerName', officer);
    localStorage.setItem('raidOfficerDesignation', designation);

    if (editingRaidId) {
        // Edit Mode
        const shopIndex = shops.findIndex(s => s.id === activeShopId);
        const raidIndex = shops[shopIndex].raids.findIndex(r => r.id === editingRaidId);
        const targetRaid = shops[shopIndex].raids[raidIndex];

        // Ensure history array exists
        if (!targetRaid.history) targetRaid.history = [];

        // Push current state into history before overwriting
        const oldState = {
            date: targetRaid.date,
            time: targetRaid.time,
            officer: targetRaid.officer,
            designation: targetRaid.designation,
            packets: targetRaid.packets
        };
        
        targetRaid.history.push({
            ...oldState,
            photos: targetRaid.photos ? [...targetRaid.photos] : []
        });

        // Update with new values (keep original date and time of the actual raid)
        targetRaid.officer = officer;
        targetRaid.designation = designation;
        targetRaid.packets = packets;
        if (compressedRaidPhotosArray.length > 0) targetRaid.photos = [...compressedRaidPhotosArray];
        
        if (typeof window.logActivity === 'function') window.logActivity('edit_raid', officer, `edited a previously logged raid at '${shops[shopIndex].name}'. New Seizure: ${packets} Packets.`, userProfile ? userProfile.uid : null, oldState, editReason);

    } else {
        // Create Mode
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-GB'); // DD/MM/YYYY
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        const newRaid = {
            id: generateId(),
            date: dateStr,
            time: timeStr,
            officer: officer,
            designation: designation,
            packets: packets,
            photos: [...compressedRaidPhotosArray],
            history: []
        };

        const shopIndex = shops.findIndex(s => s.id === activeShopId);
        shops[shopIndex].raids.push(newRaid);
        
        if (typeof window.logActivity === 'function') window.logActivity('log_raid', officer, `logged a new raid at '${shops[shopIndex].name}' confiscating ${packets} Packets.`, userProfile ? userProfile.uid : null);
        if (typeof window.trainingHookRaidLogged === 'function') window.trainingHookRaidLogged();
    }

    saveShopsToStorage(activeShopId);
    
    raidFormModal.style.display = "none";
    window.openShopDashboard(activeShopId); // Reopen to show new history
});

// Expose Edit & Delete globally
window.editRaid = function(shopId, raidId) {
    dashboardModal.style.display = "none";
    
    const shop = shops.find(s => s.id === shopId);
    const raid = shop.raids.find(r => r.id === raidId);
    
    if (raid) {
        editingRaidId = raidId;
        document.querySelector('#raid-log-modal h2').innerText = "Edit Raid Details";
        document.getElementById('raid-officer').value = raid.officer;
        document.getElementById('raid-designation').value = raid.designation;
        document.getElementById('raid-packets').value = raid.packets;
        
        // Handle existing photos
        compressedRaidPhotosArray = raid.photos ? [...raid.photos] : [];
        document.getElementById('raid-photo-input').value = ""; // Clear input file path
        renderRaidPhotoPreviews();
        
        raidFormModal.style.display = "flex";
    }
};

window.deleteRaid = function(shopId, raidId) {
    const confirmation = confirm("Are you sure you want to permanently delete this raid? This action cannot be undone.");
    if (confirmation) {
        const shopIndex = shops.findIndex(s => s.id === shopId);
        shops[shopIndex].raids = shops[shopIndex].raids.filter(r => r.id !== raidId);
        if (typeof window.logActivity === 'function') window.logActivity('delete_raid', window.userProfile ? window.userProfile.name : "Admin", `permanently deleted a raid at '${shops[shopIndex].name}'`);
        saveShopsToStorage(shopId);
        
        // Refresh UI
        window.openShopDashboard(shopId);
        if (dashView.style.display === 'block') renderDashboard(); // Update metrics if dashboard is open
    }
};

// --- EXPORT TO EXCEL / CSV ---

window.deleteShop = function(shopId) {
    if (!userProfile) return alert("You must be logged in to delete a shop.");
    const shop = shops.find(s => s.id === shopId);
    if (!shop) return;
    if (userProfile.role !== 'admin' && shop.createdBy !== userProfile.name) {
        return alert("Unauthorized. Only the original creator or an admin can delete this shop.");
    }
    
    const reason = prompt(`Security Check: Please type the mandatory reason why you are deleting '${shop.name}' from the district view (min 5 characters):`);
    if (reason && reason.trim().length >= 5) {
        shop.deleted = true;
        shop.deletedBy = userProfile ? userProfile.name : "Unknown Admin";
        shop.deletedReason = reason.trim();
        shop.deletedAt = new Date().toLocaleString();
        
        saveShopsToStorage(shop.id);
        if (window.refreshDeletedArchive) window.refreshDeletedArchive();
        window.logActivity('delete_shop', shop.deletedBy, `deleted shop '${shop.name}'. Reason: ${shop.deletedReason}`);
        
        dashboardModal.style.display = "none";
        renderShops(); // Refresh map immediately
        if (dashView.style.display === 'block') renderDashboard(); // Refresh dashboard if open
        alert("Shop successfully removed from district view and logged.");
    } else {
        alert("Deletion cancelled: A valid reason is required.");
    }
};

window.restoreShop = function(shopId) {
    const shop = shops.find(s => s.id === shopId);
    if (!shop) return;
    
    shop.deleted = false;
    shop.deletedBy = "";
    shop.deletedReason = "";
    shop.deletedAt = "";
    
    saveShopsToStorage(shop.id);
    if (window.refreshDeletedArchive) window.refreshDeletedArchive();
    
    window.logActivity('restore_shop', userProfile ? userProfile.name : "Admin", `restored shop '${shop.name}' using Admin Override.`);
    alert(`Shop '${shop.name}' successfully restored to the map.`);
};
const exportModal = document.getElementById('export-date-modal');


document.body.addEventListener('click', function(e) {
    if (e.target.closest('.export-btn')) {
        if (!window.currentDomain || window.currentDomain === 'tobacco_enforcement') {
            if (shops.length === 0) return alert("No shop data available to export.");
            let hasData = false;
            shops.forEach(s => { if(s.raids && s.raids.length > 0) hasData = true; });
            if (!hasData) return alert("You have added shops, but no raids have been logged yet to export.");
        } else if (['wholesale_price', 'retail_price', 'lpg_price', 'petrol_check', 'anti_hoarding', 'fv_price'].includes(window.currentDomain)) {
            let entities = [];
            if (window.currentDomain === 'wholesale_price') entities = wholesaleEntities;
            if (window.currentDomain === 'retail_price') entities = retailEntities;
            if (window.currentDomain === 'lpg_price') entities = lpgEntities;
            if (window.currentDomain === 'petrol_check') entities = petrolEntities;
            if (window.currentDomain === 'anti_hoarding') entities = hoardingEntities;
            if (window.currentDomain === 'fv_price') entities = fvEntities;
            
            if (entities.length === 0) return alert("No entity data available to export.");
            let hasData = false;
            entities.forEach(s => { if(s.activities && s.activities.length > 0) hasData = true; });
            if (!hasData) return alert("You have added entities, but no inspections have been logged yet to export.");
        } else {
            return alert("Reporting is not yet supported for this domain.");
        }

        // Clear previous inputs
        document.getElementById('export-from-date').value = "";
        document.getElementById('export-to-date').value = "";
        
        exportModal.style.display = "flex";
    }
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
    } else if (['retail_price', 'lpg_price', 'petrol_check', 'anti_hoarding', 'fv_price'].includes(window.currentDomain)) {
        await generateDomainReport(window.currentDomain, fromTimestamp, toTimestamp, fromDateStr, toDateStr);
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
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width; canvas.height = img.height;
                canvas.getContext('2d').drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/png').split(',')[1]);
            } catch (e) {
                console.warn("Canvas taint error, monogram skipped.", e);
                resolve(null);
            }
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
            const raidTimestamp = new Date(`${year}-${month}-${day}T${raid.time}`).getTime();
            
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
        const d1 = new Date(`${sYear}-${sMonth}-${sDay}`);
        const d2 = new Date(`${eYear}-${eMonth}-${eDay}`);
        diffDays = Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
    }

    let daysString = diffDays === 1 ? "1 Day" : `${diffDays} Days`;

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
                { text: `Illegal Tobacco Confiscation Report (${reportStartDateStr} - ${reportEndDateStr}) - ${daysString}\n`, font: { name: 'Instrument Serif', size: 20, bold: true } },
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
            try { safeLat = Number(r.lat).toFixed(5); safeLng = Number(r.lng).toFixed(5); } catch(e) { console.warn("Failed to parse coordinates for raid:", e); }

            const row = worksheet.addRow({
                officer: `${r.officer}\n(${r.designation})`,
                date: r.date,
                time: r.time,
                packets: r.packets,
                location: `Shop Name: ${r.shopName}\nLocation: ${safeLat}, ${safeLng}\nOwner: ${r.owner || 'N/A'}\nContact of Owner: ${r.ownerPhone || 'N/A'}\nShopkeeper: ${r.shopkeeperName || 'N/A'}\nContact of Shopkeeper: ${r.shopkeeperPhone || 'N/A'}`,
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
        
        let filename = `FBR_Seizure_Report_${new Date().toISOString().slice(0,10)}`;
        if (fromDateStr && toDateStr) filename += `_(${fromDateStr}_to_${toDateStr})`;
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
        const d1 = new Date(`${sYear}-${sMonth}-${sDay}`);
        const d2 = new Date(`${eYear}-${eMonth}-${eDay}`);
        diffDays = Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
    }

    let daysString = diffDays === 1 ? "1 Day" : `${diffDays} Days`;

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
                { text: `Wholesale Price Checking Report (${reportStartDateStr} - ${reportEndDateStr}) - ${daysString}\n`, font: { name: 'Instrument Serif', size: 20, bold: true } },
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
            try { safeLat = Number(act.entityLat).toFixed(5); safeLng = Number(act.entityLng).toFixed(5); } catch(e) { console.warn("Failed to parse coordinates for activity:", e); }

            let sealedStatus = "No";
            if (act.sealingAction === 'yes' || act.sealingAction === 'sealed_fine' || act.sealingAction === 'sealed_pending') {
                sealedStatus = "Yes";
                if (act.desealedAt) {
                    sealedStatus = "Yes, but de-sealed" + (act.desealReason ? " (Reason: " + act.desealReason + ")" : " after payment of fine");
                }
            }
            
            const actionDesc = `Violation: ${act.violation || 'None'}\nFine: Rs ${act.fineAmount || 0}\nSealed: ${sealedStatus}`;

            const row = worksheet.addRow({
                officer: `${act.officer}`,
                datetime: `${new Date(act.timestamp).toLocaleDateString()}\n${new Date(act.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`,
                entity_info: `Name: ${act.entityName}\nLocation: ${safeLat}, ${safeLng}\nOwner: ${act.entityOwner || 'N/A'}\nContact: ${act.entityPhone || 'N/A'}\nLicense: ${act.entityLicense || 'N/A'}`,
                commodity: act.commodity || 'N/A',
                pricing: `Notified: ${act.notifiedPrice || '-'}\nFound: ${act.foundPrice || '-'}`,
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
        
        let filename = `Wholesale_Report_${new Date().toISOString().slice(0,10)}`;
        if (fromDateStr && toDateStr) filename += `_(${fromDateStr}_to_${toDateStr})`;
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

async function generateDomainReport(domainKey, fromTimestamp, toTimestamp, fromDateStr, toDateStr) {
    let entities = [];
    let reportTitle = "";
    if (domainKey === 'retail_price') { entities = retailEntities; reportTitle = "Essential Commodities (Retail) Report"; }
    else if (domainKey === 'lpg_price') { entities = lpgEntities; reportTitle = "LPG Gas Price Control Report"; }
    else if (domainKey === 'petrol_check') { entities = petrolEntities; reportTitle = "Petrol Pump Inspection Report"; }
    else if (domainKey === 'anti_hoarding') { entities = hoardingEntities; reportTitle = "Anti-Hoarding Operations Report"; }
    else if (domainKey === 'fv_price') { entities = fvEntities; reportTitle = "Fruits & Vegetables Price Control Report"; }

    let allActs = [];
    entities.forEach(entity => {
        if (entity.deleted) return;
        (entity.activities || []).forEach(act => {
            let include = true;
            if (fromTimestamp && act.timestamp < fromTimestamp) include = false;
            if (toTimestamp && act.timestamp > toTimestamp) include = false;
            if (include) {
                allActs.push({ ...act, entityName: entity.name, entityOwner: entity.owner, entityPhone: entity.phone, entityLat: entity.lat, entityLng: entity.lng, entityPhoto: entity.photo });
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
        diffDays = Math.ceil(Math.abs(new Date(`${eYear}-${eMonth}-${eDay}`) - new Date(`${sYear}-${sMonth}-${sDay}`)) / (1000 * 60 * 60 * 24)) + 1;
    }

    let daysString = diffDays === 1 ? "1 Day" : `${diffDays} Days`;

    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Inspection Report');
        worksheet.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 };

        let columns = [
            { key: 'officer', width: 28 },
            { key: 'datetime', width: 20 },
            { key: 'entity_info', width: 48 }
        ];

        if (domainKey === 'retail_price') {
            columns.push({ key: 'category', width: 20 });
            columns.push({ key: 'ratelist', width: 15 });
            columns.push({ key: 'action', width: 30 });
        } else if (domainKey === 'lpg_price' || domainKey === 'petrol_check') {
            columns.push({ key: 'action', width: 40 });
        } else if (domainKey === 'anti_hoarding') {
            columns.push({ key: 'commodity', width: 20 });
            columns.push({ key: 'volume', width: 15 });
            columns.push({ key: 'fir', width: 30 });
        } else if (domainKey === 'fv_price') {
            columns.push({ key: 'produce', width: 22 });
            columns.push({ key: 'notified_rate', width: 18 });
            columns.push({ key: 'found_rate', width: 18 });
            columns.push({ key: 'action', width: 32 });
        }

        columns.push({ key: 'entity_image', width: 16 });
        columns.push({ key: 'evidence_image', width: 16 });

        worksheet.columns = columns;

        const titleRow = worksheet.addRow([]);
        worksheet.mergeCells(`A1:${String.fromCharCode(64 + columns.length)}1`);
        const titleCell = worksheet.getCell('A1');
        titleCell.value = {
            richText: [
                { text: `${reportTitle} (${reportStartDateStr} - ${reportEndDateStr}) - ${daysString}\n`, font: { name: 'Instrument Serif', size: 20, bold: true } },
                { text: `Generated by: Sindh Enforcement Dashboard • Extracted at: ${new Date().toLocaleString()}`, font: { name: 'Instrument Sans', size: 12, italic: true } }
            ]
        };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        titleRow.height = 85;

        const monoBase64 = await getMonogramBase64();
        if (monoBase64) {
            const monoId = workbook.addImage({ base64: monoBase64, extension: 'png' });
            worksheet.addImage(monoId, { tl: { col: 0.2, row: 0.2 }, ext: { width: 75, height: 75 } });
        }

        let headerObj = {
            officer: 'Authorized Officer',
            datetime: 'Date & Time',
            entity_info: 'Entity Details (Name, Contact, Location)'
        };

        if (domainKey === 'retail_price') {
            headerObj.category = 'Category';
            headerObj.ratelist = 'Rate List Displayed';
            headerObj.action = 'Violation / Fine';
        } else if (domainKey === 'lpg_price' || domainKey === 'petrol_check') {
            headerObj.action = 'Violation / Fine';
        } else if (domainKey === 'anti_hoarding') {
            headerObj.commodity = 'Commodity';
            headerObj.volume = 'Volume (MT)';
            headerObj.fir = 'FIR Details';
        } else if (domainKey === 'fv_price') {
            headerObj.produce = 'Produce Type';
            headerObj.notified_rate = 'Govt. Notified Rate (PKR)';
            headerObj.found_rate = 'Rate Found at Entity (PKR)';
            headerObj.action = 'Adherence / Fine';
        }

        headerObj.entity_image = 'Profile Photo';
        headerObj.evidence_image = 'Evidence';

        const headerRow = worksheet.addRow(headerObj);
        
        headerRow.eachCell((cell) => {
            cell.font = { name: 'Instrument Sans', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366A4F' } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
        });
        headerRow.height = 30;

        let currentRowIndex = 3;
        let exportedRowsCount = 0;

        for (const act of allActs) {
            exportedRowsCount++;
            let locText = (act.entityLat && act.entityLng) ? `Lat: ${Number(act.entityLat).toFixed(4)}, Lng: ${Number(act.entityLng).toFixed(4)}` : "Location Not Pinned";
            let dt = new Date(act.timestamp);
            let dateStr = dt.toLocaleDateString('en-GB');
            let timeStr = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

            let isViolation = false;
            let sealedStatus = "No";
            if (act.sealingAction === 'yes' || act.sealingAction === 'sealed_fine' || act.sealingAction === 'sealed_pending') {
                sealedStatus = "Yes";
                if (act.desealedAt) {
                    sealedStatus = "Yes, but de-sealed" + (act.desealReason ? " (Reason: " + act.desealReason + ")" : " after payment of fine");
                }
            }

            let actionDesc = "";
            if (domainKey === 'retail_price') {
                let violText = (act.violation === 'yes') ? "Yes" : "No";
                if (act.violation === 'yes' || parseInt(act.fineAmount) > 0 || sealedStatus !== "No") isViolation = true;
                actionDesc = `Violation: ${violText}\nFine: Rs. ${act.fineAmount || 0}\nSealed: ${sealedStatus}`;
            } else if (domainKey === 'lpg_price' || domainKey === 'petrol_check') {
                let violText = (act.violation && act.violation !== 'none') ? act.violation.toUpperCase().replace('_', ' ') : "No";
                if (violText !== "No" || parseInt(act.fineAmount) > 0 || sealedStatus !== "No") isViolation = true;
                let rateInfo = '';
                if (domainKey === 'lpg_price' && (act.notifiedPrice || act.foundPrice)) {
                    rateInfo = `\nGovt Rate: Rs. ${act.notifiedPrice || '-'} | Found: Rs. ${act.foundPrice || '-'}`;
                }
                actionDesc = `Violation: ${violText}\nFine: Rs. ${act.fineAmount || 0}\nSealed: ${sealedStatus}${rateInfo}`;
            }

            let rowObj = {
                officer: act.officer || 'Unknown',
                datetime: `${dateStr}\n${timeStr}`,
                entity_info: `${act.entityName}\nOwner: ${act.entityOwner || '-'}\nPh: ${act.entityPhone || '-'}\n${locText}`
            };

            if (domainKey === 'retail_price') {
                rowObj.category = act.category || '-';
                rowObj.ratelist = act.rateList === 'displayed' ? 'Yes' : 'No';
                rowObj.action = actionDesc;
            } else if (domainKey === 'lpg_price' || domainKey === 'petrol_check') {
                rowObj.action = actionDesc;
            } else if (domainKey === 'anti_hoarding') {
                rowObj.commodity = act.commodity || '-';
                rowObj.volume = act.volumeMT || '-';
                rowObj.fir = act.fir || 'None';
                if (act.fir) isViolation = true;
            } else if (domainKey === 'fv_price') {
                let adhText = act.violation === 'non_compliant' ? 'Non-Compliant' : 'Compliant';
                if (act.violation === 'non_compliant' || parseInt(act.fineAmount) > 0 || sealedStatus !== 'No') isViolation = true;
                actionDesc = `Adherence: ${adhText}\nFine: Rs. ${act.fineAmount || 0}\nSealed/Seized: ${sealedStatus}`;
                rowObj.produce = act.produce || '-';
                rowObj.notified_rate = act.notifiedPrice ? 'Rs. ' + act.notifiedPrice : '-';
                rowObj.found_rate = act.foundPrice ? 'Rs. ' + act.foundPrice : '-';
                rowObj.action = actionDesc;
            }

            rowObj.entity_image = '';
            rowObj.evidence_image = '';

            const row = worksheet.addRow(rowObj);
            row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            row.height = 90;

            const colOffset = columns.length - 2;

            if (act.entityPhoto && act.entityPhoto.includes('base64,')) {
                try {
                    const base64Data = act.entityPhoto.split(',')[1];
                    const imageId = workbook.addImage({ base64: base64Data, extension: 'jpeg' });
                    worksheet.addImage(imageId, { tl: { col: colOffset, row: currentRowIndex - 1 }, ext: { width: 80, height: 80 }, editAs: 'oneCell' });
                } catch(e) { console.error("Error adding entity image", e); }
            }

            if (act.photo && act.photo.includes('base64,')) {
                try {
                    const base64Data = act.photo.split(',')[1];
                    const imageId = workbook.addImage({ base64: base64Data, extension: 'jpeg' });
                    worksheet.addImage(imageId, { tl: { col: colOffset + 1, row: currentRowIndex - 1 }, ext: { width: 80, height: 80 }, editAs: 'oneCell' });
                } catch(e) { console.error("Error adding inspection evidence", e); }
            }

            row.eachCell((cell) => {
                cell.font = Object.assign(cell.font || {}, { name: 'Instrument Sans', size: 12 });
                cell.border = { top: {style:'thin', color: {argb:'FFCBD5E1'}}, left: {style:'thin', color: {argb:'FFCBD5E1'}}, bottom: {style:'thin', color: {argb:'FFCBD5E1'}}, right: {style:'thin', color: {argb:'FFCBD5E1'}} };
                const isEven = row.number % 2 === 0;
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF8FAFC' : 'FFFFFFFF' } };
            });

            if (isViolation) {
                let actionCellName = 'action';
                if (domainKey === 'anti_hoarding') actionCellName = 'fir';
                const actionCell = row.getCell(actionCellName);
                if (actionCell) {
                    actionCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } };
                    actionCell.font = { name: 'Instrument Sans', bold: true, color: { argb: 'FFBE123C' } };
                }
            }

            currentRowIndex++;
        }

        if (exportedRowsCount === 0) return alert("No activities found for the selected date range.");

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        
        let filename = `${domainKey}_Report_${new Date().toISOString().slice(0,10)}`;
        if (fromDateStr && toDateStr) filename += `_(${fromDateStr}_to_${toDateStr})`;
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


// --- NAVIGATION & DASHBOARD LOGIC ---
// --- NAVIGATION & DASHBOARD LOGIC ---
const homeView = document.getElementById('home-view');
const mapView = document.getElementById('map-view');
const dashView = document.getElementById('dashboard-view');
const notifView = document.getElementById('notifications-view');
const btnHome = document.getElementById('nav-home-btn');
const btnMap = document.getElementById('nav-map-btn');
const btnDash = document.getElementById('nav-dashboard-btn');
const btnNotif = document.getElementById('nav-notifications-btn');

const btnGlobalAdmin = document.getElementById('nav-global-admin-btn');
const btnDomainAdmin = document.getElementById('nav-domain-admin-btn');
const globalAdminView = document.getElementById('global-admin-view');
const domainAdminView = document.getElementById('domain-admin-view');
const instructionsView = document.getElementById('instructions-view');
const btnInstructions = document.getElementById('nav-instructions-btn');
const chatView = document.getElementById('chat-view');

const domainNav = document.getElementById('domain-nav');
const activeDomainLabel = document.getElementById('active-domain-label');

const domainNames = {
    'wholesale_price': 'Wholesale Checking',
    'retail_price': 'Essential Retail',
    'fv_price': 'Fruits & Vegetables',
    'lpg_price': 'LPG Gas Price',
    'petrol_check': 'Petrol Quantity',
    'anti_hoarding': 'Anti-Hoarding',
    'anti_encroachment': 'Anti-Encroachment',
    'tobacco_enforcement': 'Tobacco Enforcement'
};

window.currentDomain = null; // Track which domain is active

// Handle Domain Selection from Home View
document.querySelectorAll('.domain-card').forEach(card => {
    card.addEventListener('click', function() {
        window.currentDomain = this.getAttribute('data-domain');
        const domainName = domainNames[window.currentDomain] || 'Domain';
        activeDomainLabel.innerText = domainName;
        
        const titleEl = document.getElementById('map-panel-title');
        if (titleEl) titleEl.innerText = domainName + " Map";
        
        const descEl = document.getElementById('map-panel-desc');
        if (descEl) {
            if (window.currentDomain === 'tobacco_enforcement') descEl.innerText = "Track illicit cigarette sales and FBR raids.";
            else if (window.currentDomain === 'wholesale_price') descEl.innerText = "Monitor flour mills and wholesale pricing.";
            else if (window.currentDomain === 'retail_price') descEl.innerText = "Monitor retail stores for essential commodities.";
            else if (window.currentDomain === 'fv_price') descEl.innerText = "Track fruit & vegetable retail prices.";
            else if (window.currentDomain === 'lpg_price') descEl.innerText = "Monitor LPG gas retail outlets.";
            else if (window.currentDomain === 'petrol_check') descEl.innerText = "Inspect petrol pumps for quantity/quality.";
            else if (window.currentDomain === 'anti_hoarding') descEl.innerText = "Track godowns and hoarding raids.";
            else if (window.currentDomain === 'anti_encroachment') descEl.innerText = "Monitor reclaimed land and state property.";
            else descEl.innerText = "Your transparent digital map is permanently locked into place.";
        }

        const btnAddActivity = document.getElementById('add-activity-btn');
        if (btnAddActivity) {
            if (window.currentDomain === 'wholesale_price') btnAddActivity.innerText = "🏪 Register Flour Mill at Current Location";
            else if (window.currentDomain === 'retail_price') btnAddActivity.innerText = "🏪 Register Retail Store at Current Location";
            else if (window.currentDomain === 'lpg_price') btnAddActivity.innerText = "🔥 Register LPG Outlet at Current Location";
            else if (window.currentDomain === 'petrol_check') btnAddActivity.innerText = "⛽ Register Petrol Pump at Current Location";
            else if (window.currentDomain === 'fv_price') btnAddActivity.innerText = "🍎 Register Stall/Shop at Current Location";
            else if (window.currentDomain === 'anti_hoarding') btnAddActivity.innerText = "➕ Register Godown / Storage at this location";
            else if (window.currentDomain === 'tobacco_enforcement') btnAddActivity.innerText = "➕ Register Tobacco Shop at Current Location";
            else btnAddActivity.innerText = "➕ Log Activity at Current Location";
        }
        
        // Re-initialize listeners for the new domain
        if (typeof window.initLiveShopsSync === 'function') window.initLiveShopsSync();
        
        // Show Domain Navigation Bar
        if(domainNav) domainNav.style.display = 'flex';
        
        // Go to Map View automatically when a domain is selected
        btnMap.click();
        
        // Render shops specifically for this domain
        if (typeof renderShops === 'function') renderShops();
    });
});

function hideAllViews() {
    try {
        if (homeView) homeView.style.display = 'none';
        if (mapView) mapView.style.display = 'none';
        if (dashView) dashView.style.display = 'none';
        if (notifView) notifView.style.display = 'none';
        
        if (globalAdminView) globalAdminView.style.display = 'none'; 
        if (domainAdminView) domainAdminView.style.display = 'none'; 
        
        if (instructionsView) instructionsView.style.display = 'none';
        if (chatView) chatView.style.display = 'none';
        
        if (btnHome) btnHome.classList.remove('active');
        if (btnMap) btnMap.classList.remove('active');
        if (btnDash) btnDash.classList.remove('active');
        if (btnNotif) btnNotif.classList.remove('active');
        if (btnGlobalAdmin) btnGlobalAdmin.classList.remove('active');
        if (btnDomainAdmin) btnDomainAdmin.classList.remove('active');
        if (btnInstructions) btnInstructions.classList.remove('active');
        
        // Garbage Collection: Clear memory-heavy base64 photo caches when navigating away
        if (window.photoCache) window.photoCache = {};
        if (window.compressedRaidPhotosArray) window.compressedRaidPhotosArray = [];
    } catch (e) {
        console.error("hideAllViews crash:", e);
    }
}

if (btnHome) {
    btnHome.addEventListener('click', () => {
        hideAllViews();
        window.currentDomain = null;
        if(domainNav) domainNav.style.display = 'none';
        if (homeView) homeView.style.display = 'flex';
        btnHome.classList.add('active');
    });
}

btnMap.addEventListener('click', () => {
    hideAllViews();
    mapView.style.display = 'block';
    btnMap.classList.add('active');
    setTimeout(() => { map.invalidateSize(); }, 150);
});

btnDash.addEventListener('click', () => {
    hideAllViews();
    dashView.style.display = 'block';
    btnDash.classList.add('active');
    renderDashboard();
});

if (btnNotif) {
    btnNotif.addEventListener('click', () => {
        hideAllViews();
        document.getElementById('notifications-view').style.display = 'block';
        btnNotif.classList.add('active');
        if (typeof window.renderAmendmentsFeed === 'function') window.renderAmendmentsFeed();
    });
}

if (btnGlobalAdmin) {
    btnGlobalAdmin.addEventListener('click', () => {
        hideAllViews();
        window.currentDomain = null; // Exit domain context
        if(domainNav) domainNav.style.display = 'none';
        globalAdminView.style.display = 'block';
        btnGlobalAdmin.classList.add('active');
        if (typeof renderGlobalAdminConsole === 'function') window.renderGlobalAdminConsole();
    });
}

if (btnDomainAdmin) {
    btnDomainAdmin.addEventListener('click', () => {
        hideAllViews();
        domainAdminView.style.display = 'block';
        btnDomainAdmin.classList.add('active');
        if (typeof renderDomainAdminConsole === 'function') window.renderDomainAdminConsole();
    });
}

window.approveOfficer = async function(uid) {
    try {
        const userDoc = window.fbDoc(window.firebaseDB, "users", uid);
        await window.fbSetDoc(userDoc, { status: "approved" }, { merge: true });
        alert("Officer account officially approved!");
    } catch (e) {
        alert("Error approving officer: " + e.message);
    }
};

window.suspendOfficer = async function(uid) {
    if (confirm("Are you sure you want to suspend this officer? They will lose all access immediately.")) {
        try {
            const userDoc = window.fbDoc(window.firebaseDB, "users", uid);
            await window.fbSetDoc(userDoc, { status: "suspended" }, { merge: true });
        } catch (e) {
            alert("Error suspending officer: " + e.message);
        }
    }
};

window.renderGlobalAdminConsole = function() {
    // Only fetch/update if needed, mostly handled by the snapshots in initAdminConsole
};

window.renderDomainAdminConsole = function() {
    const title = document.getElementById('domain-audit-title');
    if (title) {
        title.innerText = window.currentDomain ? domainNames[window.currentDomain] + " Audit Console" : "Domain Audit Console (Select Domain)";
    }
    
    // Build Domain Specific Leaderboard
    const toolsContainer = document.getElementById('domain-audit-tools');
    if (!toolsContainer) return;
    
    if (!window.currentDomain) {
        toolsContainer.innerHTML = '<p style="color:#64748b;">Please select a domain from the Home screen first.</p>';
        return;
    }

    function extractActivities(entitiesArray) {
        let acts = [];
        entitiesArray.forEach(ent => {
            if (!ent.deleted && ent.activities) {
                ent.activities.forEach(a => acts.push({ ...a, targetName: ent.name, entityId: ent.id }));
            }
        });
        return acts;
    }

    let domainLogs = [];
    if (window.currentDomain === 'wholesale_price') domainLogs = extractActivities(wholesaleEntities);
    else if (window.currentDomain === 'retail_price') domainLogs = extractActivities(retailEntities);
    else if (window.currentDomain === 'fv_price') domainLogs = extractActivities(fvEntities);
    else if (window.currentDomain === 'lpg_price') domainLogs = extractActivities(lpgEntities);
    else if (window.currentDomain === 'petrol_check') domainLogs = extractActivities(petrolEntities);
    else if (window.currentDomain === 'anti_hoarding') domainLogs = hoardingLogs;
    else if (window.currentDomain === 'anti_encroachment') domainLogs = encroachmentLogs;
    else if (window.currentDomain === 'tobacco_enforcement') {
        // Special case for tobacco
        let tbLogs = [];
        shops.forEach(s => {
            if(!s.deleted && s.raids) {
                s.raids.forEach(r => tbLogs.push({ officer: r.officer, type: 'raid' }));
            }
        });
        domainLogs = tbLogs;
    }

    let officerCounts = {};
    domainLogs.forEach(log => {
        let off = log.officer || 'Unknown';
        officerCounts[off] = (officerCounts[off] || 0) + 1;
    });

    let leaderboardArr = Object.keys(officerCounts).map(k => ({ name: k, count: officerCounts[k] }));
    leaderboardArr.sort((a,b) => b.count - a.count);

    let html = `
        <h2 style="color:#6ee7b7; margin-bottom:15px; font-size:1.2rem;">${domainNames[window.currentDomain]} Top Performers</h2>
        <div style="background:#1c5629; border-radius:8px; overflow:hidden; border:1px solid #1c5629;">
            <table style="width:100%; border-collapse:collapse; text-align:left;">
                <thead style="background:#1c5629;">
                    <tr>
                        <th style="padding:12px 15px; color:#f8fafc;">Officer Name</th>
                        <th style="padding:12px 15px; color:#f8fafc;">Operations Logged</th>
                    </tr>
                </thead>
                <tbody>
                    ${leaderboardArr.length === 0 ? '<tr><td colspan="2" style="padding:15px; color:#64748b; text-align:center;">No operations logged yet.</td></tr>' : 
                      leaderboardArr.map(o => `
                        <tr style="border-bottom:1px solid #047857;">
                            <td style="padding:12px 15px;"><strong>${o.name}</strong></td>
                            <td style="padding:12px 15px; color:#3b82f6; font-weight:bold;">${o.count}</td>
                        </tr>
                      `).join('')}
                </tbody>
            </table>
        </div>
    `;
    toolsContainer.innerHTML = html;
};

window.initAdminConsole = function() {
    // 1. Listen to Users Collection for Approval Queue & Global Leaderboard
    const usersRef = window.fbCollection(window.firebaseDB, "users");
    window.fbOnSnapshot(usersRef, (snapshot) => {
        const approvalList = document.getElementById('admin-approval-list');
        const leaderboardBody = document.getElementById('admin-leaderboard-body');
        
        let pendingHTML = '';
        let leaderboardHTML = '';
        
        snapshot.forEach(docSnap => {
            const u = docSnap.data();
            
            // Pending Users
            if (u.status === 'pending') {
                pendingHTML += `
                    <div style="background:#064e3b; padding:15px; border-radius:8px; border:1px solid #047857; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <h4 style="margin:0; color:#f8fafc; font-size:1.1rem;">${u.name}</h4>
                            <p style="margin:0; color:#94a3b8; font-size:0.85rem;">${u.designation} | Email: ${u.email}</p>
                        </div>
                        <button class="primary-btn" style="width:auto; margin:0; background:#059669;" onclick="window.approveOfficer('${u.uid}')">✅ Approve Access</button>
                    </div>
                `;
            }
            
            // Leaderboard Generation
            if (u.status !== 'pending' && u.role !== 'admin') {
                // Calculate cross-domain activity score
                let activityScore = 0;
                
                // Tobacco
                shops.forEach(s => {
                    if (!s.deleted && s.createdBy === u.name) activityScore += 2; // Profile = 2 pts
                    if (s.raids) {
                        s.raids.forEach(r => { if(r.officer === u.name) activityScore += 5; }); // Raid = 5 pts
                    }
                });
                
                // Extract activities from entities
                function getNested(entitiesArray) {
                    let acts = [];
                    entitiesArray.forEach(ent => {
                        if (!ent.deleted && ent.activities) {
                            ent.activities.forEach(a => acts.push(a));
                        }
                    });
                    return acts;
                }
                
                // Other domains
                let otherLogs = [
                    ...getNested(wholesaleEntities),
                    ...getNested(retailEntities),
                    ...getNested(lpgEntities),
                    ...getNested(petrolEntities),
                    ...getNested(fvEntities),
                    ...hoardingLogs,
                    ...encroachmentLogs
                ];
                otherLogs.forEach(log => {
                    if (log.officer === u.name) activityScore += 5; // Operation = 5 pts
                });
                
                let statusBadge = u.status === 'approved' ? '<span style="color:#059669; font-weight:bold;">Active</span>' : '<span style="color:#ef4444; font-weight:bold;">Suspended</span>';
                let actionBtn = u.status === 'approved' ? `<button style="background:transparent; border:none; color:#ef4444; cursor:pointer;" onclick="window.suspendOfficer('${u.uid}')">Suspend</button>` : `<button style="background:transparent; border:none; color:#059669; cursor:pointer;" onclick="window.approveOfficer('${u.uid}')">Restore</button>`;
                actionBtn += `<br><button style="background:transparent; border:none; color:#a855f7; cursor:pointer; margin-top:5px; font-weight:bold;" onclick="window.forceRetraining('${u.uid}')">🎓 Force Retraining</button>`;
                
                leaderboardHTML += `
                    <tr style="border-bottom:1px solid #047857;">
                        <td style="padding:12px 15px;">
                            <strong>${u.name}</strong><br>
                            <span style="font-size:0.75rem; color:#94a3b8;">${u.designation}</span>
                        </td>
                        <td style="padding:12px 15px;">${statusBadge}<br>${actionBtn}</td>
                        <td style="padding:12px 15px; color:#10b981; font-weight:bold;">${activityScore} pts</td>
                    </tr>
                `;
            }
        });
        
        if (approvalList) approvalList.innerHTML = pendingHTML === '' ? '<p style="color:#64748b;">No pending approvals.</p>' : pendingHTML;
        if (leaderboardBody) leaderboardBody.innerHTML = leaderboardHTML === '' ? '<tr><td colspan="3" style="padding:15px; text-align:center; color:#64748b;">No active officers found.</td></tr>' : leaderboardHTML;
    });

    // 2. Render Deleted Shops Archive (Admin Override)
    function renderDeletedArchive() {
        const archiveDiv = document.getElementById('admin-deleted-archive');
        if (!archiveDiv) return;
        let archiveHTML = '';
        shops.forEach(s => {
            if (s.deleted) {
                archiveHTML += `
                    <div style="background:#450a0a; padding:15px; border-radius:8px; border:1px solid #7f1d1d; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <h4 style="margin:0; color:#fca5a5; font-size:1.1rem;">${s.name}</h4>
                            <p style="margin:2px 0 0; color:#f87171; font-size:0.85rem;">Deleted by: <strong>${s.deletedBy}</strong></p>
                            <p style="margin:2px 0 0; color:#fca5a5; font-size:0.85rem;">Reason: <em>"${s.deletedReason || 'No reason provided'}"</em></p>
                            <p style="margin:2px 0 0; color:#991b1b; font-size:0.75rem;">Time: ${s.deletedAt}</p>
                        </div>
                        <button class="primary-btn" style="width:auto; margin:0; background:#ef4444;" onclick="window.restoreShop('${s.id}')">🔄 Restore Shop</button>
                    </div>
                `;
            }
        });
        archiveDiv.innerHTML = archiveHTML === '' ? '<p style="color:#64748b;">No shops have been deleted.</p>' : archiveHTML;
    }
    renderDeletedArchive();
    window.refreshDeletedArchive = renderDeletedArchive;

    // 3. Listen to Live Activity Feed (Domain Audit Console)
    const feedDiv = document.getElementById('admin-activity-feed');
    
    window.renderLocalActivityFeed = function() {
        if (!feedDiv) return;
        let activities = [...localAuditLogs];
        
        let lastAdminView = parseInt(localStorage.getItem('lastAdminView') || '0');
        let unreadActivities = 0;
        
        activities.forEach(act => {
            if (act.timestamp > lastAdminView) unreadActivities++;
        });
        const badge = document.getElementById('notif-admin-badge');
        if (badge) {
            if (unreadActivities > 0 && (domainAdminView && domainAdminView.style.display !== 'block') && (globalAdminView && globalAdminView.style.display !== 'block')) {
                badge.innerText = unreadActivities;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
        activities.sort((a,b) => b.timestamp - a.timestamp); // Newest first
        
        let feedHTML = '';
        activities.slice(0, 50).forEach(act => {
            // Filter feed if a domain is selected and the activity has a domain tag
            if (window.currentDomain && act.domain && act.domain !== window.currentDomain) return;

            let icon = '📝';
            let color = '#94a3b8'; // default
            if (act.type === 'register') { icon = '👤'; color = '#3b82f6'; }
            if (act.type === 'create_shop') { icon = '🏪'; color = '#10b981'; }
            if (act.type === 'delete_shop') { icon = '🗑️'; color = '#ef4444'; }
            if (act.type === 'restore_shop') { icon = '🔄'; color = '#f59e0b'; }
            if (act.type === 'log_raid') { icon = '🚨'; color = '#8b5cf6'; }
            if (act.type === 'edit_raid') { icon = '✏️'; color = '#06b6d4'; }
            
            let officerDisplay = `<strong style="color:${color};">${act.officer}</strong>`;
            let actionBtn = '';
            if (act.officerUid) {
                officerDisplay = `<a href="#" onclick="window.viewOfficerProfile('${act.officerUid}'); return false;" style="color:${color}; font-weight:bold; text-decoration:underline; cursor:pointer;">${act.officer}</a>`;
                let safeDetails = act.details.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, "&quot;").replace(/\n/g, "\\n").replace(/\r/g, "");
                actionBtn = `<button class="raid-action-btn edit-btn" style="margin-top:5px; padding:4px 10px; font-size:0.75rem; color:white; background:#059669; border:1px solid #10b981; border-radius:4px; font-weight:bold; cursor:pointer;" onclick="window.openChatWithOfficer('${act.officerUid}', '${act.officer}', '${safeDetails}')">💬 Send Message</button>`;
            }

            feedHTML += `
                <div style="border-left: 3px solid ${color}; padding-left:10px; margin-bottom:10px;">
                    <p style="margin:0; font-size:0.9rem; color:#e2e8f0;">${icon} ${officerDisplay} ${act.details}</p>
                    <p style="margin:0; font-size:0.7rem; color:#64748b;">${act.dateString}</p>
                    ${actionBtn}
                </div>
            `;
        });
        
        if (feedHTML === '') feedHTML = '<p style="color:#64748b; text-align:center;">No activity logged yet.</p>';
        feedDiv.innerHTML = feedHTML;
    };
};

window.jumpToShopOnMap = function(shopId) {
    btnMap.click();
    const shop = shops.find(s => s.id === shopId);
    if (shop) {
        map.setView([shop.lat, shop.lng], 18);
        window.openShopDashboard(shopId);
    }
}

// Global variables to hold context for the modal
let pendingDeSeal = { domainKey: null, entityId: null, activityId: null };

window.adminDeSealEntity = function(domainKey, entityId, activityId) {
    if (!userProfile || userProfile.status !== 'approved' || userProfile.role !== 'admin') {
        alert("Permission denied. Only Administrators can de-seal properties.");
        return;
    }
    
    pendingDeSeal = { domainKey, entityId, activityId };
    
    let targetArray = null;
    if (domainKey === 'wholesale_price') targetArray = wholesaleEntities;
    else if (domainKey === 'retail_price') targetArray = retailEntities;
    else if (domainKey === 'fv_price') targetArray = fvEntities;
    else if (domainKey === 'lpg_price') targetArray = lpgEntities;
    else if (domainKey === 'petrol_check') targetArray = petrolEntities;
    
    let entity = targetArray ? targetArray.find(e => e.id === entityId) : null;
    
    if (entity && entity.vendorType === 'Stall') {
        document.getElementById('deseal-modal-title').innerText = "Release Confiscated Stall";
        document.getElementById('deseal-submit-btn').innerText = "Confirm Release";
    } else {
        document.getElementById('deseal-modal-title').innerText = "De-Seal Entity";
        document.getElementById('deseal-submit-btn').innerText = "Confirm De-Seal";
    }
    
    // Reset and show modal
    document.getElementById('deseal-datetime').value = new Date().toLocaleString();
    document.getElementById('deseal-reason-select').value = "";
    document.getElementById('deseal-other-input').value = "";
    document.getElementById('deseal-other-container').style.display = 'none';
    
    document.getElementById('deseal-modal').style.display = 'flex';
}

document.addEventListener('DOMContentLoaded', () => {
    const desealBtn = document.getElementById('deseal-submit-btn');
    if(desealBtn) {
        desealBtn.addEventListener('click', async () => {
            const { domainKey, entityId, activityId } = pendingDeSeal;
            if (!domainKey || !entityId || !activityId) return;
            
            const desealTimeStr = document.getElementById('deseal-datetime').value.trim();
            if (!desealTimeStr) {
                alert("Please enter a valid date and time.");
                return;
            }
            
            const reasonSelect = document.getElementById('deseal-reason-select').value;
            if (!reasonSelect) {
                alert("Please select a reason for de-sealing.");
                return;
            }
            
            let desealReason = reasonSelect;
            if (reasonSelect === "Other") {
                const otherReason = document.getElementById('deseal-other-input').value.trim();
                if (!otherReason) {
                    alert("Please specify the other reason.");
                    return;
                }
                desealReason = otherReason;
            }
            
            document.getElementById('deseal-modal').style.display = 'none';
            
            try {
                let colName = "";
                let entities = [];
                if (domainKey === 'wholesale_price') { colName = "wholesale_entities"; entities = wholesaleEntities; }
                else if (domainKey === 'retail_price') { colName = "retail_entities"; entities = retailEntities; }
                else if (domainKey === 'lpg_price') { colName = "lpg_entities"; entities = lpgEntities; }
                else if (domainKey === 'petrol_check') { colName = "petrol_entities"; entities = petrolEntities; }
                else if (domainKey === 'anti_hoarding') { colName = "hoarding_entities"; entities = hoardingEntities; }
                else if (domainKey === 'fv_price') { colName = "fv_entities"; entities = fvEntities; }

                let entity = entities.find(e => e.id === entityId);
                if (!entity || !entity.activities) return alert("Entity or activities not found.");

                let activityIndex = entity.activities.findIndex(a => a.id === activityId);
                if (activityIndex === -1) return alert("Activity not found.");

                entity.activities[activityIndex].isSealed = false;
                entity.activities[activityIndex].desealedAt = desealTimeStr;
                entity.activities[activityIndex].desealReason = desealReason;

                if (typeof renderDashboard === 'function') renderDashboard();
                if (window.activeEntity && window.activeEntity.id === entityId) window.openEntityDashboard(entityId, domainKey);

                const docRef = window.fbDoc(window.firebaseDB, colName, entityId);
                await window.fbSetDoc(docRef, entity, { merge: true });
                
                // Push Notification to all
                if (typeof window.pushNotification === 'function') {
                    let actionWord = "De-Sealed";
                    if (entity && entity.vendorType === 'Stall') actionWord = "Released";
                    await window.pushNotification(domainKey, entityId, "An Admin has " + actionWord + " " + (entity.name || entity.ownerName) + " (Reason: " + desealReason + ")");
                }
                
                if (typeof window.logActivity === 'function') window.logActivity(domainKey, "Admin", "de-sealed entity (ID: " + entityId + "). Reason: " + desealReason);
                alert("Entity De-Sealed Successfully.");
            } catch (e) {
                alert("Error de-sealing: " + e.message);
            }
        });
    }
});

function renderDashboard() {
    const container = document.getElementById('dashboard-dynamic-content');
    if (!container) return;
    
    let html = '';
    const isAdmin = userProfile && userProfile.role === 'admin';

    if (window.currentDomain === 'tobacco_enforcement' || !window.currentDomain) {
        let totalShops = shops.length;
        let totalRaids = 0;
        let totalPackets = 0;
        let allRaids = [];
        let shopListHTML = '';

        shops.forEach(shop => {
            if (shop.deleted) return;
            let shopRaids = shop.raids ? shop.raids.length : 0;
            let shopPackets = 0;
            if (shop.raids) {
                shop.raids.forEach(r => {
                    totalRaids++;
                    let pkts = parseInt(r.packets) || 0;
                    shopPackets += pkts;
                    totalPackets += pkts;
                    allRaids.push({ shopName: shop.name, date: r.date, time: r.time, packets: pkts, officer: r.officer, sortTime: new Date(r.date.split('/').reverse().join('-') + 'T' + r.time).getTime() });
                });
            }
            shopListHTML += `
                <div class="shop-dir-item">
                    <img src="${shop.photo || 'https://via.placeholder.com/60'}" class="shop-dir-photo">
                    <div class="shop-dir-info">
                        <h4>${shop.name}</h4>
                        <p>Owner: ${shop.owner}</p>
                        <div class="shop-dir-metrics">
                            <span style="color:#3b82f6;">Raids: ${shopRaids}</span>
                            <span style="color:#ef4444;">Confiscated: ${shopPackets} Pkts</span>
                        </div>
                    </div>
                    <button class="primary-btn" style="width:auto; padding:8px; margin:0;" onclick="jumpToShopOnMap('${shop.id}')">👁 View</button>
                </div>`;
        });

        allRaids.sort((a, b) => b.sortTime - a.sortTime);
        let timelineHTML = allRaids.length === 0 ? '<p style="color:#94a3b8;">No raids recorded yet.</p>' : allRaids.map(r => `
            <div class="timeline-item">
                <div class="timeline-time"><p style="color:#0f172a; font-weight:bold;">${r.date}</p><p>${r.time}</p></div>
                <div class="timeline-content"><h4>${r.shopName}</h4><p style="color:#ef4444; font-weight:bold;">${r.packets} Packets Seized</p><p style="font-size:0.75rem;">Officer: ${r.officer}</p></div>
            </div>`).join('');

        html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; flex-wrap:wrap; gap:10px;">
                <h3 style="margin:0;">Tobacco Enforcement Dashboard</h3>
                <button class="export-btn primary-btn" style="background: linear-gradient(135deg, #366A4F 0%, #366A4F 100%);">📥 Generate Report</button>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:15px; margin-bottom:30px;">
                <div class="metric-card"><h3>Total Shops</h3><p>${totalShops}</p></div>
                <div class="metric-card"><h3>Total Raids</h3><p>${totalRaids}</p></div>
                <div class="metric-card"><h3>Packets Confiscated</h3><p style="color:#ef4444;">${totalPackets}</p></div>
            </div>
            <h2 style="margin-bottom:15px; border-bottom:1px solid #334155; padding-bottom:5px;">Shop Directory</h2>
            <div style="display:grid; grid-template-columns:1fr; gap:15px; margin-bottom:30px;">${shopListHTML}</div>
            <h2 style="margin-bottom:15px; border-bottom:1px solid #334155; padding-bottom:5px;">Recent Raid Timeline</h2>
            <div style="display:flex; flex-direction:column; gap:10px;">${timelineHTML}</div>`;
            
    } else if (['wholesale_price', 'retail_price', 'lpg_price', 'petrol_check', 'fv_price'].includes(window.currentDomain)) {
        let entities = [];
        let title = '';
        if (window.currentDomain === 'wholesale_price') { entities = wholesaleEntities; title = "Wholesale Price Checking (Mills)"; }
        else if (window.currentDomain === 'retail_price') { entities = retailEntities; title = "Essential Commodities (Retail)"; }
        else if (window.currentDomain === 'fv_price') { entities = fvEntities; title = "Fruits & Vegetables Checking"; }
        else if (window.currentDomain === 'lpg_price') { entities = lpgEntities; title = "LPG Gas Price Control"; }
        else if (window.currentDomain === 'petrol_check') { entities = petrolEntities; title = "Petrol Pump Inspection"; }

        let allLogs = [];
        let sealedList = [];
        let totalFines = 0;
        let totalDesealed = 0;

        entities.forEach(entity => {
            if (entity.deleted) return;
            if (entity.activities) {
                entity.activities.forEach(act => {
                    allLogs.push({ ...act, targetName: entity.name, entityId: entity.id });
                    totalFines += parseInt(act.fineAmount) || 0;
                    if (act.desealedAt) totalDesealed++;
                });
                
                let sortedActs = [...entity.activities].sort((a,b) => b.timestamp - a.timestamp);
                let latestAct = sortedActs[0];
                if (latestAct && latestAct.isSealed) {
                    sealedList.push({ ...latestAct, targetName: entity.name, entityId: entity.id });
                }
            }
        });

        let totalInspections = allLogs.length;
        let totalSealed = sealedList.length;

        let currentlySealedHTML = sealedList.length === 0 ? '<p style="color:#94a3b8;">No currently sealed entities.</p>' : sealedList.map(log => `
            <div class="shop-dir-item" style="border-left:4px solid #dc2626;">
                <div class="shop-dir-info">
                    <h4>${log.targetName}</h4>
                    <p>Sealed At: ${new Date(log.sealedAt).toLocaleString()}</p>
                    <div class="shop-dir-metrics">
                        <span style="color:#ef4444;">Fine: Rs ${log.fineAmount || 0}</span>
                        <span>Officer: ${log.officer}</span>
                    </div>
                </div>
                ${isAdmin ? `<button class="primary-btn" style="width:auto; padding:8px; margin:0; background:#dc2626;" onclick="adminDeSealEntity('${window.currentDomain}', '${log.entityId}', '${log.id}')">🔓 De-Seal</button>` : ''}
            </div>`).join('');

        let sortedLogs = [...allLogs].sort((a, b) => b.timestamp - a.timestamp);
        let timelineHTML = sortedLogs.length === 0 ? '<p style="color:#94a3b8;">No inspections yet.</p>' : sortedLogs.map(log => {
            let isAdmin = window.userProfile ? window.userProfile.role === 'admin' : true;
            let canEdit = isAdmin || (window.userProfile && window.userProfile.name === log.officer);
            return `
            <div class="timeline-item">
                <div class="timeline-time"><p style="color:#0f172a; font-weight:bold;">${new Date(log.timestamp).toLocaleDateString()}</p><p>${new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p></div>
                <div class="timeline-content" style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
                    <div>
                        <h4>${log.targetName}</h4><p style="color:#ef4444; font-weight:bold;">Fine: Rs ${log.fineAmount || 0}</p><p style="font-size:0.75rem;">Officer: ${log.officer}</p>
                        ${log.photo ? `<img src="${log.photo}" onclick="if(window.openImageViewer) window.openImageViewer(this.src)" style="cursor:pointer; width:50px; height:50px; object-fit:cover; border-radius:4px; margin-top:8px; border:1px solid #cbd5e1;">` : ''}
                    </div>
                    ${'<button class="secondary-btn" style="width:auto; padding:5px 10px; font-size:0.8rem; height:fit-content; background:#1c5629; color:white; border:none; margin-bottom:4px;" onclick="viewInspection(\'' + window.currentDomain + '\', \'' + log.entityId + '\', \'' + log.id + '\')">👁️ View</button>'}
                    ${canEdit ? `<button class="secondary-btn" style="width:auto; padding:5px 10px; font-size:0.8rem; height:fit-content;" onclick="editInspection('${window.currentDomain}', '${log.entityId}', '${log.id}')">✏️ Edit</button>` : ''}
                    ${canEdit ? `<button class="secondary-btn" style="width:auto; padding:5px 10px; font-size:0.8rem; height:fit-content; background:#ef4444; color:white; border:none; margin-left:5px;" onclick="deleteInspection('${window.currentDomain}', '${log.entityId}', '${log.id}')">🗑️ Delete</button>` : ''}
                </div>
            </div>`;
        }).join('');

        let entityDirHTML = entities.length === 0 ? '<p style="color:#94a3b8;">No registered entities yet.</p>' : entities.map(entity => {
            if(entity.deleted) return '';
            return `
                <div class="shop-dir-item">
                    <img src="${entity.photo || 'https://via.placeholder.com/60'}" class="shop-dir-photo">
                    <div class="shop-dir-info">
                        <h4>${entity.name}</h4>
                        <p>Owner: ${entity.owner || 'N/A'}</p>
                        <p>Phone: ${entity.phone || 'N/A'}</p>
                        <button class="secondary-btn" style="margin-top:5px; padding:5px; width:auto; font-size:0.8rem;" onclick="window.openEntityDashboard('${entity.id}', '${window.currentDomain}')">View Profile</button>
                    </div>
                </div>`;
        }).join('');

        html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; flex-wrap:wrap; gap:10px;">
                <h3 style="margin:0;">${title} Dashboard</h3>
                <button class="export-btn primary-btn" style="background: linear-gradient(135deg, #366A4F 0%, #366A4F 100%);">📊 Generate Report</button>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:15px; margin-bottom:30px;">
                <div class="metric-card"><h3>Total Inspections</h3><p>${totalInspections}</p></div>
                <div class="metric-card"><h3>Total Fines (Rs)</h3><p style="color:#ef4444;">${totalFines}</p></div>
                <div class="metric-card"><h3>Total Sealed</h3><p style="color:#dc2626;">${totalSealed}</p></div>
                <div class="metric-card"><h3>Total De-Sealed</h3><p style="color:#10b981;">${totalDesealed}</p></div>
            </div>
            <h2 style="margin-bottom:15px; border-bottom:1px solid #334155; padding-bottom:5px;">Currently Sealed Entities</h2>
            <div style="display:grid; grid-template-columns:1fr; gap:15px; margin-bottom:30px;">${currentlySealedHTML}</div>
            <h2 style="margin-bottom:15px; border-bottom:1px solid #334155; padding-bottom:5px;">Entity Directory</h2>
            <div style="display:flex; flex-direction:column; gap:15px; margin-bottom:30px;">${entityDirHTML}</div>
            <h2 style="margin-bottom:15px; border-bottom:1px solid #334155; padding-bottom:5px;">Recent Inspections Timeline</h2>
            <div style="display:flex; flex-direction:column; gap:10px;">${timelineHTML}</div>`;
            
    } else if (['anti_hoarding', 'anti_encroachment'].includes(window.currentDomain)) {
        let logs = [];
        let title = '';
        if (window.currentDomain === 'fv_price') { logs = fvPriceLogs; title = "Fruits & Vegetables Price Check"; }
        else if (window.currentDomain === 'anti_hoarding') { logs = hoardingLogs; title = "Anti-Hoarding Operations"; }
        else if (window.currentDomain === 'anti_encroachment') { logs = encroachmentLogs; title = "Anti-Encroachment Operations"; }

        let totalOps = logs.length;
        let metric2Name = window.currentDomain === 'anti_encroachment' ? 'Approximate value of land recovered (Rs)' : 'Total Fines (Rs)';
        let metric2Val = logs.reduce((sum, log) => sum + (parseInt(log.fineAmount || log.valuePKR) || 0), 0);
        let metric3Name = window.currentDomain === 'anti_hoarding' ? "Total Vol (MT)" : "Target/Location";
        let metric3Val = window.currentDomain === 'anti_hoarding' ? logs.reduce((sum, log) => sum + (parseFloat(log.volumeMT) || 0), 0) : "-";

        let sortedLogs = [...logs].sort((a, b) => b.timestamp - a.timestamp);
        let timelineHTML = sortedLogs.length === 0 ? '<p style="color:#94a3b8;">No operations yet.</p>' : sortedLogs.map(log => `
            <div class="timeline-item">
                <div class="timeline-time"><p style="color:#0f172a; font-weight:bold;">${new Date(log.timestamp).toLocaleDateString()}</p><p>${new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p></div>
                <div class="timeline-content"><h4>${log.targetName}</h4><p style="color:#ef4444; font-weight:bold;">${log.fineAmount ? 'Fine: Rs '+log.fineAmount : (log.valuePKR ? 'Value: '+log.valuePKR+' M' : 'Recorded')}</p><p style="font-size:0.75rem;">Officer: ${log.officer}</p>
                ${log.photo ? `<img src="${log.photo}" onclick="if(window.openImageViewer) window.openImageViewer(this.src)" style="cursor:pointer; width:50px; height:50px; object-fit:cover; border-radius:4px; margin-top:8px; border:1px solid #cbd5e1;">` : ''}
                </div>
            </div>`).join('');

        html = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; flex-wrap:wrap; gap:10px;">
                <h3 style="margin:0;">${title} Dashboard</h3>
                <button class="export-btn primary-btn" style="background: linear-gradient(135deg, #366A4F 0%, #366A4F 100%);">📊 Generate Report</button>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:15px; margin-bottom:30px;">
                <div class="metric-card"><h3>Total Operations</h3><p>${totalOps}</p></div>
                <div class="metric-card"><h3>${metric2Name}</h3><p style="color:#ef4444;">${metric2Val}</p></div>
                <div class="metric-card"><h3>${metric3Name}</h3><p>${metric3Val}</p></div>
            </div>
            <h2 style="margin-bottom:15px; border-bottom:1px solid #334155; padding-bottom:5px;">Recent Operations Timeline</h2>
            <div style="display:flex; flex-direction:column; gap:10px;">${timelineHTML}</div>`;
    }

    container.innerHTML = html;
}

// Initial Render
renderShops();
renderDashboard();

// --- NOTIFICATIONS & CROPPER ENGINE ---

let cropper = null;
let currentCropCallback = null;
let currentCropInput = null;

// Universal File Input Interceptor for Image Cropping
document.addEventListener('change', function(e) {
    if (e.target.tagName === 'INPUT' && e.target.type === 'file' && e.target.accept && e.target.accept.includes('image')) {
        const file = e.target.files[0];
        if (!file) return;

        currentCropInput = e.target;
        const reader = new FileReader();
        reader.onload = function(event) {
            openCropperModal(event.target.result);
            currentCropCallback = (croppedBase64) => {
                if (e.target.id === 'raid-photo-input') {
                    // Special behavior for Raid multiple photo gallery
                    compressedRaidPhotosArray.push(croppedBase64);
                    renderRaidPhotoPreviews();
                } else {
                    // Standard behavior for single image uploads
                    window.photoCache[e.target.id] = croppedBase64;
                    
                    // Specific legacy variable mappings (for entity/shop creation)
                    if (e.target.id === 'shop-photo-input') compressedPhotoData = croppedBase64;
                    if (e.target.id === 'entity-photo-input') compressedEntityPhotoData = croppedBase64;

                    // Dynamically update the preview
                    const preview = document.getElementById(e.target.id + '-preview');
                    if (preview) {
                        preview.src = croppedBase64;
                        preview.style.display = 'block';
                    }
                }
                // Reset so user can upload the same picture again if needed
                e.target.value = '';
            };
        };
        reader.readAsDataURL(file);
    }
});

// --- AUDIT FORMATTER HELPER ---
function formatAuditKeyVal(key, value) {
    const labels = {
        fineAmount: "Fine Amount",
        sealingAction: "Sealing Action",
        isSealed: "Currently Sealed?",
        sealedAt: "Sealing Time",
        desealedAt: "De-sealed Time",
        officer: "Inspecting Officer",
        commodity: "Commodity Checked",
        notifiedPrice: "Govt Notified Price",
        foundPrice: "Found Price",
        violation: "Violation Noted?",
        name: "Entity Name",
        owner: "Owner Name",
        phone: "Phone Number",
        ownerPhone: "Owner Phone",
        shopkeeperName: "Shopkeeper Name",
        shopkeeperPhone: "Shopkeeper Phone",
        lat: "Latitude",
        lng: "Longitude",
        deleted: "Deleted Status",
        deletedBy: "Deleted By",
        deletedAt: "Deletion Time",
        lastEditedBy: "Last Edited By",
        lastEditedAt: "Last Edited Time",
        createdBy: "Created By",
        createdAt: "Creation Time",
        type: "Record Type",
        isOwnerShopkeeperSame: "Owner & Shopkeeper Same"
    };

    let readableKey = labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    let readableVal = value;

    if (key.includes('At') || key === 'timestamp' || key === 'date') {
        if (!isNaN(value) && typeof value === 'number') {
            readableVal = new Date(value).toLocaleString();
        } else if (typeof value === 'string' && value.includes('T')) {
            try { readableVal = new Date(value).toLocaleString(); } catch(e) { console.warn("Failed to parse date string:", e); }
        }
    }

    if (typeof value === 'boolean') {
        readableVal = value ? 'Yes' : 'No';
    }
    
    if (key === 'sealingAction') {
        if (value === 'none') readableVal = 'No Action Taken';
        else if (value === 'fine_only') readableVal = 'Fine Imposed';
        else if (value === 'sealed_fine') readableVal = 'Sealed with Fine';
        else if (value === 'sealed_pending') readableVal = 'Sealed (Pending Payment)';
    }

    return `<div style="background: white; border: 1px solid #cbd5e1; padding: 6px 10px; border-radius: 4px; display: flex; flex-direction: column;">
        <span style="font-size: 0.65rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">${readableKey}</span>
        <span style="font-size: 0.85rem; color: #0f172a; font-weight: 500;">${readableVal}</span>
    </div>`;
}

// The Activity Tab Logic (Changes & Amendments)
window.renderAmendmentsFeed = function() {
    const isAdmin = window.userProfile ? window.userProfile.role === 'admin' : true; // Default admin if offline
    if (!isAdmin) {
        document.getElementById('amendments-header').style.display = 'none';
        document.getElementById('amendments-denied').style.display = 'block';
        document.getElementById('notifications-list').innerHTML = '';
        return;
    }

    document.getElementById('amendments-header').style.display = 'block';
    document.getElementById('amendments-denied').style.display = 'none';
    
    const list = document.getElementById('notifications-list');
    
    // Filter only edit/delete events
    const auditTypes = ['edit_entity', 'edit_inspection', 'edit_shop', 'edit_raid', 'delete_entity', 'delete_shop', 'delete_raid', 'delete_inspection'];
    let amendments = localAuditLogs.filter(log => auditTypes.includes(log.type));
    amendments.sort((a,b) => b.timestamp - a.timestamp); // Newest first

    if (amendments.length === 0) {
        list.innerHTML = '<p style="color:#64748b; text-align:center;">No changes or amendments have been logged yet.</p>';
        return;
    }

    let html = '';
    
    const domainSections = [
        { key: 'tobacco_enforcement', title: '🚭 Tobacco Enforcement' },
        { key: 'wholesale_price', title: '🏭 Wholesale Price Checking' },
        { key: 'retail_price', title: '🏪 Essential Retail Checking' },
        { key: 'fv_price', title: '🍎 F&V Price Checking' },
        { key: 'lpg_price', title: '⛽ LPG Gas Price Checking' },
        { key: 'petrol_check', title: '🛢️ Petrol Pump Checking' },
        { key: 'anti_hoarding', title: '📦 Anti Hoarding Operations' },
        { key: 'anti_encroachment', title: '🚧 Anti Encroachment Operations' },
        { key: 'uncategorized', title: '📁 Uncategorized Logs' }
    ];

    domainSections.forEach(section => {
        let sectionLogs = amendments.filter(log => {
            let logDomain = log.domain;
            if (!logDomain) {
                if (['edit_shop', 'delete_shop', 'edit_raid', 'delete_raid'].includes(log.type)) logDomain = 'tobacco_enforcement';
                else if (log.type === 'fv_price' || (log.details && log.details.includes('F&V'))) logDomain = 'fv_price';
                else if (log.type === 'anti_encroachment' || (log.details && log.details.includes('encroachment'))) logDomain = 'anti_encroachment';
                else if (log.details && log.details.toLowerCase().includes('mill')) logDomain = 'wholesale_price';
                else logDomain = 'uncategorized';
            }
            return logDomain === section.key;
        });

        if (sectionLogs.length === 0) {
            html += `
            <div style="margin-bottom: 25px;">
                <h3 style="color:#0f172a; margin-bottom:10px; border-bottom:2px solid #cbd5e1; padding-bottom:5px; font-size:1.1rem;">${section.title}</h3>
                <p style="color:#94a3b8; font-size:0.9rem; margin-left:10px;">No changes or amendments in this domain.</p>
            </div>`;
            return;
        }

        html += `<div style="margin-bottom: 30px;">
            <h3 style="color:#0f172a; margin-bottom:15px; border-bottom:2px solid #94a3b8; padding-bottom:5px; font-size:1.1rem;">${section.title}</h3>
            <div style="display:flex; flex-direction:column; gap:15px;">`;

        sectionLogs.forEach(log => {
            let beforeStateHtml = '<p style="font-size:0.8rem; color:#64748b; margin-top:5px;"><em>Prior state details unavailable.</em></p>';
            if (log.priorState) {
                let detailsObj = Object.assign({}, log.priorState);
                delete detailsObj.photo; 
                delete detailsObj.activities;
                delete detailsObj.raids;
                delete detailsObj.timestamp;
                delete detailsObj.id;
                
                let priorDetailsHtml = Object.entries(detailsObj)
                    .filter(([k,v]) => v !== undefined && v !== null && v !== '')
                    .map(([k, v]) => formatAuditKeyVal(k, v))
                    .join('');
                    
                beforeStateHtml = `<div style="margin-top:12px; padding:12px; background:#f8fafc; border-left:3px solid #64748b; border-radius:6px;">
                    <strong style="color:#334155; font-size:0.85rem; margin-bottom:8px; display:block;">Prior State Data Snapshot:</strong>
                    <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px;">
                        ${priorDetailsHtml || '<span style="color:#94a3b8; font-size:0.8rem;">Empty Record</span>'}
                    </div>
                </div>`;
            }

            let reasonHtml = '';
            if (log.amendmentReason) {
                reasonHtml = `<div style="margin-top:10px; padding:8px 12px; background:#fffbeb; border-left:3px solid #fbbf24; border-radius:4px; font-size:0.85rem; color:#92400e;">
                    <strong>Reason for Amendment:</strong> ${log.amendmentReason}
                </div>`;
            }

            html += `
                <div style="background:white; padding:15px; border-radius:8px; border-left:4px solid #f59e0b; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <h4 style="margin:0; font-size:1rem; color:#1e293b;">${
                            log.type.includes('delete') ? '🗑️ Deletion Event' :
                            log.type.includes('edit') ? '📝 Edit/Amendment' : 'Audit Log'
                        }</h4>
                        <span style="font-size:0.75rem; color:#94a3b8;">${new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <p style="margin:5px 0 0; font-size:0.9rem; color:#334155;"><strong>${log.officer}</strong> ${log.details}</p>
                    ${reasonHtml}
                    ${beforeStateHtml}
                </div>
            `;
        });
        
        html += `</div></div>`;
    });
    
    list.innerHTML = html;
};

function openCropperModal(imageSrc) {
    const cropperModal = document.getElementById('cropper-modal');
    const imageElement = document.getElementById('cropper-image');
    
    cropperModal.style.display = 'flex';
    
    if (cropper) {
        cropper.replace(imageSrc);
    } else {
        imageElement.src = imageSrc;
        cropper = new Cropper(imageElement, {
            aspectRatio: 1, // FORCE 1:1 SQUARE
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 1,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
        });
    }
}

document.getElementById('cancel-crop-btn').addEventListener('click', () => {
    document.getElementById('cropper-modal').style.display = 'none';
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    if (currentCropInput) {
        currentCropInput.value = ""; // Allow re-selecting the same file if user cancelled
        currentCropInput = null;
    }
    currentCropCallback = null;
});

document.getElementById('confirm-crop-btn').addEventListener('click', () => {
    if (!cropper) return;
    
    // Get cropped canvas
    const canvas = cropper.getCroppedCanvas({
        width: 400, // Standardize physical size to 400x400
        height: 400
    });
    
    const croppedBase64 = canvas.toDataURL('image/jpeg', 0.6); // Slightly higher quality for square
    
    document.getElementById('cropper-modal').style.display = 'none';
    cropper.destroy();
    cropper = null;
    currentCropInput = null;
    
    if (currentCropCallback) {
        currentCropCallback(croppedBase64);
    }
});

// --- USER PROFILE & SYNCHRONIZATION LOGIC ---
const profileModal = document.getElementById('user-profile-modal');
document.getElementById('nav-profile-btn').addEventListener('click', () => {
    if (userProfile) {
        document.getElementById('prof-name').innerText = userProfile.name;
        document.getElementById('prof-designation').innerText = userProfile.designation;
        document.getElementById('prof-doj').innerText = userProfile.doj || 'N/A';
        document.getElementById('prof-reporting').innerText = userProfile.reporting || 'N/A';
        document.getElementById('prof-dob').innerText = userProfile.dob || 'N/A';
    }
    profileModal.style.display = 'flex';
});

// About / Credits button
const navAboutBtn = document.getElementById('nav-about-btn');
if (navAboutBtn) {
    navAboutBtn.addEventListener('click', () => {
        document.getElementById('about-modal').style.display = 'flex';
    });
}

// EDIT PROFILE LOGIC
const editProfileModal = document.getElementById('edit-profile-modal');
document.getElementById('edit-profile-modal-btn').addEventListener('click', () => {
    if (!userProfile) return;

    // Check Cooling Period
    if (userProfile.lastProfileEditAt && userProfile.role !== 'admin') {
        const lastEdit = new Date(userProfile.lastProfileEditAt).getTime();
        const now = Date.now();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        const timePassed = now - lastEdit;
        
        if (timePassed < thirtyDaysMs) {
            const daysLeft = Math.ceil((thirtyDaysMs - timePassed) / (1000 * 60 * 60 * 24));
            const msgEl = document.getElementById('edit-profile-cooldown-msg');
            msgEl.innerText = `SECURITY LOCK: You cannot edit your profile for another ${daysLeft} days.`;
            msgEl.style.display = 'block';
            document.getElementById('edit-profile-form').style.display = 'none';
        } else {
            document.getElementById('edit-profile-cooldown-msg').style.display = 'none';
            document.getElementById('edit-profile-form').style.display = 'block';
        }
    } else {
        document.getElementById('edit-profile-cooldown-msg').style.display = 'none';
        document.getElementById('edit-profile-form').style.display = 'block';
    }

    document.getElementById('edit-name').value = userProfile.name || "";
    document.getElementById('edit-designation').value = userProfile.designation || "";
    document.getElementById('edit-doj').value = userProfile.doj || "";
    document.getElementById('edit-reporting').value = userProfile.reporting || "";
    document.getElementById('edit-dob').value = userProfile.dob || "";
    
    document.getElementById('user-profile-modal').style.display = 'none';
    editProfileModal.style.display = 'flex';
});

// close-edit-profile-btn removed to prevent crash

document.getElementById('save-profile-btn').addEventListener('click', async () => {
    const name = document.getElementById('edit-name').value.trim();
    const designation = document.getElementById('edit-designation').value.trim();
    const doj = document.getElementById('edit-doj').value;
    const reporting = document.getElementById('edit-reporting').value.trim();
    const dob = document.getElementById('edit-dob').value;
    
    if (!name || !designation) return alert("Name and Designation are required.");
    
    document.getElementById('save-profile-btn').innerText = "Saving...";
    try {
        const updates = {
            name, designation, doj, reporting, dob,
            lastProfileEditAt: new Date().toISOString()
        };
        if (userProfile.uid !== 'sandbox_user') {
            await window.fbSetDoc(window.fbDoc(window.firebaseDB, "users", userProfile.uid), updates, { merge: true });
        }
        
        // Update local object
        Object.assign(userProfile, updates);
        
        document.getElementById('save-profile-btn').innerText = "💾 Save Changes";
        editProfileModal.style.display = 'none';
        alert("Profile successfully updated. The 30-Day Security Lock has been activated.");
    } catch(err) {
        alert("Error saving profile.");
        document.getElementById('save-profile-btn').innerText = "💾 Save Changes";
    }
});

document.getElementById('close-profile-btn').addEventListener('click', () => {
    profileModal.style.display = 'none';
});

// --- RESET PASSWORD LOGIC ---
document.getElementById('reset-password-modal-btn').addEventListener('click', () => {
    document.getElementById('user-profile-modal').style.display = 'none';
    document.getElementById('cp-current').value = '';
    document.getElementById('cp-new').value = '';
    document.getElementById('cp-confirm').value = '';
    document.getElementById('change-password-msg').style.display = 'none';
    document.getElementById('change-password-modal').style.display = 'flex';
});

document.getElementById('submit-change-password-btn').addEventListener('click', async () => {
    const currentPw = document.getElementById('cp-current').value;
    const newPw = document.getElementById('cp-new').value;
    const confirmPw = document.getElementById('cp-confirm').value;
    const msgEl = document.getElementById('change-password-msg');
    
    if (!currentPw || !newPw || !confirmPw) {
        msgEl.innerText = "All fields are required.";
        msgEl.style.display = 'block';
        return;
    }
    
    if (newPw !== confirmPw) {
        msgEl.innerText = "New passwords do not match.";
        msgEl.style.display = 'block';
        return;
    }
    
    if (newPw.length < 6) {
        msgEl.innerText = "New password must be at least 6 characters.";
        msgEl.style.display = 'block';
        return;
    }

    const btn = document.getElementById('submit-change-password-btn');
    btn.innerText = "Updating...";
    
    try {
        // Step 1: Re-authenticate to satisfy Firebase's "requires-recent-login" rule
        const email = window.firebaseAuth.currentUser.email; 
        await window.fbSignIn(window.firebaseAuth, email, currentPw);
        
        // Step 2: Update Password
        await window.fbUpdatePassword(window.firebaseAuth.currentUser, newPw);
        
        alert("Password updated successfully!");
        document.getElementById('change-password-modal').style.display = 'none';
    } catch(e) {
        if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
            msgEl.innerText = "Incorrect current password.";
        } else {
            msgEl.innerText = "Error: " + e.message;
        }
        msgEl.style.display = 'block';
    } finally {
        btn.innerText = "Update Password";
    }
});
document.getElementById('logout-btn').addEventListener('click', () => {
    window.isLoginButtonClicked = false;
    sessionStorage.removeItem('currentSessionPassword');
    window.fbSignOut(window.firebaseAuth).then(() => {
        window.location.reload();
    });
});

// EXPORT SYNC FILE
document.getElementById('export-sync-btn').addEventListener('click', async () => {
    const payload = {
        profile: userProfile,
        shops: shops,
        exportDate: new Date().toISOString()
    };
    const jsonStr = JSON.stringify(payload, null, 2);
    
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `District_Backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Background scans are strictly managed by fbOnSnapshot listener
    
// ==========================================
// INSTRUCTIONS & MESSAGING MODULE
// ==========================================
const PROFANITY_REGEX = /\b(fuck|shit|bitch|asshole|cunt|dick|cock|pussy|slut|whore|bastard|motherfucker|porn|sex)\b/i;

let currentChatUserId = null;

// The Inbox Logic
document.getElementById('nav-instructions-btn').addEventListener('click', () => {
    hideAllViews();
    document.getElementById('instructions-view').style.display = 'block';
    if (typeof btnInstructions !== 'undefined' && btnInstructions) btnInstructions.classList.add('active');
    document.getElementById('notif-instructions-badge').style.display = 'none';
    loadInstructionsInbox();
});

// The Chat Window Logic
document.getElementById('close-chat-btn').addEventListener('click', () => {
    document.getElementById('chat-view').style.display = 'none';
    currentChatUserId = null;
    if (btnInstructions) btnInstructions.click();
});

// Global Function to Open Chat
window.openChatWithOfficer = function(targetUid, targetName, initialTag = "") {
    if (!userProfile) return;
    if (userProfile.role !== 'admin' && userProfile.uid !== targetUid) return; 
    
    currentChatUserId = targetUid;
    document.getElementById('chat-header-title').innerText = `Chat with ${targetName}`;
    
    hideAllViews();
    document.getElementById('chat-view').style.display = 'flex';
    
    const inputField = document.getElementById('chat-input-field');
    if (inputField && initialTag) {
        inputField.value = `[Re: ${initialTag}] `;
    }
    
    const messagesRef = window.fbCollection(window.firebaseDB, getCollection("instructions_log"));
    const q = window.fbQuery(messagesRef, window.fbWhere('threadId', '==', targetUid));
    
    window.fbOnSnapshot(q, (snapshot) => {
        if(currentChatUserId !== targetUid) return;
        const container = document.getElementById('chat-messages-container');
        let msgs = [];
        snapshot.forEach(doc => msgs.push(doc.data()));
        msgs.sort((a,b) => a.timestamp - b.timestamp);
        
        let html = '';
        msgs.forEach(m => {
            const isMe = m.senderUid === userProfile.uid;
            
            // Mark as read if from the other person
            if (!isMe && !m.isRead && m.id) {
                window.fbSetDoc(window.fbDoc(window.firebaseDB, getCollection("instructions_log"), m.id), { isRead: true }, { merge: true });
            }
            
            const align = isMe ? 'flex-end' : 'flex-start';
            const bg = isMe ? '#059669' : '#cbd5e1';
            const textCol = isMe ? 'white' : '#0f172a';
            html += `
                <div style="display:flex; flex-direction:column; align-items:${align}; margin-bottom:5px;">
                    <span style="font-size:0.6rem; color:#64748b; margin-bottom:2px;">${m.senderName} - ${m.timeStr}</span>
                    <div style="background:${bg}; color:${textCol}; padding:8px 12px; border-radius:12px; max-width:80%; word-wrap:break-word;">
                        ${m.text}
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
        container.scrollTop = container.scrollHeight;
    });
};

document.getElementById('chat-send-btn').addEventListener('click', async () => {
    if (!currentChatUserId) return;
    const input = document.getElementById('chat-input-field');
    const text = input.value.trim();
    if (!text) return;
    
    if (PROFANITY_REGEX.test(text)) {
        alert("SECURITY WARNING: Profanity and lewd content is strictly prohibited. Your message has been blocked.");
        input.value = "";
        return;
    }
    
    input.value = "";
    
    try {
        const messagesRef = window.fbDoc(window.fbCollection(window.firebaseDB, getCollection("instructions_log")));
        await window.fbSetDoc(messagesRef, {
            id: messagesRef.id,
            threadId: currentChatUserId,
            senderUid: userProfile.uid,
            senderName: userProfile.name,
            text: text,
            isRead: false,
            timestamp: Date.now(),
            timeStr: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        });
    } catch(e) {
        console.error("Message send failed:", e);
        alert("Failed to send message. You may be completely offline.");
    }
});

function loadInstructionsInbox() {
    if (!userProfile) return;
    
    if (userProfile.role === 'admin') {
        const btnContainer = document.getElementById('admin-new-conv-container');
        if (btnContainer) btnContainer.style.display = 'block';
    }
    
    const inbox = document.getElementById('instructions-inbox');
    const messagesRef = window.fbCollection(window.firebaseDB, getCollection("instructions_log"));
    
    window.fbOnSnapshot(messagesRef, (snapshot) => {
        let threadsMap = {};
        let unreadCount = 0;
        snapshot.forEach(doc => {
            const d = doc.data();
            if (userProfile.role !== 'admin' && d.threadId !== userProfile.uid) return;
            
            if (d.senderUid !== userProfile.uid && !d.isRead) unreadCount++;
            
            if (!threadsMap[d.threadId] || threadsMap[d.threadId].timestamp < d.timestamp) {
                threadsMap[d.threadId] = d;
            }
        });
        
        let html = '';
        Object.values(threadsMap).sort((a,b) => b.timestamp - a.timestamp).forEach(t => {
            const displayName = userProfile.role === 'admin' ? 
                (t.senderUid === userProfile.uid ? "Officer Chat" : t.senderName) : 
                "District Admin";
                
            // highlight unread thread rows
            const rowBorder = (t.senderUid !== userProfile.uid && !t.isRead) ? '4px solid #ef4444' : '4px solid #059669';
                
            html += `
                <div style="background:white; border-radius:8px; padding:15px; border-left:${rowBorder}; box-shadow:0 2px 4px rgba(0,0,0,0.05); display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <div>
                        <h3 style="margin:0; font-size:1rem;">${displayName}</h3>
                        <p style="margin:5px 0 0; font-size:0.8rem; color:#64748b; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px;">
                            ${t.senderName}: ${t.text}
                        </p>
                    </div>
                    <button class="primary-btn" style="width:auto; padding:8px 15px; margin:0; background:#059669;" onclick="openChatWithOfficer('${t.threadId}', '${displayName}')">Open Chat</button>
                </div>
            `;
        });
        
        if (html === '') html = '<p style="color:#64748b;">No instructions found.</p>';
        inbox.innerHTML = html;
        
        const badge = document.getElementById('notif-instructions-badge');
        if (badge) {
            if (unreadCount > 0) {
                badge.innerText = unreadCount;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    });
}

window.populateNewConvDropdown = async function() {
    if (!userProfile || userProfile.role !== 'admin') return;
    
    const usersRef = window.fbCollection(window.firebaseDB, "users");
    const snapshot = await window.fbGetDocs(usersRef);
    
    const select = document.getElementById('new-conv-officer-select');
    let html = '<option value="">-- Select an Officer --</option>';
    
    snapshot.forEach(docSnap => {
        const u = docSnap.data();
        if (u.role !== 'admin' && u.status === 'approved') {
            html += `<option value="${u.uid}">${u.name} (${u.designation})</option>`;
        }
    });
    
    select.innerHTML = html;
};

document.getElementById('new-conv-start-btn').addEventListener('click', () => {
    const selectEl = document.getElementById('new-conv-officer-select');
    const targetUid = selectEl.value;
    
    if (!targetUid) {
        alert("Please select an officer.");
        return;
    }
    
    const targetName = selectEl.options[selectEl.selectedIndex].text.split(' (')[0];
    const initialMsg = document.getElementById('new-conv-initial-msg').value.trim();
    
    document.getElementById('new-conversation-modal').style.display = 'none';
    
    window.openChatWithOfficer(targetUid, targetName, initialMsg);
});

// Global Function to View Officer Profile (Read-Only)
window.viewOfficerProfile = async function(uid) {
    if (!userProfile || userProfile.role !== 'admin') return;
    try {
        const userDoc = await window.fbGetDoc(window.fbDoc(window.firebaseDB, "users", uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            document.getElementById('ro-prof-name').innerText = data.name || 'N/A';
            document.getElementById('ro-prof-designation').innerText = data.designation || 'N/A';
            document.getElementById('ro-prof-doj').innerText = data.doj || 'N/A';
            document.getElementById('ro-prof-reporting').innerText = data.reportingTo || 'N/A';
            document.getElementById('ro-prof-dob').innerText = data.dob || 'N/A';
            document.getElementById('ro-prof-status').innerText = data.status === 'approved' ? 'Active' : (data.status === 'suspended' ? 'Suspended' : 'Pending');
            document.getElementById('ro-prof-status').style.color = data.status === 'approved' ? '#059669' : '#ef4444';
            
            document.getElementById('officer-profile-modal').style.display = 'flex';
        }
    } catch (e) {
        alert("Could not load profile: " + e.message);
    }
};

// ==========================================
// INTERACTIVE TRAINING / STATE MACHINE
// ==========================================
let trainingStep = 0;
window.initTrainingMachine = function() {
    if (!userProfile) return;
    
    if (userProfile.needsTraining) {
        isSandboxMode = true;
        document.getElementById('sandbox-banner').style.display = 'block';
        
        const overlay = document.getElementById('training-overlay');
        overlay.style.display = 'flex';
        
        const skipBtn = document.getElementById('training-skip-btn');
        if (userProfile.trainingMandatory) {
            skipBtn.style.display = 'none';
        } else {
            skipBtn.style.display = 'block';
        }
        
        skipBtn.onclick = async () => {
            await finishTraining();
        };
        
        updateTrainingUI();
    } else {
        loadInstructionsInbox();
    }
}

function updateTrainingUI() {
    const textEl = document.getElementById('training-step-text');
    if (trainingStep === 0) textEl.innerText = "Step 1: Click the '📍 Locate' button on the map to find your position.";
    if (trainingStep === 1) textEl.innerText = "Step 2: Click the '+' button and create a dummy shop.";
    if (trainingStep === 2) textEl.innerText = "Step 3: Click '📍 View' on your new shop, then log a dummy raid.";
}

window.trainingHookLocationFound = function() {
    if (userProfile && userProfile.needsTraining && trainingStep === 0) {
        trainingStep = 1;
        document.getElementById('training-overlay').style.display = 'none';
        alert("Excellent! Now click the '+' button to profile a new shop.");
    }
};

window.trainingHookShopCreated = function() {
    if (userProfile && userProfile.needsTraining && trainingStep === 1) {
        trainingStep = 2;
        alert("Great job! A dummy shop was created. Now click '📍 View' on that shop and log a raid.");
    }
};

window.trainingHookRaidLogged = async function() {
    if (userProfile && userProfile.needsTraining && trainingStep === 2) {
        alert("Training Complete! You are now authorized to use the live database.");
        await finishTraining();
    }
};

async function finishTraining() {
    isSandboxMode = false;
    if (userProfile.uid !== 'sandbox_user') {
        await window.fbSetDoc(window.fbDoc(window.firebaseDB, "users", userProfile.uid), {
            needsTraining: false,
            trainingMandatory: false
        }, { merge: true });
    }
    window.location.reload();
}

window.forceRetraining = async function(targetUid) {
    if (userProfile.role !== 'admin') return;
    if (confirm("Are you sure you want to force this officer to undergo Mandatory Sandbox Training?")) {
        await window.fbSetDoc(window.fbDoc(window.firebaseDB, "users", targetUid), {
            needsTraining: true,
            trainingMandatory: true
        }, { merge: true });
        alert("Mandatory retraining activated. The officer will be locked into Sandbox Mode upon next login.");
    }
};


// --- SMART SYNCHRONIZATION UI ---
function updateSyncStatusUI() {
    const statusIcon = document.getElementById('sync-status-icon');
    const container = document.getElementById('sync-status-container');
    if (!container) return;
    if (navigator.onLine) {
        statusIcon.innerHTML = '🟢 Live';
        statusIcon.style.color = '#4ade80';
    } else {
        statusIcon.innerHTML = '🟠 Offline';
        statusIcon.style.color = '#fb923c';
    }
}

window.addEventListener('online', updateSyncStatusUI);
window.addEventListener('offline', updateSyncStatusUI);

document.getElementById('force-sync-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('force-sync-btn');
    const statusIcon = document.getElementById('sync-status-icon');
    if (!navigator.onLine) {
        alert("Cannot sync: No internet connection detected.");
        return;
    }
    btn.innerHTML = '🔄 Syncing...';
    btn.disabled = true;
    statusIcon.innerHTML = '🔄 Syncing...';
    statusIcon.style.color = '#60a5fa';
    try {
        if (window.firebaseDB && window.fbDisableNetwork && window.fbEnableNetwork) {
            await window.fbDisableNetwork(window.firebaseDB);
            await window.fbEnableNetwork(window.firebaseDB);
        }
    } catch (e) {
        console.error("Force Sync Error:", e);
    } finally {
        setTimeout(() => {
            btn.innerHTML = '<span>🔁</span> Sync';
            btn.disabled = false;
            updateSyncStatusUI();
        }, 1500);
    }
});





















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
    img.style.transform = `scale(${currentZoom})`;
    
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
            img.style.transform = `scale(${currentZoom})`;
            img.style.cursor = 'zoom-in';
        });
        
        zoomOutBtn.addEventListener('click', () => {
            if (currentZoom > 0.5) currentZoom -= 0.25;
            img.style.transform = `scale(${currentZoom})`;
            img.style.cursor = 'zoom-out';
        });
        
        zoomResetBtn.addEventListener('click', () => {
            currentZoom = 1;
            img.style.transform = `scale(${currentZoom})`;
            img.style.cursor = 'zoom-in';
        });
        
        img.addEventListener('click', () => {
            currentZoom += 0.5;
            img.style.transform = `scale(${currentZoom})`;
        });
    }
});

const fs = require('fs');
let code = fs.readFileSync('public/index.html', 'utf8');

const viewerModal = `
    <!-- Global Image Viewer Modal -->
    <div id="image-viewer-modal" style="display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.9); z-index:11000; align-items:center; justify-content:center; flex-direction:column; overflow:hidden;">
        <div style="position:absolute; top:20px; right:20px; display:flex; gap:15px; z-index:11001;">
            <a id="iv-download" href="#" download="evidence_image.jpg" class="primary-btn" style="background:#1c5629; text-decoration:none;">⬇️ Download</a>
            <button onclick="document.getElementById('image-viewer-modal').style.display='none'" class="primary-btn btn-cancel" style="background:rgba(255,255,255,0.2); border:none; color:white;">✖ Close</button>
        </div>
        <div id="iv-container" style="position:relative; width:90%; height:80%; display:flex; align-items:center; justify-content:center; overflow:auto;">
            <img id="iv-image" src="" style="max-width:100%; max-height:100%; object-fit:contain; transition:transform 0.3s ease; transform-origin:center center; cursor:zoom-in;">
        </div>
        <div style="position:absolute; bottom:30px; display:flex; gap:15px; z-index:11001;">
            <button id="iv-zoom-out" class="primary-btn" style="background:rgba(255,255,255,0.2); border:none; color:white; font-size:1.2rem; width:50px; border-radius:50%;">-</button>
            <button id="iv-zoom-reset" class="primary-btn" style="background:rgba(255,255,255,0.2); border:none; color:white;">Reset</button>
            <button id="iv-zoom-in" class="primary-btn" style="background:rgba(255,255,255,0.2); border:none; color:white; font-size:1.2rem; width:50px; border-radius:50%;">+</button>
        </div>
    </div>
`;

if (!code.includes('image-viewer-modal')) {
    code = code.replace('</body>', viewerModal + '\n</body>');
    fs.writeFileSync('public/index.html', code, 'utf8');
    console.log("Added image viewer modal to index.html");
} else {
    console.log("Image viewer already exists");
}

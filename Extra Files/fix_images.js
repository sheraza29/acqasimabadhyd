const fs = require('fs');
let code = fs.readFileSync('public/app.js', 'utf8');

// Update image tags to use openImageViewer
code = code.replace(
    /\$\{act\.photo \? \`<img src="\$\{act\.photo\}" style="/g,
    '${act.photo ? `<img src="${act.photo}" onclick="if(window.openImageViewer) window.openImageViewer(this.src)" style="cursor:pointer; '
);

code = code.replace(
    /\$\{log\.photo \? \`<img src="\$\{log\.photo\}" style="/g,
    '${log.photo ? `<img src="${log.photo}" onclick="if(window.openImageViewer) window.openImageViewer(this.src)" style="cursor:pointer; '
);

code = code.replace(
    /const shPhoto = sh\.photo \? \`<img src="\$\{sh\.photo\}" style="/g,
    'const shPhoto = sh.photo ? `<img src="${sh.photo}" onclick="if(window.openImageViewer) window.openImageViewer(this.src)" style="cursor:pointer; '
);

code = code.replace(
    /histPhotoHTML = \`<div class="raid-photo-gallery">\` \+ hist\.photos\.map\(p => \`<img src="\$\{p\}">\`\)\.join\(''\) \+ \`<\/div>\`;/g,
    'histPhotoHTML = `<div class="raid-photo-gallery">` + hist.photos.map(p => `<img src="${p}" onclick="if(window.openImageViewer) window.openImageViewer(this.src)" style="cursor:pointer;">`).join(\'\') + `</div>`;'
);

code = code.replace(
    /raidPhotoHTML = \`<div class="raid-photo-gallery">\` \+ raid\.photos\.map\(p => \`<img src="\$\{p\}">\`\)\.join\(''\) \+ \`<\/div>\`;/g,
    'raidPhotoHTML = `<div class="raid-photo-gallery">` + raid.photos.map(p => `<img src="${p}" onclick="if(window.openImageViewer) window.openImageViewer(this.src)" style="cursor:pointer;">`).join(\'\') + `</div>`;'
);

code = code.replace(
    /let newImgHTML = \`\n                <div class="photo-preview-item" data-index="\$\{window\.raidPhotosArray\.length - 1\}">\n                    <span class="remove-photo" onclick="removeRaidPhoto\(\$\{window\.raidPhotosArray\.length - 1\}\)">✖<\/span>\n                    <img src="\$\{photoData\}">\n                <\/div>\`;/g,
    'let newImgHTML = `\n                <div class="photo-preview-item" data-index="${window.raidPhotosArray.length - 1}">\n                    <span class="remove-photo" onclick="removeRaidPhoto(${window.raidPhotosArray.length - 1})">✖</span>\n                    <img src="${photoData}" onclick="if(window.openImageViewer) window.openImageViewer(this.src)" style="cursor:pointer;">\n                </div>`;'
);

fs.writeFileSync('public/app.js', code, 'utf8');
console.log("Images made clickable.");

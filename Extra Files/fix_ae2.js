const fs = require('fs');
let code = fs.readFileSync('public/index.html', 'utf8');

let originalBlock = `
    <!-- Domain 7: Anti-Encroachment Modal -->
    <div id="anti-encroachment-modal" class="modal-overlay">
        <div class="modal-content">
            <h2 style="color:#dc2626;">Log Encroachment Clearance</h2>
            <div class="form-group">
                <label>Location / Artery Name:</label>
                <input type="text" id="ae-location" class="form-control" placeholder="E.g., Wadhu Wah Road">
            </div>
            <div class="form-group">
                <label>Reclaimed Space Size (Acres / Sq Ft):</label>
                <input type="text" id="ae-reclaimed-size" class="form-control" placeholder="E.g., 2 Acres">
            </div>
            <div class="form-group">
                <label>Estimated Value (PKR in Millions):</label>
                <input type="number" id="ae-value-pkr" class="form-control" placeholder="E.g., 50" min="0" step="0.1">
            </div>
            <div class="form-group">
                <label>Reason of Action:</label>
                <select id="ae-reason" class="form-control" onchange="if(this.value==='Other'){document.getElementById('ae-reason-other-group').style.display='block';}else{document.getElementById('ae-reason-other-group').style.display='none';}">
                    <option value="Court Order">Court Order</option>
                    <option value="Orders of DC Hyderabad">Orders of DC Hyderabad</option>
                    <option value="Orders of Commissioner Hyderabad">Orders of Commissioner Hyderabad</option>
                    <option value="Encroachment Report by Office">Encroachment Report by Office</option>
                    <option value="Other">Other</option>
                </select>
            </div>
            <div class="form-group" id="ae-reason-other-group" style="display:none;">
                <label>Please Specify Reason:</label>
                <input type="text" id="ae-reason-other" class="form-control" placeholder="Type reason manually...">
            </div>
            <div class="form-group">
                <label>Before Operation Photo:</label>
                <input type="file" id="ae-photo-before" class="form-control" accept="image/*" capture="environment">
                <img id="ae-photo-before-preview" src="" style="display:none; width:100px; height:100px; margin-top:10px; border-radius:4px; object-fit:cover;">
            </div>
            <div class="form-group">
                <label>After Operation Photo:</label>
`;

code = code.replace(/<div id="anti-encroachment-modal" class="modal-overlay">[\s\S]*?<label>After Operation Photo:<\/label>/, originalBlock.trim());

fs.writeFileSync('public/index.html', code, 'utf8');
console.log("Fixed index.html");

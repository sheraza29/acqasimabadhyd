const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));
const PORT = 3002;

const server = app.listen(PORT, async () => {
    try {
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        
        await page.setViewport({ width: 375, height: 667 });
        await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'networkidle0' });
        
        const issues = await page.evaluate(() => {
            const problems = [];
            
            const checkOverflow = (selector) => {
                const els = document.querySelectorAll(selector);
                els.forEach((el, index) => {
                    const rect = el.getBoundingClientRect();
                    if (rect.right > window.innerWidth || rect.bottom > window.innerHeight) {
                        problems.push(`${selector} [${index}] overflows viewport: Right=${rect.right}, Bottom=${rect.bottom}`);
                    }
                });
            };

            // Force display all views to check them
            document.getElementById('auth-container').style.display = 'none';
            document.getElementById('app-container').style.display = 'block';
            document.getElementById('dashboard-view').style.display = 'block';
            
            checkOverflow('.domain-card');
            checkOverflow('.glass-panel');
            
            return problems;
        });
        
        console.log("Programmatic UI issues found:", issues);
        
        // Let's also capture screenshots and save them to the scratch directory so we can potentially use them
        const scratchDir = 'C:\\Users\\Sheraz Ahmed\\.gemini\\antigravity\\brain\\62bb1add-f10a-4b4e-84e6-3581648081a0\\scratch';
        await page.screenshot({ path: path.join(scratchDir, 'mobile_view.png') });
        
        await page.setViewport({ width: 1024, height: 768 });
        await page.screenshot({ path: path.join(scratchDir, 'desktop_view.png') });
        
        await browser.close();
        server.close();
        console.log("Screenshots saved to scratch dir.");
    } catch (e) {
        console.error(e);
        server.close();
    }
});

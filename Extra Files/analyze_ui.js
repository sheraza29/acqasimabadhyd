const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const PORT = 3001;

const server = app.listen(PORT, async () => {
    console.log(`Test server running on port ${PORT}`);
    
    try {
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        
        const viewports = [
            { width: 320, height: 568, name: 'iPhone SE (Very Small)' },
            { width: 375, height: 667, name: 'iPhone 6/7/8 (Small)' },
            { width: 768, height: 1024, name: 'iPad (Tablet)' },
            { width: 1024, height: 768, name: 'Small Laptop' }
        ];
        
        for (const vp of viewports) {
            console.log(`\n--- Analyzing Viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);
            await page.setViewport({ width: vp.width, height: vp.height });
            await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });
            
            // Check for horizontal overflow (the silent killer of mobile responsive design)
            const overflow = await page.evaluate(() => {
                return {
                    scrollWidth: document.documentElement.scrollWidth,
                    innerWidth: window.innerWidth,
                    hasOverflow: document.documentElement.scrollWidth > window.innerWidth
                };
            });
            
            if (overflow.hasOverflow) {
                console.log(`[!] CRITICAL HORIZONTAL OVERFLOW DETECTED: scrollWidth=${overflow.scrollWidth}px vs innerWidth=${overflow.innerWidth}px`);
                
                // Find elements causing the overflow
                const overflowElements = await page.evaluate(() => {
                    const elements = document.querySelectorAll('body *');
                    const results = [];
                    for (const el of elements) {
                        const rect = el.getBoundingClientRect();
                        // Filter out scripts/styles and elements that intentionally have overflow hidden
                        if (rect.right > window.innerWidth && getComputedStyle(el).overflowX !== 'hidden' && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE') {
                            results.push({
                                tag: el.tagName,
                                id: el.id,
                                className: el.className,
                                right: rect.right,
                                width: rect.width
                            });
                        }
                    }
                    return results;
                });
                
                if (overflowElements.length > 0) {
                    console.log('Elements breaking the horizontal layout:');
                    overflowElements.slice(0, 5).forEach(e => {
                        console.log(`  - <${e.tag.toLowerCase()} id="${e.id}" class="${e.className}"> | right: ${e.right}px`);
                    });
                }
            } else {
                console.log('[+] No horizontal overflow detected on document body.');
            }
            
            // Wait, we need to check the Dashboard View layout explicitly because it's initially hidden
            await page.evaluate(() => {
                document.getElementById('auth-container').style.display = 'none';
                document.getElementById('dashboard-view').style.display = 'block';
                document.getElementById('app-container').style.display = 'block';
                
                // Trigger a render of the domains
                document.getElementById('dashboard-dynamic-content').innerHTML = `
                    <div style="display:flex; flex-wrap:wrap; gap:15px;" id="dummy-domains">
                        <div class="domain-card" style="width:100%; border:1px solid red; padding:20px;">Domain 1</div>
                        <div class="domain-card" style="width:100%; border:1px solid red; padding:20px;">Domain 2</div>
                    </div>
                `;
            });
            
            // Re-check overflow
            const overflowDash = await page.evaluate(() => {
                return {
                    scrollWidth: document.documentElement.scrollWidth,
                    innerWidth: window.innerWidth,
                    hasOverflow: document.documentElement.scrollWidth > window.innerWidth
                };
            });
            
            if (overflowDash.hasOverflow) {
                console.log(`[!] OVERFLOW in Dashboard View: scrollWidth=${overflowDash.scrollWidth}px vs innerWidth=${overflowDash.innerWidth}px`);
            }
            
            // Check top navigation bar height and clipping
            const navMetrics = await page.evaluate(() => {
                const nav = document.getElementById('global-nav');
                if (!nav) return null;
                const rect = nav.getBoundingClientRect();
                return { height: rect.height, right: rect.right, isWrapped: rect.height > 80 };
            });
            
            if (navMetrics) {
                console.log(`Global Nav: Height=${navMetrics.height}px. ${navMetrics.isWrapped ? '[!] The nav is wrapping and growing vertically too much.' : '[+] Nav fits well.'}`);
            }
        }
        
        await browser.close();
        server.close();
    } catch (e) {
        console.error("Error during analysis:", e);
        server.close();
    }
});

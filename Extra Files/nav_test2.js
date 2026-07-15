const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    await page.setViewport({ width: 375, height: 667 });
    await page.goto('http://localhost:3002/', { waitUntil: 'networkidle0' });
    
    // Evaluate display properties
    const test1 = await page.evaluate(() => {
        // Force dashboard display
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('dashboard-view').style.display = 'block';
        document.getElementById('app-container').style.display = 'flex'; // Wait, app-container is block or flex? In index.html it has `display:none; width:100%; height:100%;` usually changed to block.
        document.getElementById('app-container').style.display = 'block';
        
        const nav = document.getElementById('global-nav');
        const children = nav ? Array.from(nav.children).map(c => ({
            className: c.className,
            width: c.getBoundingClientRect().width,
            right: c.getBoundingClientRect().right
        })) : [];
        
        return {
            navWidth: nav ? nav.getBoundingClientRect().width : null,
            children
        };
    });
    
    console.log("Nav Metrics on Mobile:", test1);
    
    await browser.close();
})();

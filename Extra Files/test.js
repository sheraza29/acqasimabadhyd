const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  page.on('dialog', async dialog => {
      console.log('DIALOG OPENED:', dialog.message());
      await dialog.accept();
  });
  
  await page.goto('https://acqasimabadhyd.web.app/');
  
  console.log('Waiting for login screen...');
  await page.waitForSelector('#login-identifier', { timeout: 10000 }).catch(e => console.log(e));
  
  try {
      await page.type('#login-identifier', 'sandbox');
      await page.type('#login-password', 'sandbox123');
      await page.click('#login-btn');
      
      console.log('Waiting for dashboard...');
      await page.waitForSelector('#app-container', { visible: true, timeout: 15000 });
      
      console.log('Clicking wholesale domain card...');
      await page.evaluate(() => {
          const card = document.querySelector('.domain-card[data-domain="wholesale_price"]');
          if (card) card.click();
      });
      
      await new Promise(r => setTimeout(r, 4000));
      
      console.log('Clicking Map Marker...');
      await page.evaluate(() => {
          if (window.wholesaleEntities && window.wholesaleEntities.length > 0) {
              const entity = window.wholesaleEntities[0];
              if (window.openEntityDashboard) window.openEntityDashboard(entity.id, 'wholesale_price');
          } else {
              console.log('No wholesale entities found to click');
          }
      });
      
      await new Promise(r => setTimeout(r, 1000));
      const dashModalVisible = await page.evaluate(() => {
          const modal = document.getElementById('entity-dashboard-modal');
          if (!modal) return false;
          const style = window.getComputedStyle(modal);
          return style.display !== 'none' && style.opacity !== '0' && style.visibility !== 'hidden';
      });
      console.log('Dashboard modal visible?', dashModalVisible);
      
      // Let's also check the actual computed styles of the modal content
      const modalContentStyle = await page.evaluate(() => {
          const modal = document.querySelector('#entity-dashboard-modal .modal-content');
          if (!modal) return null;
          const style = window.getComputedStyle(modal);
          return {
              display: style.display,
              width: style.width,
              height: style.height,
              maxHeight: style.maxHeight,
              visibility: style.visibility,
              opacity: style.opacity
          };
      });
      console.log('Modal Content Styles:', modalContentStyle);
      
  } catch (err) {
      console.log('Test error:', err);
  }
  
  await browser.close();
})();

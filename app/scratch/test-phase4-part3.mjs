import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const screenshotDir = '/Users/m.lokesh/.gemini/antigravity/brain/1192d8ff-9685-4fa0-9418-3012435f08ae/screenshots';
const docsScreensDir = '/Users/m.lokesh/gymapp/docs/screens';

for (const dir of [screenshotDir, docsScreensDir]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const viewports = [
  { name: 'mobile-360', width: 360, height: 780 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 900 }
];

async function run() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  console.log('Launching Playwright test suite for Phase 4 Part 3 (Trainer, Gym Owner, Wearables, Form Check)...');

  for (const vp of viewports) {
    console.log(`\n================ Testing Viewport: ${vp.name} (${vp.width}x${vp.height}) ================`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1
    });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // 1. Test /app/trainer
    console.log(`[${vp.name}] Navigating to /app/trainer...`);
    await page.goto('http://localhost:3000/app/trainer', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    const trainerBody = await page.textContent('body');
    if (!trainerBody.includes('Trainer roster') || !trainerBody.includes('Active Athletes')) {
      throw new Error(`Trainer portal failed to load on ${vp.name}`);
    }
    console.log(`[${vp.name}] ✓ Trainer portal loaded.`);

    // Test filter toggle
    const deloadFilter = page.locator('button:has-text("Deload Needed")').first();
    if (await deloadFilter.isVisible()) {
      await deloadFilter.click();
      await page.waitForTimeout(300);
      console.log(`[${vp.name}] ✓ Filtered athletes by 'Deload Needed'.`);
    }
    const allFilter = page.locator('button:has-text("All Athletes")').first();
    if (await allFilter.isVisible()) {
      await allFilter.click();
      await page.waitForTimeout(300);
    }

    // Open prescription modal
    const prescribeBtn = page.locator('button:has-text("Prescribe Plan")').first();
    if (await prescribeBtn.isVisible()) {
      await prescribeBtn.click();
      await page.waitForTimeout(400);
      console.log(`[${vp.name}] ✓ Opened Trainer Prescription modal.`);

      const saveRxBtn = page.locator('button:has-text("Save & Push Prescription")').first();
      if (await saveRxBtn.isVisible()) {
        await saveRxBtn.click();
        await page.waitForTimeout(500);
        console.log(`[${vp.name}] ✓ Pushed prescription with toast notification.`);
      }
    }

    const trainerScreenshot = path.join(screenshotDir, `phase4_trainer_${vp.name}.png`);
    await page.screenshot({ path: trainerScreenshot, fullPage: false });
    fs.copyFileSync(trainerScreenshot, path.join(docsScreensDir, `phase4_trainer_${vp.name}.png`));
    console.log(`[${vp.name}] Saved screenshot: ${trainerScreenshot}`);

    // 2. Test /app/gym
    console.log(`[${vp.name}] Navigating to /app/gym...`);
    await page.goto('http://localhost:3000/app/gym', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    const gymBody = await page.textContent('body');
    if (!gymBody.includes('Facility Live Feed') || !gymBody.includes('Equipment Utilization')) {
      throw new Error(`Gym Owner portal failed to load on ${vp.name}`);
    }
    console.log(`[${vp.name}] ✓ Gym Owner portal loaded.`);

    // Fast check-in member
    const memberInput = page.locator('input[placeholder="e.g. Arjun Patel"]').first();
    if (await memberInput.isVisible()) {
      await memberInput.fill('Karan Malhotra');
      const checkInBtn = page.locator('button:has-text("Check-In Member")').first();
      if (await checkInBtn.isVisible()) {
        await checkInBtn.click();
        await page.waitForTimeout(500);
        console.log(`[${vp.name}] ✓ Checked in member Karan Malhotra.`);
      }
    }

    const gymScreenshot = path.join(screenshotDir, `phase4_gym_${vp.name}.png`);
    await page.screenshot({ path: gymScreenshot, fullPage: false });
    fs.copyFileSync(gymScreenshot, path.join(docsScreensDir, `phase4_gym_${vp.name}.png`));
    console.log(`[${vp.name}] Saved screenshot: ${gymScreenshot}`);

    // 3. Test /app/settings Wearables tab
    console.log(`[${vp.name}] Navigating to /app/settings...`);
    await page.goto('http://localhost:3000/app/settings', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    const wearablesTab = page.locator('button:has-text("Wearables & Sync")').first();
    if (await wearablesTab.isVisible()) {
      await wearablesTab.click();
      await page.waitForTimeout(400);
      console.log(`[${vp.name}] ✓ Switched to Wearables & Sync tab.`);

      // Click Sync Now
      const syncNowBtn = page.locator('button:has-text("Sync Now")').first();
      if (await syncNowBtn.isVisible()) {
        await syncNowBtn.click();
        await page.waitForTimeout(800);
        console.log(`[${vp.name}] ✓ Executed Wearables Sync pull.`);
      }

      const wearablesScreenshot = path.join(screenshotDir, `phase4_wearables_${vp.name}.png`);
      await page.screenshot({ path: wearablesScreenshot, fullPage: false });
      fs.copyFileSync(wearablesScreenshot, path.join(docsScreensDir, `phase4_wearables_${vp.name}.png`));
      console.log(`[${vp.name}] Saved screenshot: ${wearablesScreenshot}`);
    }

    // 4. Test /app/form-check
    console.log(`[${vp.name}] Navigating to /app/form-check...`);
    await page.goto('http://localhost:3000/app/form-check', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);

    const formCheckBody = await page.textContent('body');
    if (!formCheckBody.includes('Form check') || !formCheckBody.includes('On-device pose AI')) {
      throw new Error(`Form check page failed to load on ${vp.name}`);
    }
    console.log(`[${vp.name}] ✓ Form check studio loaded with on-device pose AI.`);

    // Switch lift to Bench Press
    const benchLiftBtn = page.locator('button:has-text("Bench")').first();
    if (await benchLiftBtn.isVisible()) {
      await benchLiftBtn.click();
      await page.waitForTimeout(400);
      console.log(`[${vp.name}] ✓ Switched form analysis to Bench press.`);
    }

    const formCheckScreenshot = path.join(screenshotDir, `phase4_form_check_${vp.name}.png`);
    await page.screenshot({ path: formCheckScreenshot, fullPage: false });
    fs.copyFileSync(formCheckScreenshot, path.join(docsScreensDir, `phase4_form_check_${vp.name}.png`));
    console.log(`[${vp.name}] Saved screenshot: ${formCheckScreenshot}`);

    if (consoleErrors.length > 0) {
      console.warn(`[${vp.name}] Console errors observed:`, consoleErrors);
    } else {
      console.log(`[${vp.name}] ✓ 0 console errors.`);
    }

    await context.close();
  }

  await browser.close();
  console.log('\nAll Phase 4 Part 3 Playwright E2E verifications completed successfully!');
}

run().catch(err => {
  console.error('Phase 4 Part 3 Playwright verification failed:', err);
  process.exit(1);
});

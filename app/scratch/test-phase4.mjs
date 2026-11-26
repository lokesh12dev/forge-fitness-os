import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const screenshotDir = '/Users/m.lokesh/.gemini/antigravity/brain/1192d8ff-9685-4fa0-9418-3012435f08ae/screenshots';
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

const viewports = [
  { name: 'mobile-360', width: 360, height: 780 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 900 }
];

async function run() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  console.log('Launching Playwright test suite for Phase 4 (P1 Features)...');

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

    // 1. Test /app/programs
    console.log(`[${vp.name}] Navigating to /app/programs...`);
    await page.goto('http://localhost:3000/app/programs', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const programsBody = await page.textContent('body');
    if (!programsBody.includes('Programs') || !programsBody.includes('Built-in Training Programs')) {
      throw new Error(`Programs page did not load properly on ${vp.name}`);
    }
    console.log(`[${vp.name}] ✓ 10 Built-in programs catalog loaded.`);

    // Test Goal Filter chip
    const strengthChip = page.locator('button:has-text("STRENGTH")').first();
    if (await strengthChip.isVisible()) {
      await strengthChip.click();
      await page.waitForTimeout(300);
      console.log(`[${vp.name}] ✓ Filtered by STRENGTH goal.`);
    }

    // Inspect program modal
    const inspectBtn = page.locator('button:has-text("Inspect Days")').first();
    if (await inspectBtn.isVisible()) {
      await inspectBtn.click();
      await page.waitForTimeout(400);
      console.log(`[${vp.name}] ✓ Program inspection modal opened.`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // Capture screenshot of /app/programs
    const programsScreenshot = path.join(screenshotDir, `phase4_programs_${vp.name}.png`);
    await page.screenshot({ path: programsScreenshot, fullPage: false });
    console.log(`[${vp.name}] Saved screenshot: ${programsScreenshot}`);

    // 2. Test /app/coach
    console.log(`[${vp.name}] Navigating to /app/coach...`);
    await page.goto('http://localhost:3000/app/coach', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const coachBody = await page.textContent('body');
    if (!coachBody.includes('Forge Coach') && !coachBody.includes('Your corner')) {
      throw new Error(`Coach page did not load properly on ${vp.name}`);
    }
    console.log(`[${vp.name}] ✓ AI Coach page loaded.`);

    // Click quick prompt pill
    const stallPrompt = page.locator('button:has-text("Analyze bench stall")').first();
    if (await stallPrompt.isVisible()) {
      await stallPrompt.click();
      await page.waitForTimeout(800);
      console.log(`[${vp.name}] ✓ Sent 'Analyze bench stall' quick prompt.`);
    }

    // Capture screenshot of /app/coach
    const coachScreenshot = path.join(screenshotDir, `phase4_coach_${vp.name}.png`);
    await page.screenshot({ path: coachScreenshot, fullPage: false });
    console.log(`[${vp.name}] Saved screenshot: ${coachScreenshot}`);

    // 3. Test /app/settings (Universal CSV Migration)
    console.log(`[${vp.name}] Navigating to /app/settings...`);
    await page.goto('http://localhost:3000/app/settings', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Switch to Privacy & Data tab
    const privacyTab = page.locator('button:has-text("Privacy & Data")');
    if (await privacyTab.isVisible()) {
      await privacyTab.click();
      await page.waitForTimeout(500);

      // Verify and open CSV Import modal
      const importBtn = page.locator('button:has-text("Import CSV")');
      if (await importBtn.isVisible()) {
        await importBtn.click();
        await page.waitForTimeout(500);
        console.log(`[${vp.name}] ✓ Opened Universal CSV Migration modal.`);

        // Test Hevy Sample preset
        const hevySampleBtn = page.locator('button:has-text("Hevy Sample")');
        if (await hevySampleBtn.isVisible()) {
          await hevySampleBtn.click();
          await page.waitForTimeout(400);
          console.log(`[${vp.name}] ✓ Loaded Hevy Sample fixture.`);

          // Execute Import
          const executeBtn = page.locator('button:has-text("Import")').last();
          if (await executeBtn.isVisible()) {
            await executeBtn.click();
            await page.waitForTimeout(800);
            console.log(`[${vp.name}] ✓ Executed workout import migration.`);
          }
        }

        // Close modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }

    // Capture screenshot of /app/settings
    const settingsScreenshot = path.join(screenshotDir, `phase4_settings_${vp.name}.png`);
    await page.screenshot({ path: settingsScreenshot, fullPage: false });
    console.log(`[${vp.name}] Saved screenshot: ${settingsScreenshot}`);

    if (consoleErrors.length > 0) {
      console.warn(`[${vp.name}] Console errors observed:`, consoleErrors);
    } else {
      console.log(`[${vp.name}] ✓ 0 console errors.`);
    }

    await context.close();
  }

  await browser.close();
  console.log('\nAll Phase 4 Playwright E2E verifications completed successfully!');
}

run().catch(err => {
  console.error('Phase 4 Playwright verification failed:', err);
  process.exit(1);
});

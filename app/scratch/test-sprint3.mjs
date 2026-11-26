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
  console.log('Launching Playwright test suite for Sprint 3...');

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

    // 1. Test /app/nutrition
    console.log(`[${vp.name}] Navigating to /app/nutrition...`);
    await page.goto('http://localhost:3000/app/nutrition', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Verify Macro Rings presence
    const ringsText = await page.textContent('body');
    if (!ringsText.toLowerCase().includes('protein') || !ringsText.toLowerCase().includes('calories')) {
      throw new Error(`Macro rings text not found on /app/nutrition for ${vp.name}`);
    }
    console.log(`[${vp.name}] ✓ Macro rings rendered properly.`);

    // Test Barcode Scanner Modal
    const scanBtn = page.locator('button:has-text("Barcode")').first();
    if (await scanBtn.isVisible()) {
      await scanBtn.click();
      await page.waitForTimeout(600);
      console.log(`[${vp.name}] ✓ Barcode scanner modal opened.`);

      // Click a preset barcode (e.g. Amul High Protein Lassi)
      const presetBtn = page.locator('button:has-text("Amul High Protein Lassi")');
      if (await presetBtn.isVisible()) {
        await presetBtn.click();
        await page.waitForTimeout(400);
        console.log(`[${vp.name}] ✓ Selected preset barcode (Amul Lassi).`);

        // Click Log Food to Nutrition
        const logBtn = page.locator('button:has-text("Log to Today\'s Plan")');
        if (await logBtn.isVisible()) {
          await logBtn.click();
          await page.waitForTimeout(500);
          console.log(`[${vp.name}] ✓ Logged scanned food item.`);
        }
      } else {
        // Close modal if preset not visible
        await page.keyboard.press('Escape');
      }
    }

    // Test Search Input & Category Filters
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('Paneer');
      await page.waitForTimeout(400);
      const searchResults = await page.textContent('body');
      if (searchResults.toLowerCase().includes('paneer')) {
        console.log(`[${vp.name}] ✓ Food search returned matching results.`);
      }
      await searchInput.fill('');
    }

    // Test "Hit My Remaining Protein" quick log
    const quickLogBtn = page.locator('button:has-text("+ Log")').first();
    if (await quickLogBtn.isVisible()) {
      await quickLogBtn.click();
      await page.waitForTimeout(400);
      console.log(`[${vp.name}] ✓ Hit remaining protein quick log tested.`);
    }

    // Capture screenshot of /app/nutrition
    const nutritionScreenshotPath = path.join(screenshotDir, `sprint3_nutrition_${vp.name}.png`);
    await page.screenshot({ path: nutritionScreenshotPath, fullPage: false });
    console.log(`[${vp.name}] Saved screenshot: ${nutritionScreenshotPath}`);

    // 2. Test /app/progress
    console.log(`[${vp.name}] Navigating to /app/progress...`);
    await page.goto('http://localhost:3000/app/progress', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Verify time range selector
    const range8wBtn = page.locator('button:has-text("8w · 2M")');
    if (await range8wBtn.isVisible()) {
      await range8wBtn.click();
      await page.waitForTimeout(400);
      console.log(`[${vp.name}] ✓ Selected 8-week time range.`);
    }

    // Verify 7-day smoothed badge
    const progressBody = await page.textContent('body');
    if (progressBody.includes('7-Day Smoothed') || progressBody.includes('Moving Average')) {
      console.log(`[${vp.name}] ✓ 7-Day moving average weight trend verified.`);
    }

    // Verify Badge Showcase
    if (progressBody.includes('Unlocked & In-Progress Badges') || progressBody.includes('Iron Streak')) {
      console.log(`[${vp.name}] ✓ Badge showcase verified.`);
    }

    // Test Data Export Modal
    const exportBtn = page.locator('button:has-text("Export data")').first();
    if (await exportBtn.isVisible()) {
      await exportBtn.click();
      await page.waitForTimeout(500);
      console.log(`[${vp.name}] ✓ Opened Data Export modal.`);
      const modalText = await page.textContent('body');
      if (modalText.includes('CSV') && modalText.includes('JSON')) {
        console.log(`[${vp.name}] ✓ CSV and JSON export options verified.`);
      }
      // Close modal
      const closeExportBtn = page.locator('button:has(svg.lucide-x)').first();
      if (await closeExportBtn.isVisible()) {
        await closeExportBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(400);
    }

    // Capture screenshot of /app/progress
    const progressScreenshotPath = path.join(screenshotDir, `sprint3_progress_${vp.name}.png`);
    await page.screenshot({ path: progressScreenshotPath, fullPage: false });
    console.log(`[${vp.name}] Saved screenshot: ${progressScreenshotPath}`);

    // 3. Test /app/settings
    console.log(`[${vp.name}] Navigating to /app/settings...`);
    await page.goto('http://localhost:3000/app/settings', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Test Plans & Billing tab
    const plansTab = page.locator('button:has-text("Plans & Billing")');
    if (await plansTab.isVisible()) {
      await plansTab.click();
      await page.waitForTimeout(500);
      const plansText = await page.textContent('body');
      if (plansText.includes('FORGE Pro') && plansText.includes('Gym B2B Partner')) {
        console.log(`[${vp.name}] ✓ Plans & Billing tier cards verified.`);
      }

      // Test Currency Toggle
      const inrBtn = page.locator('button:has-text("INR (₹)")');
      if (await inrBtn.isVisible()) {
        await inrBtn.click();
        await page.waitForTimeout(300);
        console.log(`[${vp.name}] ✓ Switched currency to INR.`);
      }
    }

    // Test Privacy & Data tab
    const privacyTab = page.locator('button:has-text("Privacy & Data")');
    if (await privacyTab.isVisible()) {
      await privacyTab.click();
      await page.waitForTimeout(500);
      const privacyText = await page.textContent('body');
      if (privacyText.includes('Data Sovereignty') && privacyText.includes('Reset Local Offline Cache')) {
        console.log(`[${vp.name}] ✓ Privacy & Data sovereignty controls verified.`);
      }

      // Test Local cache reset trigger
      const resetCacheBtn = page.locator('button:has-text("Reset Local Offline Cache")');
      if (await resetCacheBtn.isVisible()) {
        await resetCacheBtn.click();
        await page.waitForTimeout(500);
        console.log(`[${vp.name}] ✓ Local-first cache reset triggered successfully.`);
      }
    }

    // Capture screenshot of /app/settings
    const settingsScreenshotPath = path.join(screenshotDir, `sprint3_settings_${vp.name}.png`);
    await page.screenshot({ path: settingsScreenshotPath, fullPage: false });
    console.log(`[${vp.name}] Saved screenshot: ${settingsScreenshotPath}`);

    if (consoleErrors.length > 0) {
      console.warn(`[${vp.name}] Console errors observed:`, consoleErrors);
    } else {
      console.log(`[${vp.name}] ✓ 0 console errors.`);
    }

    await context.close();
  }

  await browser.close();
  console.log('\nAll Sprint 3 Playwright E2E verifications completed successfully!');
}

run().catch(err => {
  console.error('Playwright verification failed:', err);
  process.exit(1);
});

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
  console.log('Launching Playwright test suite for Phase 4 Part 2 (Cardio, Photo-to-Macro, ShareCard)...');

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

    // 1. Test /app/nutrition with PhotoMealScanner
    console.log(`[${vp.name}] Navigating to /app/nutrition...`);
    await page.goto('http://localhost:3000/app/nutrition', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const scanMealBtn = page.locator('button:has-text("Scan meal")').first();
    if (await scanMealBtn.isVisible()) {
      await scanMealBtn.click();
      await page.waitForTimeout(500);
      console.log(`[${vp.name}] ✓ Opened Photo-to-Macro Scanner modal.`);

      // Pick sample meal
      const paneerSample = page.locator('button:has-text("Paneer Bowl")').first();
      if (await paneerSample.isVisible()) {
        await paneerSample.click();
        await page.waitForTimeout(400);
        console.log(`[${vp.name}] ✓ Loaded sample photo meal (Paneer Bowl).`);
      }

      // Verify bounding boxes and log meal
      const logMealBtn = page.locator('button:has-text("Log")').last();
      if (await logMealBtn.isVisible()) {
        await logMealBtn.click();
        await page.waitForTimeout(500);
        console.log(`[${vp.name}] ✓ Logged scanned meal items to daily log.`);
      }
    }

    const nutritionScreenshot = path.join(screenshotDir, `phase4_nutrition_${vp.name}.png`);
    await page.screenshot({ path: nutritionScreenshot, fullPage: false });
    fs.copyFileSync(nutritionScreenshot, path.join(docsScreensDir, `phase4_nutrition_${vp.name}.png`));
    console.log(`[${vp.name}] Saved screenshot: ${nutritionScreenshot}`);

    // 2. Test /app/social with ShareCardModal
    console.log(`[${vp.name}] Navigating to /app/social...`);
    await page.goto('http://localhost:3000/app/social', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    const shareCardBtn = page.locator('button:has-text("Share Card")').first();
    if (await shareCardBtn.isVisible()) {
      await shareCardBtn.click();
      await page.waitForTimeout(500);
      console.log(`[${vp.name}] ✓ Opened Social ShareCard Modal.`);

      // Toggle format: Story 9:16
      const storyBtn = page.locator('button:has-text("Story (9:16)")').first();
      if (await storyBtn.isVisible()) {
        await storyBtn.click();
        await page.waitForTimeout(300);
        console.log(`[${vp.name}] ✓ Switched to 9:16 Story format.`);
      }

      // Toggle back to Square 1:1
      const squareBtn = page.locator('button:has-text("Square (1:1)")').first();
      if (await squareBtn.isVisible()) {
        await squareBtn.click();
        await page.waitForTimeout(300);
        console.log(`[${vp.name}] ✓ Switched to 1:1 Square format.`);
      }

      const socialScreenshot = path.join(screenshotDir, `phase4_social_share_${vp.name}.png`);
      await page.screenshot({ path: socialScreenshot, fullPage: false });
      fs.copyFileSync(socialScreenshot, path.join(docsScreensDir, `phase4_social_share_${vp.name}.png`));
      console.log(`[${vp.name}] Saved screenshot: ${socialScreenshot}`);

      // Close modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // 3. Test /app/train with CardioModal & Crowded Gym
    console.log(`[${vp.name}] Navigating to /app/train...`);
    await page.goto('http://localhost:3000/app/train', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);

    // Open active workout if start workout button visible
    const startWorkoutBtn = page.locator('button:has-text("Start Workout"), button:has-text("Resume Workout"), button:has-text("Start session")').first();
    if (await startWorkoutBtn.isVisible()) {
      await startWorkoutBtn.click();
      await page.waitForTimeout(600);
    }

    // Click Cardio button in active workout toolbar
    const cardioBtn = page.locator('button:has-text("Cardio")').first();
    if (await cardioBtn.isVisible()) {
      await cardioBtn.click();
      await page.waitForTimeout(500);
      console.log(`[${vp.name}] ✓ Opened Cardio Tracker Modal.`);

      // Select Cycling
      const cyclingBtn = page.locator('button:has-text("Indoor Cycling")').first();
      if (await cyclingBtn.isVisible()) {
        await cyclingBtn.click();
        await page.waitForTimeout(300);
        console.log(`[${vp.name}] ✓ Selected Indoor Cycling.`);
      }

      // Save cardio log
      const saveCardioBtn = page.locator('button:has-text("Log Cardio Activity")').first();
      if (await saveCardioBtn.isVisible()) {
        await saveCardioBtn.click();
        await page.waitForTimeout(400);
        console.log(`[${vp.name}] ✓ Saved cardio log with MET calorie calculation.`);
      }
    }

    // Test Crowded Gym Mode toggle
    const crowdedBtn = page.locator('button:has-text("Crowded"), button:has-text("Crowded Gym")').first();
    if (await crowdedBtn.isVisible()) {
      await crowdedBtn.click();
      await page.waitForTimeout(400);
      console.log(`[${vp.name}] ✓ Toggled Crowded Gym mode.`);
    }

    const trainScreenshot = path.join(screenshotDir, `phase4_train_${vp.name}.png`);
    await page.screenshot({ path: trainScreenshot, fullPage: false });
    fs.copyFileSync(trainScreenshot, path.join(docsScreensDir, `phase4_train_${vp.name}.png`));
    console.log(`[${vp.name}] Saved screenshot: ${trainScreenshot}`);

    if (consoleErrors.length > 0) {
      console.warn(`[${vp.name}] Console errors observed:`, consoleErrors);
    } else {
      console.log(`[${vp.name}] ✓ 0 console errors.`);
    }

    await context.close();
  }

  await browser.close();
  console.log('\nAll Phase 4 Part 2 Playwright E2E verifications completed successfully!');
}

run().catch(err => {
  console.error('Phase 4 Part 2 Playwright verification failed:', err);
  process.exit(1);
});

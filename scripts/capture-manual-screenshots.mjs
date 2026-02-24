import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = 'http://127.0.0.1:8000';
const STORAGE_KEY = 'abc-adventure-state-v1';
const OUTPUT_DIR = path.resolve('docs/manual-images');

const DEFAULT_SETTINGS = {
  lettersPerReward: 3,
  rewardSeconds: 30,
  youtubeVideoId: '-yG4mBzGwq8',
  rewardOrientation: 'landscape',
  parentPin: '1234',
  rewardEnabled: true
};

function createState(overrides = {}) {
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(overrides.settings || {})
  };
  const state = {
    settings,
    learnedLetters: [],
    watchedSessions: 0,
    lastLearnedLetter: null,
    score: 0,
    streak: 0,
    rewardPlayback: {
      videoId: settings.youtubeVideoId,
      timeSeconds: 0
    },
    activeReward: {
      inProgress: false,
      remainingSeconds: 0,
      consumed: false
    },
    ...overrides
  };
  return state;
}

async function preparePage(context, state) {
  const page = await context.newPage();
  await page.addInitScript(
    ([storageKey, storageState]) => {
      window.localStorage.setItem(storageKey, JSON.stringify(storageState));
    },
    [STORAGE_KEY, state]
  );
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  return page;
}

async function clickDock(page, label) {
  await page.getByRole('button', { name: label }).click();
  await page.waitForTimeout(180);
}

async function take(page, filename) {
  const outputPath = path.join(OUTPUT_DIR, filename);
  await page.screenshot({ path: outputPath, fullPage: false });
  console.log(`saved ${outputPath}`);
}

async function captureMobileScreenshots(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2
  });

  const page = await preparePage(context, createState());

  await take(page, '01-學習主畫面.png');
  await clickDock(page, '進度');
  await take(page, '02-學習進度.png');
  await clickDock(page, '字母');
  await take(page, '03-字母地圖.png');
  await clickDock(page, '測驗');
  await take(page, '04-小測驗.png');

  await clickDock(page, '學習');
  await page.locator('#speak-letter-btn').click();
  await page.waitForTimeout(120);
  await page.locator('#speak-word-btn').click();
  await page.waitForTimeout(120);
  await page.locator('#learned-btn').click();
  await page.waitForTimeout(220);
  await take(page, '05-學會挑戰.png');

  const titleText = (await page.locator('#learn-check-title').innerText()).trim();
  const targetLetter = titleText.slice(-1);
  await page
    .locator('#learn-check-options .quiz-option')
    .filter({ hasNotText: targetLetter })
    .first()
    .click();
  await page.waitForTimeout(160);
  await take(page, '06-學會挑戰答錯.png');

  await page.locator('#learn-check-options .quiz-option', { hasText: targetLetter }).click();
  await page.waitForTimeout(220);
  await take(page, '07-學會後自動跳下一字母.png');

  await page.locator('#open-pin-btn').click();
  await page.locator('#pin-input').fill('0000');
  await page.locator('#pin-submit-btn').click();
  await page.waitForTimeout(160);
  await take(page, '08-PIN錯誤提示.png');

  await context.close();
}

async function openParentOverlay(page) {
  await page.locator('#open-pin-btn').click();
  await page.locator('#pin-input').fill('1234');
  await page.locator('#pin-submit-btn').click();
  await page.waitForTimeout(260);
}

async function captureDesktopScreenshots(browser) {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    deviceScaleFactor: 1
  });

  const page = await preparePage(context, createState());
  await openParentOverlay(page);
  await take(page, '09-家長管理介面.png');

  await page.locator('#reward-orientation').selectOption('landscape');
  await page.waitForTimeout(120);
  await take(page, '10-家長設定橫向.png');

  await page.locator('#reward-orientation').selectOption('portrait');
  await page.waitForTimeout(120);
  await take(page, '11-家長設定直向.png');

  await context.close();
}

async function captureRewardScreenshots(browser) {
  const desktopContext = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    deviceScaleFactor: 1
  });
  const desktopPage = await preparePage(
    desktopContext,
    createState({
      learnedLetters: ['A', 'B', 'C'],
      settings: { rewardOrientation: 'landscape' }
    })
  );
  await desktopPage.locator('#manual-reward-btn').click();
  await desktopPage.waitForTimeout(500);
  await take(desktopPage, '12-獎勵影片橫向.png');
  await desktopContext.close();

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2
  });
  const mobilePage = await preparePage(
    mobileContext,
    createState({
      learnedLetters: ['A', 'B', 'C'],
      settings: { rewardOrientation: 'portrait' }
    })
  );
  await clickDock(mobilePage, '進度');
  await mobilePage.locator('#manual-reward-btn').click();
  await mobilePage.waitForTimeout(500);
  await take(mobilePage, '13-獎勵影片直向設定手機橫向播放.png');
  await mobileContext.close();
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    await captureMobileScreenshots(browser);
    await captureDesktopScreenshots(browser);
    await captureRewardScreenshots(browser);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

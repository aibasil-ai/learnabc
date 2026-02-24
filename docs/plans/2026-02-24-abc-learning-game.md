# ABC Learning Game Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 建立適合 6 歲以下兒童的英文字母學習網頁遊戲，含語音、字母單字對應、獎勵影片、家長管理介面。

**Architecture:** 使用純前端（HTML/CSS/ES Modules）完成單頁應用。以 localStorage 保存進度與家長設定，核心獎勵邏輯獨立於 `reward-engine.js` 以便測試。YouTube IFrame API 用於自動播放獎勵影片，Web Speech API 提供 en-US 發音。

**Tech Stack:** HTML, CSS, JavaScript (ES Modules), Node.js built-in test runner, YouTube IFrame API, Web Speech API

---

### Task 1: 建立核心邏輯測試與實作

**Files:**
- Create: `tests/reward-engine.test.js`
- Create: `src/reward-engine.js`

**預期成果:**
- 確認每學滿 N 個字母可解鎖 1 次獎勵
- 重複字母不重複計算
- 可消耗已解鎖獎勵次數

**驗證指令:**
- `npm test`

### Task 2: 建立 YouTube ID 解析與測試

**Files:**
- Create: `tests/utils.test.js`
- Create: `src/utils.js`

**預期成果:**
- 可解析 watch URL、short URL、直接 ID
- 非 YouTube 字串回傳 null

**驗證指令:**
- `npm test`

### Task 3: 建立學習資料模型與主 UI

**Files:**
- Create: `src/data.js`
- Create: `index.html`
- Create: `styles.css`
- Create: `src/app.js`

**預期成果:**
- 26 字母與單字、互動學習按鈕、進度區、字母地圖、測驗區

**驗證指令:**
- `npm test`
- `python3 -m http.server 8000`

### Task 4: 串接語音、獎勵影片、家長模式

**Files:**
- Modify: `src/app.js`
- Modify: `index.html`
- Modify: `styles.css`

**預期成果:**
- en-US 語音朗讀字母與單字
- 每達門檻自動播放 3 分鐘獎勵影片並鎖定控制
- 家長 PIN 與設定可保存

**驗證指令:**
- `npm test`
- `python3 -m http.server 8000` 後手動流程驗證

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SETTINGS,
  createInitialState,
  markLetterLearned,
  getRewardStatus,
  consumeRewardSession,
  normalizeRewardSessions,
  updateSettings,
  resetProgress,
  pickNextUnlearnedLetterIndex,
  hasCompletionRewardAvailable,
  consumeCompletionReward
} from '../src/reward-engine.js';

test('每學滿 3 個不同字母會解鎖 1 次獎勵', () => {
  let state = createInitialState(DEFAULT_SETTINGS);
  ['A', 'B', 'C'].forEach((letter) => {
    state = markLetterLearned(state, letter);
  });

  const status = getRewardStatus(state);
  assert.equal(status.learnedCount, 3);
  assert.equal(status.availableSessions, 1);
  assert.equal(status.nextMilestoneAt, 6);
});

test('重複學同一字母不重複計算', () => {
  let state = createInitialState(DEFAULT_SETTINGS);
  state = markLetterLearned(state, 'A');
  state = markLetterLearned(state, 'A');

  const status = getRewardStatus(state);
  assert.equal(status.learnedCount, 1);
  assert.equal(status.availableSessions, 0);
  assert.equal(status.progressToNextReward, 1);
});

test('消耗一次獎勵後可用次數會扣除', () => {
  let state = createInitialState({ ...DEFAULT_SETTINGS, lettersPerReward: 5 });
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].forEach((letter) => {
    state = markLetterLearned(state, letter);
  });

  let status = getRewardStatus(state);
  assert.equal(status.availableSessions, 2);

  state = consumeRewardSession(state);
  status = getRewardStatus(state);

  assert.equal(status.availableSessions, 1);
  assert.equal(status.watchedSessions, 1);
});

test('可依家長設定調整門檻', () => {
  const custom = { ...DEFAULT_SETTINGS, lettersPerReward: 3 };
  let state = createInitialState(custom);
  ['A', 'B', 'C', 'D'].forEach((letter) => {
    state = markLetterLearned(state, letter);
  });

  const status = getRewardStatus(state);
  assert.equal(status.availableSessions, 1);
  assert.equal(status.nextMilestoneAt, 6);
});

test('調整獎勵門檻後會校正已觀看次數，後續仍可再次解鎖', () => {
  let state = createInitialState({ ...DEFAULT_SETTINGS, lettersPerReward: 5 });
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'].forEach((letter) => {
    state = markLetterLearned(state, letter);
  });

  state = consumeRewardSession(state);
  state = consumeRewardSession(state);
  let status = getRewardStatus(state);
  assert.equal(status.watchedSessions, 2);
  assert.equal(status.availableSessions, 0);

  state = updateSettings(state, { lettersPerReward: 10 });
  state = normalizeRewardSessions(state);
  status = getRewardStatus(state);
  assert.equal(status.watchedSessions, 1);
  assert.equal(status.availableSessions, 0);

  ['K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'].forEach((letter) => {
    state = markLetterLearned(state, letter);
  });
  status = getRewardStatus(state);
  assert.equal(status.earnedSessions, 2);
  assert.equal(status.watchedSessions, 1);
  assert.equal(status.availableSessions, 1);
});

test('建立初始狀態時可保留影片方向設定', () => {
  const portraitSettings = {
    ...DEFAULT_SETTINGS,
    rewardOrientation: 'portrait'
  };
  const portraitState = createInitialState(portraitSettings);
  const defaultState = createInitialState(DEFAULT_SETTINGS);

  assert.equal(portraitState.settings.rewardOrientation, 'portrait');
  assert.equal(defaultState.settings.rewardOrientation, 'landscape');
});

test('依序模式會跳到下一個尚未學習的字母', () => {
  const letters = ['A', 'B', 'C', 'D', 'E'];
  const learnedLetters = ['A', 'B', 'D'];

  const nextIndex = pickNextUnlearnedLetterIndex({
    letters,
    learnedLetters,
    currentLetter: 'B',
    randomLearningEnabled: false
  });

  assert.equal(nextIndex, 2);
  assert.equal(letters[nextIndex], 'C');
});

test('亂數模式會從尚未學習的字母中隨機選下一個', () => {
  const letters = ['A', 'B', 'C', 'D', 'E'];
  const learnedLetters = ['A', 'C'];

  const nextIndex = pickNextUnlearnedLetterIndex({
    letters,
    learnedLetters,
    currentLetter: 'A',
    randomLearningEnabled: true,
    randomFn: () => 0.8
  });

  assert.equal(nextIndex, 4);
  assert.equal(letters[nextIndex], 'E');
});

test('重設學習進度時可選擇保留影片播放進度', () => {
  let state = createInitialState(DEFAULT_SETTINGS);
  state = {
    ...state,
    learnedLetters: ['A', 'B'],
    watchedSessions: 1,
    score: 25,
    rewardPlayback: {
      videoId: 'abc123xyz89',
      timeSeconds: 88
    }
  };

  const resetState = resetProgress(state, { resetRewardPlayback: false });

  assert.deepEqual(resetState.learnedLetters, []);
  assert.equal(resetState.score, 0);
  assert.deepEqual(resetState.rewardPlayback, {
    videoId: 'abc123xyz89',
    timeSeconds: 88
  });
});

test('重設學習進度時可同時重置影片播放進度', () => {
  let state = createInitialState(DEFAULT_SETTINGS);
  state = {
    ...state,
    rewardPlayback: {
      videoId: 'abc123xyz89',
      timeSeconds: 88
    }
  };

  const resetState = resetProgress(state, { resetRewardPlayback: true });

  assert.deepEqual(resetState.rewardPlayback, {
    videoId: state.settings.youtubeVideoId,
    timeSeconds: 0
  });
});

test('全部字母都學完且尚未領取時可使用完成獎勵', () => {
  let state = createInitialState(DEFAULT_SETTINGS);
  state = {
    ...state,
    learnedLetters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
    completionRewardClaimed: false
  };

  assert.equal(hasCompletionRewardAvailable(state, 26), true);
});

test('完成獎勵領取後不再可用', () => {
  let state = createInitialState(DEFAULT_SETTINGS);
  state = {
    ...state,
    learnedLetters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
    completionRewardClaimed: false
  };

  state = consumeCompletionReward(state, 26);
  assert.equal(state.completionRewardClaimed, true);
  assert.equal(hasCompletionRewardAvailable(state, 26), false);
});

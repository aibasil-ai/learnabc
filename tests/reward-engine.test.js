import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_SETTINGS,
  createInitialState,
  markLetterLearned,
  getRewardStatus,
  consumeRewardSession
} from '../src/reward-engine.js';

test('每學滿 5 個不同字母會解鎖 1 次獎勵', () => {
  let state = createInitialState(DEFAULT_SETTINGS);
  ['A', 'B', 'C', 'D', 'E'].forEach((letter) => {
    state = markLetterLearned(state, letter);
  });

  const status = getRewardStatus(state);
  assert.equal(status.learnedCount, 5);
  assert.equal(status.availableSessions, 1);
  assert.equal(status.nextMilestoneAt, 10);
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
  let state = createInitialState(DEFAULT_SETTINGS);
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

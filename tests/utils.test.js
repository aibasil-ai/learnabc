import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LEARN_CHECK_PROMPT_TYPES,
  buildLearnCheckPrompt,
  buildQuizPrompt,
  buildRewardVideoCandidates,
  getYouTubeErrorMessage,
  normalizeLearnCheckPromptType,
  normalizeRewardPlayback,
  parseYouTubeVideoId,
  resolveRewardStart,
  shouldSpeakPrompt
} from '../src/utils.js';

test('可解析完整 youtube watch URL', () => {
  assert.equal(
    parseYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    'dQw4w9WgXcQ'
  );
});

test('可解析 youtu.be 短網址', () => {
  assert.equal(parseYouTubeVideoId('https://youtu.be/abc123XYZ09'), 'abc123XYZ09');
});

test('若直接輸入 11 碼影片 ID 也可接受', () => {
  assert.equal(parseYouTubeVideoId('M7lc1UVf-VE'), 'M7lc1UVf-VE');
});

test('非 youtube 字串應回傳 null', () => {
  assert.equal(parseYouTubeVideoId('https://example.com/video.mp4'), null);
});

test('獎勵影片候選清單會把主要影片放在第一個並去重', () => {
  const candidates = buildRewardVideoCandidates('M7lc1UVf-VE', [
    'M7lc1UVf-VE',
    'diQatYOQLV8',
    'bad-value',
    'u4Oza3X9Nno'
  ]);

  assert.deepEqual(candidates, ['M7lc1UVf-VE', 'diQatYOQLV8', 'u4Oza3X9Nno']);
});

test('YouTube 錯誤碼可轉成可讀訊息', () => {
  assert.equal(getYouTubeErrorMessage(101), '影片不允許嵌入播放，改用下一支影片。');
  assert.equal(getYouTubeErrorMessage(5), '影片暫時無法在 HTML5 播放器播放。');
});

test('normalizeRewardPlayback 會整理影片 ID 與秒數', () => {
  const playback = normalizeRewardPlayback(
    { videoId: 'https://youtu.be/u4Oza3X9Nno', timeSeconds: '125.9' },
    'diQatYOQLV8'
  );

  assert.deepEqual(playback, { videoId: 'u4Oza3X9Nno', timeSeconds: 125 });
});

test('resolveRewardStart 會找出候選影片中的續播位置', () => {
  const start = resolveRewardStart(
    { videoId: 'u4Oza3X9Nno', timeSeconds: 88 },
    ['diQatYOQLV8', 'u4Oza3X9Nno', 'SJ2rEpCJNQk']
  );

  assert.deepEqual(start, { index: 1, timeSeconds: 88 });
});

test('buildQuizPrompt 會產生測驗題目文字', () => {
  assert.equal(buildQuizPrompt('Elephant'), '「Elephant」是由哪個英文字母開頭？');
});

test('buildLearnCheckPrompt 在字母辨識題型會產生字母題目', () => {
  const prompt = buildLearnCheckPrompt({
    promptType: LEARN_CHECK_PROMPT_TYPES.LETTER_IDENTIFICATION,
    targetLetter: 'B',
    targetWord: 'Ball'
  });
  assert.equal(prompt, '字母「B」是哪一個？');
});

test('buildLearnCheckPrompt 在單字開頭題型會產生單字題目', () => {
  const prompt = buildLearnCheckPrompt({
    promptType: LEARN_CHECK_PROMPT_TYPES.WORD_INITIAL,
    targetLetter: 'B',
    targetWord: 'Ball'
  });
  assert.equal(prompt, '「Ball」是由哪個英文字母開頭？');
});

test('normalizeLearnCheckPromptType 預設回傳字母辨識題型', () => {
  assert.equal(
    normalizeLearnCheckPromptType('invalid-value'),
    LEARN_CHECK_PROMPT_TYPES.LETTER_IDENTIFICATION
  );
});

test('shouldSpeakPrompt 在文字改變時回傳 true', () => {
  assert.equal(
    shouldSpeakPrompt('「Apple」是由哪個英文字母開頭？', '「Bear」是由哪個英文字母開頭？'),
    true
  );
});

test('shouldSpeakPrompt 在文字相同且未強制時回傳 false', () => {
  assert.equal(
    shouldSpeakPrompt('「Apple」是由哪個英文字母開頭？', '「Apple」是由哪個英文字母開頭？'),
    false
  );
});

test('shouldSpeakPrompt 在強制朗讀時回傳 true', () => {
  assert.equal(
    shouldSpeakPrompt('「Apple」是由哪個英文字母開頭？', '「Apple」是由哪個英文字母開頭？', true),
    true
  );
});

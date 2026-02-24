import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRewardVideoCandidates,
  getYouTubeErrorMessage,
  normalizeRewardPlayback,
  parseYouTubeVideoId,
  resolveRewardStart
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

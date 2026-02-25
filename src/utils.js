export const DEFAULT_REWARD_VIDEO_FALLBACKS = [
  'diQatYOQLV8',
  'u4Oza3X9Nno',
  'SJ2rEpCJNQk',
  'M7lc1UVf-VE'
];
export const LEARN_CHECK_PROMPT_TYPES = {
  LETTER_IDENTIFICATION: 'letter_identification',
  WORD_INITIAL: 'word_initial'
};

const MAX_REWARD_PLAYBACK_SECONDS = 60 * 60 * 6;

export function parseYouTubeVideoId(input) {
  if (typeof input !== 'string') {
    return null;
  }

  const value = input.trim();
  if (isYouTubeId(value)) {
    return value;
  }

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const v = url.searchParams.get('v');
      if (isYouTubeId(v)) {
        return v;
      }

      const segments = url.pathname.split('/').filter(Boolean);
      const embedIndex = segments.findIndex((part) => part === 'embed' || part === 'shorts');
      if (embedIndex >= 0 && isYouTubeId(segments[embedIndex + 1])) {
        return segments[embedIndex + 1];
      }
    }

    if (host === 'youtu.be') {
      const first = url.pathname.split('/').filter(Boolean)[0];
      if (isYouTubeId(first)) {
        return first;
      }
    }
  } catch (_error) {
    return null;
  }

  return null;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function shuffleArray(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function buildRewardVideoCandidates(primaryVideoId, fallbackIds = DEFAULT_REWARD_VIDEO_FALLBACKS) {
  const candidates = [primaryVideoId, ...fallbackIds]
    .map((value) => parseYouTubeVideoId(value))
    .filter(Boolean);

  return [...new Set(candidates)];
}

export function getYouTubeErrorMessage(code) {
  const map = {
    2: '影片參數不正確。',
    5: '影片暫時無法在 HTML5 播放器播放。',
    100: '影片不存在或已被移除。',
    101: '影片不允許嵌入播放，改用下一支影片。',
    150: '影片不允許嵌入播放，改用下一支影片。'
  };

  return map[code] || '影片播放發生未知錯誤。';
}

export function normalizeRewardPlayback(input, fallbackVideoId = null) {
  const fallbackId = parseYouTubeVideoId(fallbackVideoId);
  const normalizedId = parseYouTubeVideoId(input?.videoId) || fallbackId || null;
  const rawSeconds = Number(input?.timeSeconds);
  const safeSeconds = Number.isFinite(rawSeconds) ? Math.max(0, Math.floor(rawSeconds)) : 0;

  return {
    videoId: normalizedId,
    timeSeconds: Math.min(MAX_REWARD_PLAYBACK_SECONDS, safeSeconds)
  };
}

export function resolveRewardStart(rewardPlayback, candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return { index: 0, timeSeconds: 0 };
  }

  const normalized = normalizeRewardPlayback(rewardPlayback, candidates[0]);
  const index = normalized.videoId ? Math.max(0, candidates.indexOf(normalized.videoId)) : 0;

  return {
    index: index >= 0 ? index : 0,
    timeSeconds: normalized.videoId && candidates[index] === normalized.videoId ? normalized.timeSeconds : 0
  };
}

export function buildQuizPrompt(targetWord) {
  return `「${String(targetWord || '')}」是由哪個英文字母開頭？`;
}

export function normalizeLearnCheckPromptType(value) {
  if (value === LEARN_CHECK_PROMPT_TYPES.WORD_INITIAL) {
    return LEARN_CHECK_PROMPT_TYPES.WORD_INITIAL;
  }

  return LEARN_CHECK_PROMPT_TYPES.LETTER_IDENTIFICATION;
}

export function buildLearnCheckPrompt({ promptType, targetLetter, targetWord }) {
  const normalizedPromptType = normalizeLearnCheckPromptType(promptType);
  if (normalizedPromptType === LEARN_CHECK_PROMPT_TYPES.WORD_INITIAL) {
    return buildQuizPrompt(targetWord);
  }

  return `字母「${String(targetLetter || '')}」是哪一個？`;
}

export function shouldSpeakPrompt(currentPrompt, lastPrompt, forceSpeak = false) {
  const nextPrompt = String(currentPrompt || '');
  if (!nextPrompt) {
    return false;
  }

  if (forceSpeak) {
    return true;
  }

  return nextPrompt !== String(lastPrompt || '');
}

function isYouTubeId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{11}$/.test(value);
}

export const DEFAULT_SETTINGS = {
  lettersPerReward: 3,
  rewardSeconds: 30,
  youtubeVideoId: '-yG4mBzGwq8',
  rewardOrientation: 'landscape',
  parentPin: '1234',
  rewardEnabled: true
};

export function createInitialState(settings = DEFAULT_SETTINGS) {
  const mergedSettings = {
    ...DEFAULT_SETTINGS,
    ...settings
  };

  return {
    settings: mergedSettings,
    learnedLetters: [],
    watchedSessions: 0,
    lastLearnedLetter: null,
    score: 0,
    streak: 0,
    rewardPlayback: {
      videoId: mergedSettings.youtubeVideoId,
      timeSeconds: 0
    },
    activeReward: {
      inProgress: false,
      remainingSeconds: 0,
      consumed: false
    }
  };
}

export function markLetterLearned(state, rawLetter) {
  const letter = normalizeLetter(rawLetter);
  if (!letter) {
    return state;
  }

  if (state.learnedLetters.includes(letter)) {
    return {
      ...state,
      lastLearnedLetter: letter
    };
  }

  return {
    ...state,
    learnedLetters: [...state.learnedLetters, letter],
    lastLearnedLetter: letter,
    score: state.score + 10,
    streak: state.streak + 1
  };
}

export function consumeRewardSession(state) {
  const status = getRewardStatus(state);
  if (status.availableSessions <= 0) {
    return state;
  }

  return {
    ...state,
    watchedSessions: status.watchedSessions + 1,
    streak: 0
  };
}

export function getRewardStatus(state) {
  const learnedCount = state.learnedLetters.length;
  const lettersPerReward = Math.max(1, Number(state.settings.lettersPerReward) || 1);
  const earnedSessions = Math.floor(learnedCount / lettersPerReward);
  const watchedSessionsRaw = Math.max(0, Number(state.watchedSessions) || 0);
  const watchedSessions = Math.min(watchedSessionsRaw, earnedSessions);
  const availableSessions = Math.max(0, earnedSessions - watchedSessions);
  const progressToNextReward = learnedCount % lettersPerReward;
  const nextMilestoneAt = (Math.floor(learnedCount / lettersPerReward) + 1) * lettersPerReward;

  return {
    learnedCount,
    lettersPerReward,
    earnedSessions,
    watchedSessions,
    availableSessions,
    progressToNextReward,
    nextMilestoneAt
  };
}

export function normalizeRewardSessions(state) {
  const status = getRewardStatus(state);
  if (status.watchedSessions === state.watchedSessions) {
    return state;
  }

  return {
    ...state,
    watchedSessions: status.watchedSessions
  };
}

export function updateSettings(state, newSettings) {
  return {
    ...state,
    settings: {
      ...state.settings,
      ...newSettings
    }
  };
}

export function resetProgress(state) {
  return {
    ...state,
    learnedLetters: [],
    watchedSessions: 0,
    lastLearnedLetter: null,
    score: 0,
    streak: 0,
    rewardPlayback: {
      videoId: state.settings.youtubeVideoId,
      timeSeconds: 0
    },
    activeReward: {
      inProgress: false,
      remainingSeconds: 0,
      consumed: false
    }
  };
}

function normalizeLetter(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]$/.test(normalized)) {
    return null;
  }

  return normalized;
}

import { LETTERS, getLetterItem } from './data.js';
import {
  DEFAULT_SETTINGS,
  consumeRewardSession,
  createInitialState,
  getRewardStatus,
  markLetterLearned,
  resetProgress,
  updateSettings
} from './reward-engine.js';
import {
  buildQuizPrompt,
  buildRewardVideoCandidates,
  clamp,
  getYouTubeErrorMessage,
  normalizeRewardPlayback,
  parseYouTubeVideoId,
  resolveRewardStart,
  shouldSpeakPrompt,
  shuffleArray
} from './utils.js';

const STORAGE_KEY = 'abc-adventure-state-v1';

let state = loadState();
let currentLetterIndex = 0;
let quizState = null;
let rewardTimerId = null;
let rewardSecondsLeft = 0;
let isRewardPlaying = false;
let toastTimerId = null;
let youtubePlayer = null;
let youtubePlayerReadyPromise = null;
let preferredVoice = null;
let preferredZhVoice = null;
let rewardSession = null;
let activeMobilePanel = 'learn';
let learnCheckState = null;
let rewardControlsUnlocked = false;
let pendingRewardResume = false;
let pinPurpose = 'parent';
let rewardLockHoldTimerId = null;
let suppressNextRewardLockClick = false;
let rewardLockActivePointerId = null;
let currentLetterAudioProgress = { letter: false, word: false };
let lastSpokenQuizPrompt = '';
let lastSpokenLearnCheckPrompt = '';
let forceSpeakQuizPrompt = false;
let speechPlaybackToken = 0;

let youtubeReadyResolver = null;
const youtubeReadyPromise = new Promise((resolve) => {
  youtubeReadyResolver = resolve;
});

window.onYouTubeIframeAPIReady = () => {
  youtubeReadyResolver();
};

if (window.YT && window.YT.Player) {
  youtubeReadyResolver();
}

const dom = {
  letterDisplay: document.getElementById('letter-display'),
  learnedBadge: document.getElementById('learned-badge'),
  emojiDisplay: document.getElementById('emoji-display'),
  wordDisplay: document.getElementById('word-display'),
  prevLetterBtn: document.getElementById('prev-letter-btn'),
  nextLetterBtn: document.getElementById('next-letter-btn'),
  speakLetterBtn: document.getElementById('speak-letter-btn'),
  speakWordBtn: document.getElementById('speak-word-btn'),
  learnedBtn: document.getElementById('learned-btn'),
  layout: document.querySelector('.layout'),
  panelCards: [...document.querySelectorAll('.panel-card')],
  dockButtons: [...document.querySelectorAll('.dock-btn')],
  alphabetGrid: document.getElementById('alphabet-grid'),
  meterFill: document.getElementById('meter-fill'),
  progressText: document.getElementById('progress-text'),
  rewardStatus: document.getElementById('reward-status'),
  scoreText: document.getElementById('score-text'),
  starStrip: document.getElementById('star-strip'),
  manualRewardBtn: document.getElementById('manual-reward-btn'),
  quizPrompt: document.getElementById('quiz-prompt'),
  quizOptions: document.getElementById('quiz-options'),
  quizResult: document.getElementById('quiz-result'),
  nextQuizBtn: document.getElementById('next-quiz-btn'),
  rewardOverlay: document.getElementById('reward-overlay'),
  rewardCountdown: document.getElementById('reward-countdown'),
  videoShell: document.getElementById('video-shell'),
  videoLockLayer: document.getElementById('video-lock-layer'),
  resumeRewardBtn: document.getElementById('resume-reward-btn'),
  toggleRewardLockBtn: document.getElementById('toggle-reward-lock-btn'),
  toast: document.getElementById('toast'),
  openPinBtn: document.getElementById('open-pin-btn'),
  pinOverlay: document.getElementById('pin-overlay'),
  pinInput: document.getElementById('pin-input'),
  pinCancelBtn: document.getElementById('pin-cancel-btn'),
  pinSubmitBtn: document.getElementById('pin-submit-btn'),
  parentOverlay: document.getElementById('parent-overlay'),
  lettersPerRewardInput: document.getElementById('letters-per-reward'),
  rewardSecondsInput: document.getElementById('reward-seconds'),
  youtubeInput: document.getElementById('youtube-input'),
  rewardOrientationInput: document.getElementById('reward-orientation'),
  newPinInput: document.getElementById('new-pin'),
  rewardEnabledInput: document.getElementById('reward-enabled'),
  saveSettingsBtn: document.getElementById('save-settings-btn'),
  resetProgressBtn: document.getElementById('reset-progress-btn'),
  parentCloseBtn: document.getElementById('parent-close-btn'),
  learnCheckOverlay: document.getElementById('learn-check-overlay'),
  learnCheckTitle: document.getElementById('learn-check-title'),
  learnCheckPrompt: document.getElementById('learn-check-prompt'),
  learnCheckOptions: document.getElementById('learn-check-options'),
  learnCheckResult: document.getElementById('learn-check-result'),
  learnCheckCancelBtn: document.getElementById('learn-check-cancel-btn')
};

init();

function init() {
  bindEvents();
  setupSpeechVoices();
  buildAlphabetGrid();
  setupNextQuizQuestion();
  applyRewardVideoOrientation();
  renderAll();
  renderMobilePanels();
  maybeResumeActiveReward();
  updateLearnedButtonState();
}

function bindEvents() {
  dom.prevLetterBtn.addEventListener('click', () => {
    selectLetterByIndex((currentLetterIndex - 1 + LETTERS.length) % LETTERS.length);
  });

  dom.nextLetterBtn.addEventListener('click', () => {
    selectLetterByIndex((currentLetterIndex + 1) % LETTERS.length);
  });

  dom.speakLetterBtn.addEventListener('click', () => {
    const item = LETTERS[currentLetterIndex];
    speakText(item.letter);
    currentLetterAudioProgress.letter = true;
    updateLearnedButtonState();
  });

  dom.speakWordBtn.addEventListener('click', () => {
    const item = LETTERS[currentLetterIndex];
    speakText(item.word);
    currentLetterAudioProgress.word = true;
    updateLearnedButtonState();
  });

  dom.learnedBtn.addEventListener('click', () => {
    const item = LETTERS[currentLetterIndex];
    if (state.learnedLetters.includes(item.letter)) {
      showToast(`${item.letter} 已經學過囉，繼續加油！`);
      return;
    }

    openLearnCheck(item);
  });

  dom.manualRewardBtn.addEventListener('click', () => {
    startRewardSession();
  });

  dom.nextQuizBtn.addEventListener('click', () => {
    setupNextQuizQuestion();
    renderQuiz();
  });

  dom.openPinBtn.addEventListener('click', () => openPinOverlay('parent'));
  dom.pinCancelBtn.addEventListener('click', closePinOverlay);
  dom.pinSubmitBtn.addEventListener('click', verifyPin);

  dom.pinInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      verifyPin();
    }
  });

  dom.parentCloseBtn.addEventListener('click', closeParentOverlay);
  dom.saveSettingsBtn.addEventListener('click', saveParentSettings);
  dom.resetProgressBtn.addEventListener('click', resetLearningProgress);
  dom.learnCheckCancelBtn.addEventListener('click', closeLearnCheck);
  dom.resumeRewardBtn.addEventListener('click', continuePendingRewardPlayback);
  dom.toggleRewardLockBtn.addEventListener('click', handleRewardLockButtonClick);
  dom.toggleRewardLockBtn.addEventListener('pointerdown', handleRewardLockPointerDown);
  dom.toggleRewardLockBtn.addEventListener('pointerup', handleRewardLockPointerUp);
  dom.toggleRewardLockBtn.addEventListener('pointercancel', handleRewardLockPointerCancel);
  dom.dockButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const nextPanel = button.dataset.panelTarget || 'learn';
      if (nextPanel !== activeMobilePanel) {
        stopSpeech();
      }
      activeMobilePanel = nextPanel;
      if (activeMobilePanel === 'quiz') {
        forceSpeakQuizPrompt = true;
      }
      renderMobilePanels();
      if (activeMobilePanel === 'quiz') {
        renderQuiz();
      }
    });
  });
  window.addEventListener('resize', () => {
    renderMobilePanels();
    applyRewardVideoOrientation();
  });
  window.addEventListener('pagehide', stopSpeech);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopSpeech();
    }
  });

  window.addEventListener(
    'keydown',
    (event) => {
      if (!isRewardPlaying) {
        return;
      }
      if (!dom.pinOverlay.classList.contains('hidden')) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    },
    { capture: true }
  );
}

function setupSpeechVoices() {
  if (!('speechSynthesis' in window)) {
    return;
  }

  const updateVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    preferredVoice =
      voices.find((voice) => voice.lang.toLowerCase().startsWith('en-us')) ||
      voices.find((voice) => voice.lang.toLowerCase().startsWith('en')) ||
      null;
    preferredZhVoice =
      voices.find((voice) => voice.lang.toLowerCase().startsWith('zh-tw')) ||
      voices.find((voice) => voice.lang.toLowerCase().startsWith('zh')) ||
      null;
  };

  updateVoice();
  window.speechSynthesis.onvoiceschanged = updateVoice;
}

function speakText(text, options = {}) {
  if (!('speechSynthesis' in window)) {
    showToast('這個瀏覽器不支援語音功能。');
    return;
  }

  beginSpeechPlayback();
  const utterance = new SpeechSynthesisUtterance(text);
  const targetLang = options.lang || 'en-US';
  utterance.lang = targetLang;
  utterance.rate = Number(options.rate) || 0.9;
  utterance.pitch = Number(options.pitch) || 1.05;

  if (targetLang.toLowerCase().startsWith('zh') && preferredZhVoice) {
    utterance.voice = preferredZhVoice;
  } else if (preferredVoice) {
    utterance.voice = preferredVoice;
  }

  window.speechSynthesis.speak(utterance);
}

function beginSpeechPlayback() {
  if (!('speechSynthesis' in window)) {
    return speechPlaybackToken;
  }

  speechPlaybackToken += 1;
  window.speechSynthesis.cancel();
  return speechPlaybackToken;
}

function stopSpeech() {
  if (!('speechSynthesis' in window)) {
    return;
  }

  speechPlaybackToken += 1;
  window.speechSynthesis.cancel();
}

function buildAlphabetGrid() {
  dom.alphabetGrid.innerHTML = '';

  LETTERS.forEach((item, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'letter-chip';
    button.textContent = item.letter;
    button.dataset.letter = item.letter;

    button.addEventListener('click', () => {
      selectLetterByIndex(index);

      if (window.matchMedia('(max-width: 980px)').matches) {
        if (activeMobilePanel !== 'learn') {
          stopSpeech();
        }
        activeMobilePanel = 'learn';
        renderMobilePanels();
      }
    });

    dom.alphabetGrid.appendChild(button);
  });
}

function selectLetterByIndex(index) {
  const nextIndex = ((index % LETTERS.length) + LETTERS.length) % LETTERS.length;
  const hasChanged = nextIndex !== currentLetterIndex;
  currentLetterIndex = nextIndex;
  renderCurrentLetter();
  renderAlphabetGrid();

  if (hasChanged) {
    currentLetterAudioProgress = { letter: false, word: false };
  }
  updateLearnedButtonState();
}

function renderAll() {
  renderCurrentLetter();
  renderAlphabetGrid();
  renderProgress();
  renderQuiz();
  renderMobilePanels();
}

function renderMobilePanels() {
  const isMobile = window.matchMedia('(max-width: 980px)').matches;

  dom.panelCards.forEach((card) => {
    if (!isMobile) {
      card.classList.remove('mobile-hidden');
      return;
    }

    const panelName = card.dataset.panel;
    card.classList.toggle('mobile-hidden', panelName !== activeMobilePanel);
  });

  dom.dockButtons.forEach((button) => {
    const isActive = button.dataset.panelTarget === activeMobilePanel;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function maybeResumeActiveReward() {
  const activeReward = state.activeReward;
  if (!activeReward?.inProgress) {
    return;
  }

  const remainingSeconds = clamp(Number(activeReward.remainingSeconds) || 0, 0, 600);
  if (remainingSeconds <= 0) {
    clearActiveRewardState();
    return;
  }

  startRewardSession({
    resume: true,
    remainingSeconds,
    consumed: Boolean(activeReward.consumed),
    requireManualStart: true
  });
}

function renderCurrentLetter() {
  const item = LETTERS[currentLetterIndex];
  dom.letterDisplay.textContent = item.letter;
  dom.emojiDisplay.textContent = item.emoji;
  dom.wordDisplay.textContent = item.word;
  dom.learnedBadge.classList.toggle('hidden', !state.learnedLetters.includes(item.letter));
  updateLearnedButtonState();
}

function renderAlphabetGrid() {
  const currentLetter = LETTERS[currentLetterIndex].letter;

  dom.alphabetGrid.querySelectorAll('.letter-chip').forEach((element) => {
    const letter = element.dataset.letter;
    element.classList.toggle('current', letter === currentLetter);
    element.classList.toggle('learned', state.learnedLetters.includes(letter));
  });
}

function renderProgress() {
  const learnedCount = state.learnedLetters.length;
  const progressPercent = (learnedCount / LETTERS.length) * 100;
  const status = getRewardStatus(state);

  dom.scoreText.textContent = `分數：${state.score}`;
  dom.progressText.textContent = `${learnedCount} / ${LETTERS.length} 字母`;
  dom.meterFill.style.width = `${progressPercent}%`;

  if (!state.settings.rewardEnabled) {
    dom.rewardStatus.textContent = '影片獎勵目前已停用（可在家長專區開啟）';
  } else if (status.availableSessions > 0) {
    dom.rewardStatus.textContent = `已解鎖 ${status.availableSessions} 次影片獎勵，可立即播放。`;
  } else {
    const remain = status.lettersPerReward - status.progressToNextReward;
    dom.rewardStatus.textContent = `再學 ${remain} 個字母可看 ${state.settings.rewardSeconds} 秒影片`;
  }

  dom.manualRewardBtn.disabled = !state.settings.rewardEnabled || status.availableSessions <= 0 || isRewardPlaying;

  renderStarStrip();
}

function renderStarStrip() {
  const starCount = Math.min(20, Math.floor(state.score / 10));
  const stars = Array.from({ length: starCount }, () => '<span class="star">⭐</span>').join('');
  dom.starStrip.innerHTML = stars || '<span>完成字母與測驗可拿星星！</span>';
}

function setupNextQuizQuestion() {
  const target = LETTERS[Math.floor(Math.random() * LETTERS.length)];
  const distractors = shuffleArray(LETTERS.filter((item) => item.letter !== target.letter)).slice(0, 3);

  quizState = {
    targetLetter: target.letter,
    targetWord: target.word,
    options: shuffleArray([target, ...distractors]).map((item) => item.letter),
    answered: false,
    selected: null,
    isCorrect: false
  };
  forceSpeakQuizPrompt = true;
}

function renderQuiz() {
  if (!quizState) {
    return;
  }

  const quizPromptText = buildQuizPrompt(quizState.targetWord);
  dom.quizPrompt.textContent = quizPromptText;
  if (shouldSpeakPrompt(quizPromptText, lastSpokenQuizPrompt, forceSpeakQuizPrompt)) {
    lastSpokenQuizPrompt = quizPromptText;
    speakQuizPrompt(quizState.targetWord);
  }
  forceSpeakQuizPrompt = false;
  dom.quizResult.textContent = quizState.answered
    ? quizState.isCorrect
      ? '答對了！你真厲害！'
      : `再試一次，正確答案是 ${quizState.targetLetter}`
    : '請選一個答案';

  dom.quizOptions.innerHTML = '';

  quizState.options.forEach((letter) => {
    const optionButton = document.createElement('button');
    optionButton.type = 'button';
    optionButton.className = 'quiz-option';
    optionButton.textContent = letter;

    if (quizState.answered && letter === quizState.targetLetter) {
      optionButton.classList.add('correct');
    }

    if (quizState.answered && quizState.selected === letter && !quizState.isCorrect) {
      optionButton.classList.add('wrong');
    }

    optionButton.disabled = quizState.answered;
    optionButton.addEventListener('click', () => answerQuiz(letter));

    dom.quizOptions.appendChild(optionButton);
  });
}

function speakQuizPrompt(targetWord) {
  if (!('speechSynthesis' in window)) {
    showToast('這個瀏覽器不支援語音功能。');
    return;
  }

  const speechToken = beginSpeechPlayback();
  const wordUtterance = new SpeechSynthesisUtterance(String(targetWord || ''));
  wordUtterance.lang = 'en-US';
  wordUtterance.rate = 0.9;
  wordUtterance.pitch = 1.05;
  if (preferredVoice) {
    wordUtterance.voice = preferredVoice;
  }

  const chineseUtterance = new SpeechSynthesisUtterance('是由哪個英文字母開頭？');
  chineseUtterance.lang = 'zh-TW';
  chineseUtterance.rate = 1;
  chineseUtterance.pitch = 1;
  if (preferredZhVoice) {
    chineseUtterance.voice = preferredZhVoice;
  }

  wordUtterance.onend = () => {
    if (speechToken !== speechPlaybackToken) {
      return;
    }
    window.speechSynthesis.speak(chineseUtterance);
  };

  window.speechSynthesis.speak(wordUtterance);
}

function answerQuiz(letter) {
  if (!quizState || quizState.answered) {
    return;
  }

  const isCorrect = letter === quizState.targetLetter;

  quizState = {
    ...quizState,
    answered: true,
    selected: letter,
    isCorrect
  };

  if (isCorrect) {
    const wasLearned = state.learnedLetters.includes(quizState.targetLetter);
    state = markLetterLearned(state, quizState.targetLetter);
    state = {
      ...state,
      score: state.score + 5
    };

    if (!wasLearned) {
      const item = getLetterItem(quizState.targetLetter);
      showToast(`測驗答對！同時學會 ${quizState.targetLetter} - ${item.word}`);
    } else {
      showToast('測驗答對！加 5 分。');
    }
  } else {
    state = {
      ...state,
      streak: 0
    };
    showToast('沒關係，再挑戰下一題！');
  }

  persistState();
  renderAll();
  maybeStartRewardSession();
}

function openLearnCheck(item) {
  const distractors = shuffleArray(LETTERS.filter((entry) => entry.letter !== item.letter))
    .slice(0, 3)
    .map((entry) => entry.letter);

  learnCheckState = {
    targetLetter: item.letter,
    targetWord: item.word,
    options: shuffleArray([item.letter, ...distractors]),
    answered: false
  };

  renderLearnCheck();
  dom.learnCheckOverlay.classList.remove('hidden');
}

function closeLearnCheck() {
  stopSpeech();
  dom.learnCheckOverlay.classList.add('hidden');
  learnCheckState = null;
  lastSpokenLearnCheckPrompt = '';
}

function renderLearnCheck() {
  if (!learnCheckState) {
    return;
  }

  dom.learnCheckTitle.textContent = `學會挑戰 ${learnCheckState.targetLetter}`;
  const learnCheckPromptText = `「${learnCheckState.targetWord}」的開頭字母是哪一個？`;
  dom.learnCheckPrompt.textContent = learnCheckPromptText;
  dom.learnCheckResult.textContent = '答對才算學會喔！';
  dom.learnCheckOptions.innerHTML = '';

  if (learnCheckPromptText !== lastSpokenLearnCheckPrompt) {
    lastSpokenLearnCheckPrompt = learnCheckPromptText;
    speakLearnCheckPrompt(learnCheckState.targetWord);
  }

  learnCheckState.options.forEach((optionLetter) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quiz-option';
    button.textContent = optionLetter;
    button.addEventListener('click', () => handleLearnCheckAnswer(optionLetter));
    dom.learnCheckOptions.appendChild(button);
  });
}

function speakLearnCheckPrompt(targetWord) {
  if (!('speechSynthesis' in window)) {
    showToast('這個瀏覽器不支援語音功能。');
    return;
  }

  const speechToken = beginSpeechPlayback();
  const wordUtterance = new SpeechSynthesisUtterance(String(targetWord || ''));
  wordUtterance.lang = 'en-US';
  wordUtterance.rate = 0.9;
  wordUtterance.pitch = 1.05;
  if (preferredVoice) {
    wordUtterance.voice = preferredVoice;
  }

  const chineseUtterance = new SpeechSynthesisUtterance('的開頭字母是哪一個？');
  chineseUtterance.lang = 'zh-TW';
  chineseUtterance.rate = 1;
  chineseUtterance.pitch = 1;
  if (preferredZhVoice) {
    chineseUtterance.voice = preferredZhVoice;
  }

  wordUtterance.onend = () => {
    if (speechToken !== speechPlaybackToken) {
      return;
    }
    window.speechSynthesis.speak(chineseUtterance);
  };

  window.speechSynthesis.speak(wordUtterance);
}

function handleLearnCheckAnswer(optionLetter) {
  if (!learnCheckState) {
    return;
  }

  const isCorrect = optionLetter === learnCheckState.targetLetter;
  if (!isCorrect) {
    dom.learnCheckResult.textContent = `還差一點點，再試一次。${learnCheckState.targetWord} 的開頭不是 ${optionLetter}。`;
    return;
  }

  completeLearnedLetter(learnCheckState.targetLetter);
  closeLearnCheck();
}

function completeLearnedLetter(letter) {
  const item = getLetterItem(letter);
  if (!item || state.learnedLetters.includes(letter)) {
    return;
  }

  state = markLetterLearned(state, letter);
  showToast(`太棒了！你學會 ${item.letter} - ${item.word}`);
  burstStars();

  persistState();
  renderAll();
  maybeStartRewardSession();
}

function maybeStartRewardSession() {
  if (isRewardPlaying || !state.settings.rewardEnabled) {
    return;
  }

  const status = getRewardStatus(state);
  if (status.availableSessions > 0) {
    startRewardSession({ resume: false });
  }
}

async function startRewardSession(options = {}) {
  const isResume = Boolean(options.resume);
  if ((isRewardPlaying && !isResume) || (!state.settings.rewardEnabled && !isResume)) {
    return;
  }
  stopSpeech();

  if (!isResume) {
    const status = getRewardStatus(state);
    if (status.availableSessions <= 0) {
      showToast('目前尚未解鎖影片獎勵。');
      return;
    }
  }

  rewardSecondsLeft = clamp(
    Number(options.remainingSeconds ?? Number(state.settings.rewardSeconds)),
    1,
    600
  );
  applyRewardVideoOrientation();
  isRewardPlaying = true;
  rewardControlsUnlocked = false;
  pendingRewardResume = Boolean(options.requireManualStart);
  dom.rewardOverlay.classList.remove('hidden');
  rewardSession = {
    playbackStarted: false,
    consumed: Boolean(options.consumed),
    autoplayRetried: false,
    candidates: buildRewardVideoCandidates(state.settings.youtubeVideoId),
    currentIndex: 0,
    startSeconds: 0,
    playbackWatchdogId: null
  };

  if (rewardSession.candidates.length === 0) {
    abortRewardSession('找不到可播放的 YouTube 影片，請到家長專區設定。');
    return;
  }

  const rewardStart = resolveRewardStart(state.rewardPlayback, rewardSession.candidates);
  rewardSession.currentIndex = rewardStart.index;
  rewardSession.startSeconds = rewardStart.timeSeconds;
  updateCountdownLabel();
  renderRewardLockUI();
  syncActiveRewardState();

  if (pendingRewardResume) {
    showToast('尚有未完成的獎勵時間，按「繼續播放」完成。');
    return;
  }

  try {
    await ensureYouTubePlayer();
    playCurrentRewardCandidate();
  } catch (_error) {
    abortRewardSession('影片播放器初始化失敗，請檢查網路或 YouTube 設定。');
  }
}

function endRewardSession() {
  saveRewardPlaybackProgress(false);
  clearPlaybackWatchdog();
  cancelRewardLockHold();
  clearInterval(rewardTimerId);
  rewardTimerId = null;
  isRewardPlaying = false;
  rewardSession = null;
  rewardControlsUnlocked = false;
  pendingRewardResume = false;
  dom.rewardOverlay.classList.add('hidden');
  clearActiveRewardState();

  if (youtubePlayer) {
    youtubePlayer.stopVideo();
  }

  renderProgress();
  showToast('獎勵時間結束，回到 ABC 學習！');
}

async function ensureYouTubePlayer() {
  if (youtubePlayerReadyPromise) {
    return youtubePlayerReadyPromise;
  }

  youtubePlayerReadyPromise = (async () => {
    await Promise.race([
      youtubeReadyPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('YouTube API timeout')), 8000))
    ]);

    if (!window.YT || !window.YT.Player) {
      throw new Error('YouTube API not ready');
    }

    return new Promise((resolve) => {
      youtubePlayer = new window.YT.Player('youtube-player', {
        videoId: state.settings.youtubeVideoId,
        playerVars: {
          autoplay: 1,
          mute: 1,
          controls: 1,
          disablekb: 1,
          fs: 0,
          rel: 0,
          playsinline: 1,
          iv_load_policy: 3,
          modestbranding: 1,
          origin: window.location.origin
        },
        events: {
          onReady: () => resolve(youtubePlayer),
          onStateChange: handlePlayerStateChange,
          onError: handlePlayerError,
          onAutoplayBlocked: handleAutoplayBlocked
        }
      });
    });
  })();

  return youtubePlayerReadyPromise;
}

function playCurrentRewardCandidate() {
  if (!isRewardPlaying || !rewardSession) {
    return;
  }

  const videoId = rewardSession.candidates[rewardSession.currentIndex];
  if (!videoId) {
    abortRewardSession('目前無可用的獎勵影片，請更換 YouTube 連結。');
    return;
  }

  clearPlaybackWatchdog();
  rewardSession.playbackStarted = false;
  rewardSession.autoplayRetried = false;
  const startSeconds = Math.max(0, Math.floor(Number(rewardSession.startSeconds) || 0));
  rewardSession.startSeconds = 0;

  youtubePlayer.mute();
  youtubePlayer.loadVideoById(videoId, startSeconds, 'large');
  youtubePlayer.playVideo();

  rewardSession.playbackWatchdogId = setTimeout(() => {
    if (!rewardSession || rewardSession.playbackStarted || !isRewardPlaying) {
      return;
    }

    tryNextRewardCandidate('目前影片沒有開始播放，改用下一支。');
  }, 5000);
}

function handlePlayerStateChange(event) {
  if (!isRewardPlaying || !rewardSession || !window.YT || !window.YT.PlayerState) {
    return;
  }

  if (event.data === window.YT.PlayerState.PLAYING) {
    clearPlaybackWatchdog();

    if (!rewardSession.playbackStarted) {
      rewardSession.playbackStarted = true;
      consumeRewardIfNeeded();
      startRewardCountdownIfNeeded();

      setTimeout(() => {
        if (!isRewardPlaying || !rewardSession) {
          return;
        }
        youtubePlayer.unMute();
        youtubePlayer.setVolume(100);
      }, 300);
    }
    return;
  }

  if (event.data === window.YT.PlayerState.ENDED && rewardSecondsLeft > 0) {
    if (rewardSession.candidates.length > 1) {
      rewardSession.currentIndex = (rewardSession.currentIndex + 1) % rewardSession.candidates.length;
      rewardSession.startSeconds = 0;
      playCurrentRewardCandidate();
      return;
    }

    youtubePlayer.seekTo(0, true);
    youtubePlayer.playVideo();
  }
}

function handlePlayerError(event) {
  if (!isRewardPlaying || !rewardSession) {
    return;
  }

  const code = Number(event?.data);
  const message = getYouTubeErrorMessage(code);
  tryNextRewardCandidate(message);
}

function handleAutoplayBlocked() {
  if (!isRewardPlaying || !rewardSession) {
    return;
  }

  if (!rewardSession.autoplayRetried) {
    rewardSession.autoplayRetried = true;
    youtubePlayer.mute();
    youtubePlayer.playVideo();
    return;
  }

  tryNextRewardCandidate('瀏覽器擋下自動播放，改用下一支影片。');
}

function tryNextRewardCandidate(reason) {
  if (!rewardSession) {
    return;
  }

  rewardSession.currentIndex += 1;
  rewardSession.startSeconds = 0;

  if (rewardSession.currentIndex >= rewardSession.candidates.length) {
    abortRewardSession(`${reason} 請到家長專區更換影片。`);
    return;
  }

  showToast(reason);
  playCurrentRewardCandidate();
}

function consumeRewardIfNeeded() {
  if (!rewardSession || rewardSession.consumed) {
    return;
  }

  state = consumeRewardSession(state);
  rewardSession.consumed = true;
  syncActiveRewardState();
  renderProgress();
}

function startRewardCountdownIfNeeded() {
  if (rewardTimerId) {
    return;
  }

  clearInterval(rewardTimerId);
  rewardTimerId = setInterval(() => {
    rewardSecondsLeft -= 1;
    updateCountdownLabel();
    updateRewardRuntimeSnapshot();

    if (rewardSecondsLeft <= 0) {
      endRewardSession();
    }
  }, 1000);
}

function abortRewardSession(message) {
  saveRewardPlaybackProgress(false);
  clearPlaybackWatchdog();
  cancelRewardLockHold();
  clearInterval(rewardTimerId);
  rewardTimerId = null;
  isRewardPlaying = false;
  rewardSession = null;
  rewardControlsUnlocked = false;
  pendingRewardResume = false;
  dom.rewardOverlay.classList.add('hidden');
  clearActiveRewardState();

  if (youtubePlayer) {
    youtubePlayer.stopVideo();
  }

  renderProgress();
  showToast(message);
}

function clearPlaybackWatchdog() {
  if (!rewardSession?.playbackWatchdogId) {
    return;
  }

  clearTimeout(rewardSession.playbackWatchdogId);
  rewardSession.playbackWatchdogId = null;
}

function saveRewardPlaybackProgress(shouldPersist = true) {
  if (!rewardSession || rewardSession.candidates.length === 0) {
    return;
  }

  const activeVideoId = rewardSession.candidates[rewardSession.currentIndex] || state.settings.youtubeVideoId;
  let currentSeconds = rewardSession.startSeconds || 0;

  if (youtubePlayer && typeof youtubePlayer.getCurrentTime === 'function') {
    try {
      currentSeconds = youtubePlayer.getCurrentTime();
    } catch (_error) {
      currentSeconds = rewardSession.startSeconds || 0;
    }
  }

  state = {
    ...state,
    rewardPlayback: normalizeRewardPlayback(
      { videoId: activeVideoId, timeSeconds: currentSeconds },
      state.settings.youtubeVideoId
    )
  };

  if (shouldPersist) {
    persistState();
  }
}

function syncActiveRewardState(shouldPersist = true) {
  const consumed = Boolean(rewardSession?.consumed);
  state = {
    ...state,
    activeReward: {
      inProgress: Boolean(isRewardPlaying),
      remainingSeconds: isRewardPlaying ? Math.max(0, Math.floor(rewardSecondsLeft)) : 0,
      consumed
    }
  };

  if (shouldPersist) {
    persistState();
  }
}

function updateRewardRuntimeSnapshot() {
  if (!isRewardPlaying) {
    return;
  }

  saveRewardPlaybackProgress(false);
  syncActiveRewardState(true);
}

function clearActiveRewardState() {
  state = {
    ...state,
    activeReward: {
      inProgress: false,
      remainingSeconds: 0,
      consumed: false
    }
  };
  persistState();
}

function renderRewardLockUI() {
  dom.videoLockLayer.classList.toggle('unlocked', rewardControlsUnlocked);
  dom.resumeRewardBtn.classList.toggle('hidden', !pendingRewardResume);
  if (rewardControlsUnlocked) {
    dom.toggleRewardLockBtn.textContent = '重新鎖定';
    return;
  }

  if (dom.toggleRewardLockBtn.classList.contains('pressing')) {
    dom.toggleRewardLockBtn.textContent = '長按中...';
    return;
  }

  dom.toggleRewardLockBtn.textContent = '長按2秒解鎖';
}

async function continuePendingRewardPlayback() {
  if (!isRewardPlaying || !pendingRewardResume) {
    return;
  }

  pendingRewardResume = false;
  renderRewardLockUI();

  try {
    await ensureYouTubePlayer();
    playCurrentRewardCandidate();
  } catch (_error) {
    abortRewardSession('影片播放器初始化失敗，請檢查網路或 YouTube 設定。');
  }
}

function requestToggleRewardLock() {
  if (!isRewardPlaying) {
    return;
  }

  if (rewardControlsUnlocked) {
    rewardControlsUnlocked = false;
    renderRewardLockUI();
    showToast('已重新鎖定播放控制。');
    return;
  }

  openPinOverlay('reward_unlock');
}

function handleRewardLockButtonClick(event) {
  if (!isRewardPlaying) {
    return;
  }

  if (suppressNextRewardLockClick) {
    suppressNextRewardLockClick = false;
    event.preventDefault();
    return;
  }

  if (rewardControlsUnlocked) {
    requestToggleRewardLock();
    return;
  }

  showToast('請長按 2 秒再解除鎖定。');
}

function handleRewardLockPointerDown(event) {
  if (!isRewardPlaying || rewardControlsUnlocked) {
    return;
  }

  cancelRewardLockHold();
  if (typeof event.pointerId === 'number') {
    rewardLockActivePointerId = event.pointerId;
    try {
      dom.toggleRewardLockBtn.setPointerCapture(event.pointerId);
    } catch (_error) {
      rewardLockActivePointerId = null;
    }
  }
  dom.toggleRewardLockBtn.classList.add('pressing');
  renderRewardLockUI();

  rewardLockHoldTimerId = setTimeout(() => {
    rewardLockHoldTimerId = null;
    dom.toggleRewardLockBtn.classList.remove('pressing');
    releaseRewardLockPointer();
    renderRewardLockUI();
    suppressNextRewardLockClick = true;
    requestToggleRewardLock();
  }, 2000);
}

function handleRewardLockPointerUp(event) {
  cancelRewardLockHold(event.pointerId);
}

function handleRewardLockPointerCancel(event) {
  cancelRewardLockHold(event.pointerId);
}

function cancelRewardLockHold(pointerId = null) {
  if (
    pointerId !== null &&
    rewardLockActivePointerId !== null &&
    pointerId !== rewardLockActivePointerId
  ) {
    return;
  }

  if (rewardLockHoldTimerId) {
    clearTimeout(rewardLockHoldTimerId);
    rewardLockHoldTimerId = null;
  }

  releaseRewardLockPointer();
  if (dom.toggleRewardLockBtn.classList.contains('pressing')) {
    dom.toggleRewardLockBtn.classList.remove('pressing');
    renderRewardLockUI();
  }
}

function releaseRewardLockPointer() {
  if (rewardLockActivePointerId === null) {
    return;
  }

  try {
    if (dom.toggleRewardLockBtn.hasPointerCapture(rewardLockActivePointerId)) {
      dom.toggleRewardLockBtn.releasePointerCapture(rewardLockActivePointerId);
    }
  } catch (_error) {
    // ignore
  } finally {
    rewardLockActivePointerId = null;
  }
}

function updateCountdownLabel() {
  const minutes = String(Math.floor(rewardSecondsLeft / 60)).padStart(2, '0');
  const seconds = String(rewardSecondsLeft % 60).padStart(2, '0');
  dom.rewardCountdown.textContent = `${minutes}:${seconds}`;
}

function openPinOverlay(mode = 'parent') {
  stopSpeech();
  pinPurpose = mode;
  dom.pinOverlay.classList.remove('hidden');
  dom.pinInput.value = '';
  dom.pinInput.focus();
}

function closePinOverlay() {
  dom.pinOverlay.classList.add('hidden');
  pinPurpose = 'parent';
}

function verifyPin() {
  const inputPin = dom.pinInput.value.trim();
  if (inputPin !== state.settings.parentPin) {
    showToast('PIN 錯誤，請家長重新輸入。');
    dom.pinInput.value = '';
    dom.pinInput.focus();
    return;
  }

  const currentPurpose = pinPurpose;
  closePinOverlay();

  if (currentPurpose === 'reward_unlock') {
    rewardControlsUnlocked = true;
    renderRewardLockUI();
    showToast('家長已解除鎖定。');
    return;
  }

  openParentOverlay();
}

function openParentOverlay() {
  stopSpeech();
  dom.parentOverlay.classList.remove('hidden');
  dom.lettersPerRewardInput.value = state.settings.lettersPerReward;
  dom.rewardSecondsInput.value = state.settings.rewardSeconds;
  dom.youtubeInput.value = state.settings.youtubeVideoId;
  dom.rewardOrientationInput.value = normalizeRewardOrientation(state.settings.rewardOrientation);
  dom.newPinInput.value = '';
  dom.rewardEnabledInput.checked = Boolean(state.settings.rewardEnabled);
}

function closeParentOverlay() {
  dom.parentOverlay.classList.add('hidden');
}

function saveParentSettings() {
  const previousPlayback = state.rewardPlayback;
  const lettersPerReward = clamp(Number(dom.lettersPerRewardInput.value) || 5, 1, 26);
  const rewardSeconds = clamp(Number(dom.rewardSecondsInput.value) || 180, 10, 600);
  const youtubeInput = dom.youtubeInput.value.trim();
  const rewardOrientation = normalizeRewardOrientation(dom.rewardOrientationInput.value);
  const parsedVideoId = parseYouTubeVideoId(youtubeInput);

  if (!parsedVideoId) {
    showToast('YouTube 連結格式不正確，請重新輸入。');
    return;
  }

  const pinInput = dom.newPinInput.value.trim();
  let parentPin = state.settings.parentPin;

  if (pinInput.length > 0) {
    if (!/^\d{4,8}$/.test(pinInput)) {
      showToast('PIN 必須是 4 到 8 碼數字。');
      return;
    }
    parentPin = pinInput;
  }

  state = updateSettings(state, {
    lettersPerReward,
    rewardSeconds,
    youtubeVideoId: parsedVideoId,
    rewardOrientation,
    parentPin,
    rewardEnabled: dom.rewardEnabledInput.checked
  });
  state = {
    ...state,
    rewardPlayback: normalizeRewardPlayback(
      previousPlayback?.videoId === parsedVideoId ? previousPlayback : { videoId: parsedVideoId, timeSeconds: 0 },
      parsedVideoId
    )
  };

  persistState();
  applyRewardVideoOrientation();
  renderProgress();
  closeParentOverlay();

  showToast('家長設定已儲存。');
}

function resetLearningProgress() {
  const confirmed = window.confirm('確定要清除學習進度嗎？');
  if (!confirmed) {
    return;
  }

  state = resetProgress(state);
  setupNextQuizQuestion();
  persistState();
  renderAll();
  closeParentOverlay();
  showToast('學習進度已重設。');
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createInitialState(DEFAULT_SETTINGS);
  }

  try {
    const parsed = JSON.parse(raw);
    const settings = normalizeSettings(parsed.settings || DEFAULT_SETTINGS);
    const initial = createInitialState(settings);
    const learnedLetters = dedupeLetters(parsed.learnedLetters || []);
    const rewardPlayback = normalizeRewardPlayback(parsed.rewardPlayback, settings.youtubeVideoId);
    const activeReward = normalizeActiveReward(parsed.activeReward);

    return {
      ...initial,
      learnedLetters,
      watchedSessions: Math.max(0, Number(parsed.watchedSessions) || 0),
      score: Math.max(0, Number(parsed.score) || 0),
      streak: Math.max(0, Number(parsed.streak) || 0),
      lastLearnedLetter: getLetterItem(parsed.lastLearnedLetter) ? parsed.lastLearnedLetter : null,
      rewardPlayback,
      activeReward
    };
  } catch (_error) {
    return createInitialState(DEFAULT_SETTINGS);
  }
}

function normalizeSettings(settings) {
  const lettersPerReward = clamp(Number(settings.lettersPerReward) || DEFAULT_SETTINGS.lettersPerReward, 1, 26);
  const rewardSeconds = clamp(
    Number(
      settings.rewardSeconds ??
        (Number.isFinite(Number(settings.rewardMinutes)) ? Number(settings.rewardMinutes) * 60 : NaN)
    ) || DEFAULT_SETTINGS.rewardSeconds,
    10,
    600
  );
  const youtubeVideoId =
    parseYouTubeVideoId(settings.youtubeVideoId) || parseYouTubeVideoId(DEFAULT_SETTINGS.youtubeVideoId);

  const pinRaw = String(settings.parentPin || DEFAULT_SETTINGS.parentPin);
  const parentPin = /^\d{4,8}$/.test(pinRaw) ? pinRaw : DEFAULT_SETTINGS.parentPin;
  const rewardOrientation = normalizeRewardOrientation(settings.rewardOrientation);

  return {
    ...DEFAULT_SETTINGS,
    lettersPerReward,
    rewardSeconds,
    youtubeVideoId,
    rewardOrientation,
    parentPin,
    rewardEnabled: settings.rewardEnabled !== false
  };
}

function normalizeRewardOrientation(value) {
  return value === 'portrait' ? 'portrait' : 'landscape';
}

function applyRewardVideoOrientation() {
  if (!dom.videoShell) {
    return;
  }

  const orientation = normalizeRewardOrientation(state.settings.rewardOrientation);
  const shouldUseMobileLandscape = orientation === 'portrait' && window.matchMedia('(max-width: 980px)').matches;
  dom.videoShell.classList.toggle('portrait', orientation === 'portrait');
  dom.videoShell.classList.toggle('mobile-landscape-playback', shouldUseMobileLandscape);
}

function updateLearnedButtonState() {
  const ready = currentLetterAudioProgress.letter && currentLetterAudioProgress.word;
  dom.learnedBtn.disabled = !ready;
  dom.learnedBtn.title = ready ? '我學會了' : '請先播放字母與單字';
}

function normalizeActiveReward(value) {
  const remainingSeconds = clamp(Number(value?.remainingSeconds) || 0, 0, 600);
  return {
    inProgress: Boolean(value?.inProgress) && remainingSeconds > 0,
    remainingSeconds,
    consumed: Boolean(value?.consumed)
  };
}

function dedupeLetters(input) {
  const seen = new Set();
  const result = [];

  input.forEach((letter) => {
    const normalized = String(letter || '').toUpperCase();
    if (!/^[A-Z]$/.test(normalized)) {
      return;
    }
    if (seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    result.push(normalized);
  });

  return result;
}

function burstStars() {
  for (let i = 0; i < 8; i += 1) {
    const el = document.createElement('span');
    el.className = 'pop-star';
    el.textContent = '⭐';
    el.style.left = `${45 + Math.random() * 10}%`;
    el.style.top = `${58 + Math.random() * 5}%`;
    el.style.setProperty('--dx', `${(Math.random() - 0.5) * 110}px`);
    el.style.setProperty('--dy', `${-40 - Math.random() * 90}px`);
    document.body.appendChild(el);

    setTimeout(() => {
      el.remove();
    }, 800);
  }
}

function showToast(message) {
  dom.toast.textContent = message;
  dom.toast.classList.add('show');
  clearTimeout(toastTimerId);

  toastTimerId = setTimeout(() => {
    dom.toast.classList.remove('show');
  }, 1700);
}

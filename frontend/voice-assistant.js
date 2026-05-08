const ResumeVoiceAssistant = (() => {
  const RECOGNITION_CONSTRUCTOR =
    window.ResumeForgeMicSupport && typeof ResumeForgeMicSupport.getSpeechRecognition === 'function'
      ? ResumeForgeMicSupport.getSpeechRecognition()
      : window.SpeechRecognition || window.webkitSpeechRecognition || null;

  function create(userConfig) {
    const preset = getPreset(userConfig.resumeType || 'technical');
    const config = {
      mountSelector: '#voiceAssistantMount',
      launchLabel: 'Start AI Resume Builder',
      languageOptions: [
        { code: 'en-IN', label: 'English' },
        { code: 'hi-IN', label: 'Hindi' },
      ],
      onSessionChange: null,
      ...preset,
      ...userConfig,
    };

    const mount = document.querySelector(config.mountSelector);
    if (!mount) {
      throw new Error(`Voice assistant mount point "${config.mountSelector}" was not found.`);
    }

    mount.innerHTML = buildMarkup(config);

    // Keep the launcher inside the page flow, but move the fixed modal to
    // <body>. This prevents animated/translated parent sections from breaking
    // the modal's viewport positioning and z-index stack.
    const modal = mount.querySelector('.voice-assistant-modal');
    if (modal) {
      document.body.appendChild(modal);
    }

    const elements = getElements(mount, modal);
    const state = {
      answers: {},
      closeTimer: null,
      formattedAnswers: {},
      currentStepIndex: 0,
      generated: {},
      isOpen: false,
      lastPrompt: '',
      lastTranscript: '',
      recognition: null,
      recognitionError: '',
      retryCount: 0,
      selectedLanguage: config.languageOptions[0].code,
      sessionStatus: 'idle',
      speakToken: 0,
      transcript: [],
      typingTimer: null,
      awaitingRecognitionResult: false,
      isStoppedManually: false,
    };

    bindEvents(config, elements, state);
    applyLanguageState(elements, state, config);
    renderTranscript(elements, state.transcript);
    renderProgress(elements, state, config);
    setAssistantState(elements, state, 'idle', 'Voice assistant ready');
    typePrompt(elements, state, 'Press start to let the assistant build your resume by voice.');

    if (!RECOGNITION_CONSTRUCTOR) {
      elements.supportMessage.textContent =
        'Voice input works best in Chrome or Edge on localhost or HTTPS. Manual resume filling still works normally.';
      elements.launchButton.disabled = true;
      elements.actionStart.disabled = true;
      setAssistantState(elements, state, 'error', 'Speech recognition unavailable');
    }

    return {
      close() {
        closePanel(elements, state);
      },
      exportSession() {
        return exportSession(state);
      },
      importSession(session) {
        importSession(config, elements, state, session);
      },
      open() {
        openPanel(elements, state);
      },
      start() {
        openPanel(elements, state);
        beginFlow(config, elements, state, false);
      },
    };
  }

  function bindEvents(config, elements, state) {
    elements.launchButton.addEventListener('click', async () => {
      openPanel(elements, state);
      if (!(await prepareVoiceInput(config, elements, state))) {
        return;
      }
      beginFlow(config, elements, state, false);
    });

    elements.closeButton.addEventListener('click', () => {
      closePanel(elements, state);
    });

    elements.backdrop.addEventListener('click', () => {
      closePanel(elements, state);
    });

    elements.actionStart.addEventListener('click', async () => {
      if (!(await prepareVoiceInput(config, elements, state))) {
        return;
      }
      beginFlow(config, elements, state, true);
    });

    elements.actionRetry.addEventListener('click', () => {
      retryCurrentStep(config, elements, state, true);
    });

    elements.actionRepeat.addEventListener('click', () => {
      repeatCurrentStep(config, elements, state);
    });

    elements.actionSkip.addEventListener('click', () => {
      skipCurrentStep(config, elements, state, 'Skipped by user.');
    });

    elements.languageButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedLanguage = button.dataset.language || state.selectedLanguage;
        applyLanguageState(elements, state, config);
        persistSession(config, state);
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.isOpen) {
        closePanel(elements, state);
      }
    });
  }

  function buildMarkup(config) {
    const languageButtons = config.languageOptions
      .map(
        (language) => `
          <button class="assistant-language-pill" type="button" data-language="${language.code}">
            ${escapeHtml(language.label)}
          </button>
        `,
      )
      .join('');

    return `
      <section class="assistant-launch-card glass-card assistant-theme-${escapeHtml(config.resumeType)}">
        <div class="assistant-launch-copy">
          <span class="assistant-kicker">Two ways to build</span>
          <h2>Type it yourself or let AI guide the conversation.</h2>
          <p>${escapeHtml(config.description)}</p>
          <div class="assistant-mode-row">
            <div class="assistant-mode-pill">
              <strong>Option 1</strong>
              <span>Manual form filling</span>
            </div>
            <div class="assistant-mode-pill assistant-mode-pill-voice">
              <strong>Option 2</strong>
              <span>AI voice assistant</span>
            </div>
          </div>
        </div>
        <button class="btn-primary assistant-launch-button" type="button">
          ${escapeHtml(config.launchLabel)}
        </button>
      </section>

      <div class="voice-assistant-modal" role="dialog" aria-modal="true" aria-label="AI voice resume assistant" hidden>
        <div class="voice-assistant-backdrop"></div>
        <section class="voice-assistant-panel glass-card assistant-theme-${escapeHtml(config.resumeType)}">
          <button class="voice-assistant-close" type="button" aria-label="Close AI voice assistant">x</button>

          <div class="voice-assistant-scroll">
            <div class="voice-assistant-hero">
              <div class="voice-assistant-orb-shell">
                <div class="voice-assistant-orb"></div>
                <div class="voice-assistant-mic">
                  <span class="voice-assistant-mic-ring"></span>
                  <span class="voice-assistant-mic-ring voice-assistant-mic-ring-delay"></span>
                  <span class="voice-assistant-mic-core"></span>
                </div>
                <div class="voice-assistant-waveform" aria-hidden="true">
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>

              <div class="voice-assistant-headline">
                <span class="assistant-kicker">AI Voice Resume Assistant</span>
                <h3>${escapeHtml(config.title)}</h3>
                <p>${escapeHtml(config.helperText)}</p>
              </div>
            </div>

            <div class="voice-assistant-meta">
              <div class="voice-assistant-status-chip">
                <span class="voice-assistant-status-dot"></span>
                <span class="voice-assistant-status-label">Voice assistant ready</span>
              </div>
              <div class="voice-assistant-progress">
                <span class="voice-assistant-progress-text">0 / ${config.steps.length}</span>
                <div class="voice-assistant-progress-track">
                  <span class="voice-assistant-progress-bar"></span>
                </div>
              </div>
            </div>

            <div class="voice-assistant-language">
              <span>Listening language</span>
              <div class="voice-assistant-language-group">
                ${languageButtons}
              </div>
            </div>

            <div class="voice-assistant-prompt-card">
              <span class="voice-assistant-label">Current question</span>
              <p class="voice-assistant-typing-text">Press start to let the assistant build your resume by voice.</p>
            </div>

            <div class="voice-assistant-response-grid">
              <article class="voice-assistant-response-card">
                <span class="voice-assistant-label">Live response</span>
                <p class="voice-assistant-live-response">Waiting for your answer.</p>
              </article>
              <article class="voice-assistant-response-card">
                <span class="voice-assistant-label">Assistant help</span>
                <p class="voice-assistant-support-message">
                  Say <strong>skip</strong>, <strong>repeat</strong>, <strong>back</strong>, or <strong>open skills</strong> at any time.
                </p>
              </article>
            </div>

            <div class="voice-assistant-actions">
              <button class="btn-primary assistant-action-start" type="button">Start / Restart</button>
              <button class="btn-secondary assistant-action-retry" type="button">Retry</button>
              <button class="btn-secondary assistant-action-repeat" type="button">Repeat</button>
              <button class="btn-secondary assistant-action-skip" type="button">Skip</button>
            </div>

            <div class="voice-assistant-transcript">
              <div class="voice-assistant-transcript-header">
                <span class="assistant-kicker">Saved transcript</span>
                <span class="voice-assistant-transcript-count">0 answers</span>
              </div>
              <div class="voice-assistant-transcript-list"></div>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  function getElements(mount, modal) {
    const modalRoot = modal || mount;

    return {
      actionRepeat: modalRoot.querySelector('.assistant-action-repeat'),
      actionRetry: modalRoot.querySelector('.assistant-action-retry'),
      actionSkip: modalRoot.querySelector('.assistant-action-skip'),
      actionStart: modalRoot.querySelector('.assistant-action-start'),
      backdrop: modalRoot.querySelector('.voice-assistant-backdrop'),
      closeButton: modalRoot.querySelector('.voice-assistant-close'),
      languageButtons: Array.from(modalRoot.querySelectorAll('[data-language]')),
      launchButton: mount.querySelector('.assistant-launch-button'),
      liveResponse: modalRoot.querySelector('.voice-assistant-live-response'),
      modal: modalRoot,
      panel: modalRoot.querySelector('.voice-assistant-panel'),
      progressBar: modalRoot.querySelector('.voice-assistant-progress-bar'),
      progressText: modalRoot.querySelector('.voice-assistant-progress-text'),
      promptText: modalRoot.querySelector('.voice-assistant-typing-text'),
      statusLabel: modalRoot.querySelector('.voice-assistant-status-label'),
      supportMessage: modalRoot.querySelector('.voice-assistant-support-message'),
      transcriptCount: modalRoot.querySelector('.voice-assistant-transcript-count'),
      transcriptList: modalRoot.querySelector('.voice-assistant-transcript-list'),
    };
  }

  function openPanel(elements, state) {
    if (state.closeTimer) {
      window.clearTimeout(state.closeTimer);
      state.closeTimer = null;
    }

    elements.modal.hidden = false;
    state.isOpen = true;
    document.body.classList.add('voice-assistant-lock');
    requestAnimationFrame(() => {
      elements.modal.classList.add('is-open');
    });
  }

  function closePanel(elements, state) {
    stopSpeaking(state);
    stopListening(state);
    clearTyping(state);
    state.isOpen = false;
    elements.modal.classList.remove('is-open');
    document.body.classList.remove('voice-assistant-lock');

    state.closeTimer = window.setTimeout(() => {
      elements.modal.hidden = true;
      state.closeTimer = null;
    }, 180);
  }

  function beginFlow(config, elements, state, forceRestart) {
    if (!RECOGNITION_CONSTRUCTOR) {
      return;
    }

    if (forceRestart || state.sessionStatus === 'completed') {
      resetSession(config, elements, state);
    }

    if (state.currentStepIndex >= config.steps.length) {
      state.currentStepIndex = 0;
    }

    askCurrentStep(config, elements, state, false);
  }

  async function prepareVoiceInput(config, elements, state) {
    if (window.ResumeForgeMicSupport && typeof ResumeForgeMicSupport.requestMicrophone === 'function') {
      const status = await ResumeForgeMicSupport.requestMicrophone();
      if (!status.canUseVoice) {
        state.recognitionError = status.reason;
        elements.supportMessage.textContent = status.message;
        setAssistantState(elements, state, 'error', 'Voice input unavailable');
        return false;
      }

      state.recognitionError = '';
      return true;
    }

    if (!RECOGNITION_CONSTRUCTOR) {
      return false;
    }

    return true;
  }

  function resetSession(config, elements, state) {
    stopSpeaking(state);
    stopListening(state);
    clearTyping(state);

    state.answers = {};
    state.formattedAnswers = {};
    state.currentStepIndex = 0;
    state.generated = {};
    state.lastPrompt = '';
    state.lastTranscript = '';
    state.retryCount = 0;
    state.sessionStatus = 'idle';
    state.transcript = [];

    renderTranscript(elements, state.transcript);
    renderProgress(elements, state, config);
    setAssistantState(elements, state, 'idle', 'Voice assistant ready');
    elements.liveResponse.textContent = 'Waiting for your answer.';
    persistSession(config, state);
  }

  function askCurrentStep(config, elements, state, isRepeat) {
    const step = config.steps[state.currentStepIndex];
    if (!step) {
      completeFlow(config, elements, state);
      return;
    }

    if (step.tab) {
      ResumeBuilderPage.switchTabByName(step.tab);
    }

    if (step.containerId && step.requiredEntries) {
      ResumeBuilderPage.ensureRepeaterCount(step.containerId, step.requiredEntries, step.entryClassName);
    }

    if (step.fieldId) {
      ResumeBuilderPage.highlightField(step.fieldId);
    }

    const prompt = isRepeat ? `Repeating the question. ${step.question}` : step.question;
    state.lastPrompt = prompt;
    setAssistantState(elements, state, 'speaking', `Question ${state.currentStepIndex + 1} of ${config.steps.length}`);
    renderProgress(elements, state, config);
    typePrompt(elements, state, prompt);

    speakPrompt(state, prompt, selectVoice(state.selectedLanguage))
      .then(() => {
        if (!state.isOpen) {
          return;
        }

        startListening(config, elements, state);
      })
      .catch(() => {
        startListening(config, elements, state);
      });
  }

  function startListening(config, elements, state) {
    stopListening(state);

    const recognition = new RECOGNITION_CONSTRUCTOR();
    state.recognition = recognition;
    state.awaitingRecognitionResult = true;
    state.isStoppedManually = false;
    state.lastTranscript = '';
    state.recognitionError = '';

    recognition.lang = state.selectedLanguage;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setAssistantState(elements, state, 'listening', 'Listening for your answer');
      elements.liveResponse.textContent = 'Listening...';
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = String(event.results[index][0].transcript || '').trim();
        if (event.results[index].isFinal) {
          finalTranscript += `${transcript} `;
        } else {
          interimTranscript += `${transcript} `;
        }
      }

      if (interimTranscript.trim()) {
        elements.liveResponse.textContent = interimTranscript.trim();
      }

      if (finalTranscript.trim()) {
        state.lastTranscript = finalTranscript.trim();
        elements.liveResponse.textContent = state.lastTranscript;
      }
    };

    recognition.onerror = (event) => {
      state.recognitionError = event.error || 'unknown-error';
    };

    recognition.onend = () => {
      state.recognition = null;

      if (state.isStoppedManually) {
        state.isStoppedManually = false;
        return;
      }

      if (state.lastTranscript) {
        processTranscript(config, elements, state, state.lastTranscript);
        return;
      }

      handleRecognitionFailure(config, elements, state);
    };

    try {
      recognition.start();
    } catch (error) {
      state.recognition = null;
      elements.liveResponse.textContent = 'Microphone could not start.';
      handleRecognitionFailure(config, elements, state, error.message);
    }
  }

  function stopListening(state) {
    if (!state.recognition) {
      return;
    }

    try {
      state.isStoppedManually = true;
      state.recognition.stop();
    } catch (error) {
      state.isStoppedManually = true;
    }

    state.recognition = null;
  }

  function handleRecognitionFailure(config, elements, state, overrideReason) {
    const reason = overrideReason || state.recognitionError || 'no-speech';
    state.retryCount += 1;

    const feedback =
      reason === 'not-allowed'
        ? 'Microphone access was blocked. Please allow microphone access and try again.'
        : "I couldn't understand that clearly. Let's try once more.";

    elements.supportMessage.textContent = feedback;
    setAssistantState(elements, state, 'processing', 'Preparing a retry');

    if (reason === 'not-allowed' || state.retryCount > 2) {
      setAssistantState(elements, state, 'error', 'Voice input needs attention');
      return;
    }

    speakPrompt(state, feedback, selectVoice(state.selectedLanguage))
      .then(() => {
        if (!state.isOpen) {
          return;
        }

        startListening(config, elements, state);
      })
      .catch(() => {
        startListening(config, elements, state);
      });
  }

  function processTranscript(config, elements, state, transcript) {
    const cleanedTranscript = String(transcript || '').trim();
    if (!cleanedTranscript) {
      handleRecognitionFailure(config, elements, state);
      return;
    }

    if (handleVoiceCommand(config, elements, state, cleanedTranscript)) {
      return;
    }

    const step = config.steps[state.currentStepIndex];
    if (!step) {
      completeFlow(config, elements, state);
      return;
    }

    state.retryCount = 0;
    setAssistantState(elements, state, 'processing', 'Filling your resume');

    const formattedValue = typeof step.formatter === 'function' ? step.formatter(cleanedTranscript, state.answers) : cleanedTranscript;

    state.answers[step.key] = cleanedTranscript;
    state.formattedAnswers[step.key] = formattedValue;

    if (step.fieldId && formattedValue !== null && formattedValue !== undefined) {
      ResumeBuilderPage.fillField(step.fieldId, formattedValue);
    }

    state.transcript.push({
      answer: cleanedTranscript,
      fieldId: step.fieldId || '',
      formattedValue: formattedValue || '',
      key: step.key,
      question: step.question,
      recordedAt: new Date().toISOString(),
    });

    renderTranscript(elements, state.transcript);
    persistSession(config, state);

    state.currentStepIndex += 1;
    renderProgress(elements, state, config);

    window.setTimeout(() => {
      askCurrentStep(config, elements, state, false);
    }, 420);
  }

  function retryCurrentStep(config, elements, state, restartPrompt) {
    stopSpeaking(state);
    stopListening(state);
    state.retryCount = 0;
    askCurrentStep(config, elements, state, Boolean(restartPrompt));
  }

  function repeatCurrentStep(config, elements, state) {
    retryCurrentStep(config, elements, state, true);
  }

  function skipCurrentStep(config, elements, state, feedbackText) {
    const step = config.steps[state.currentStepIndex];
    if (!step) {
      completeFlow(config, elements, state);
      return;
    }

    if (step.fieldId) {
      ResumeBuilderPage.fillField(step.fieldId, '');
    }

    state.answers[step.key] = '';
    state.formattedAnswers[step.key] = '';
    state.transcript.push({
      answer: feedbackText || 'Skipped.',
      fieldId: step.fieldId || '',
      formattedValue: '',
      key: step.key,
      question: step.question,
      recordedAt: new Date().toISOString(),
    });

    renderTranscript(elements, state.transcript);
    state.currentStepIndex += 1;
    renderProgress(elements, state, config);
    persistSession(config, state);
    askCurrentStep(config, elements, state, false);
  }

  function goBack(config, elements, state) {
    stopSpeaking(state);
    stopListening(state);

    if (state.currentStepIndex > 0) {
      state.currentStepIndex -= 1;
    }

    askCurrentStep(config, elements, state, true);
  }

  function handleVoiceCommand(config, elements, state, transcript) {
    const normalized = normalizeForCommand(transcript);

    if (matchesCommand(normalized, ['repeat', 'say again', 'ask again', 'phir se'])) {
      repeatCurrentStep(config, elements, state);
      return true;
    }

    if (matchesCommand(normalized, ['skip', 'next', 'agla', 'chhodo'])) {
      skipCurrentStep(config, elements, state, 'Skipped by voice command.');
      return true;
    }

    if (matchesCommand(normalized, ['back', 'go back', 'previous', 'peeche'])) {
      goBack(config, elements, state);
      return true;
    }

    if (matchesCommand(normalized, ['stop', 'close', 'exit', 'band karo'])) {
      closePanel(elements, state);
      return true;
    }

    if (matchesCommand(normalized, ['start over', 'restart', 'fir se shuru'])) {
      beginFlow(config, elements, state, true);
      return true;
    }

    const tabMatch = normalized.match(/(?:open|go to)\s+(basics|experience|skills|projects|achievements|education)/);
    if (tabMatch) {
      ResumeBuilderPage.switchTabByName(tabMatch[1]);
      repeatCurrentStep(config, elements, state);
      return true;
    }

    return false;
  }

  async function completeFlow(config, elements, state) {
    state.sessionStatus = 'processing';
    setAssistantState(elements, state, 'processing', 'Generating polished suggestions');
    typePrompt(elements, state, 'I have your answers. I am polishing the summary and ATS-friendly skills now.');

    try {
      const response = await ResumeForgeApp.generateVoiceResumeEnhancements({
        answers: state.answers,
        language: state.selectedLanguage,
        resumeType: config.resumeType,
        transcript: state.transcript,
      });

      state.generated = response.suggestions || {};
    } catch (error) {
      state.generated = buildFallbackEnhancements(config.resumeType, state.answers);
    }

    if (state.generated.summary && config.summaryFieldId) {
      ResumeBuilderPage.fillField(config.summaryFieldId, state.generated.summary);
    }

    if (Array.isArray(state.generated.atsSkills) && state.generated.atsSkills.length && config.skillsFieldId) {
      const mergedSkills = mergeListValues(
        ResumeBuilderPage.getFieldValue(config.skillsFieldId),
        state.generated.atsSkills.join(', '),
      );
      ResumeBuilderPage.fillField(config.skillsFieldId, mergedSkills);
    }

    state.sessionStatus = 'completed';
    persistSession(config, state);
    renderProgress(elements, state, config);
    setAssistantState(elements, state, 'completed', 'Voice draft completed');

    const completionMessage =
      config.resumeType === 'technical'
        ? 'Your technical voice draft is ready. Review the form and save the resume when you are happy.'
        : 'Your non-technical voice draft is ready. Review the form and save the resume when you are happy.';

    typePrompt(elements, state, completionMessage);
    speakPrompt(state, completionMessage, selectVoice(state.selectedLanguage)).catch(() => {});
  }

  function renderProgress(elements, state, config) {
    const answeredCount = Math.min(state.currentStepIndex, config.steps.length);
    const total = config.steps.length;
    const percentage = total === 0 ? 0 : Math.min((answeredCount / total) * 100, 100);

    elements.progressText.textContent = `${answeredCount} / ${total}`;
    elements.progressBar.style.width = `${percentage}%`;
  }

  function setAssistantState(elements, state, nextState, label) {
    state.sessionStatus = nextState;
    elements.panel.dataset.state = nextState;
    elements.statusLabel.textContent = label;
  }

  function renderTranscript(elements, transcript) {
    const items = transcript
      .slice()
      .reverse()
      .map(
        (item) => `
          <article class="voice-assistant-transcript-item">
            <span>${escapeHtml(item.question)}</span>
            <p>${escapeHtml(item.answer)}</p>
          </article>
        `,
      )
      .join('');

    elements.transcriptList.innerHTML =
      items || '<p class="voice-assistant-transcript-empty">Your spoken answers will appear here.</p>';
    elements.transcriptCount.textContent = `${transcript.length} ${transcript.length === 1 ? 'answer' : 'answers'}`;
  }

  function typePrompt(elements, state, text) {
    clearTyping(state);

    const content = String(text || '');
    let index = 0;
    elements.promptText.textContent = '';

    state.typingTimer = window.setInterval(() => {
      index += 1;
      elements.promptText.textContent = content.slice(0, index);

      if (index >= content.length) {
        clearTyping(state);
      }
    }, 18);
  }

  function clearTyping(state) {
    if (!state.typingTimer) {
      return;
    }

    window.clearInterval(state.typingTimer);
    state.typingTimer = null;
  }

  function speakPrompt(state, text, voice) {
    if (!window.speechSynthesis) {
      return Promise.resolve();
    }

    stopSpeaking(state);

    const nextToken = state.speakToken + 1;
    state.speakToken = nextToken;

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(String(text || ''));
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.lang = voice ? voice.lang : state.selectedLanguage;

      if (voice) {
        utterance.voice = voice;
      }

      utterance.onend = () => {
        if (state.speakToken === nextToken) {
          resolve();
        }
      };

      utterance.onerror = () => {
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  function stopSpeaking(state) {
    state.speakToken += 1;
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
  }

  function persistSession(config, state) {
    const session = exportSession(state);
    if (typeof config.onSessionChange === 'function') {
      config.onSessionChange(session);
    }
  }

  function exportSession(state) {
    return {
      answers: { ...state.answers },
      currentStepIndex: state.currentStepIndex,
      formattedAnswers: { ...state.formattedAnswers },
      generated: { ...state.generated },
      language: state.selectedLanguage,
      sessionStatus: state.sessionStatus,
      transcript: state.transcript.slice(),
      updatedAt: new Date().toISOString(),
    };
  }

  function importSession(config, elements, state, session) {
    if (!session || typeof session !== 'object') {
      return;
    }

    state.answers = session.answers || {};
    state.currentStepIndex = Number(session.currentStepIndex || 0);
    state.formattedAnswers = session.formattedAnswers || {};
    state.generated = session.generated || {};
    state.selectedLanguage = session.language || state.selectedLanguage;
    state.sessionStatus = session.sessionStatus || 'idle';
    state.transcript = Array.isArray(session.transcript) ? session.transcript : [];

    applyLanguageState(elements, state, config);
    renderTranscript(elements, state.transcript);
    renderProgress(elements, state, config);

    if (state.sessionStatus === 'completed') {
      setAssistantState(elements, state, 'completed', 'Voice draft completed');
      typePrompt(elements, state, 'Previous voice answers were restored. You can review, continue, or restart.');
    }
  }

  function applyLanguageState(elements, state, config) {
    elements.languageButtons.forEach((button) => {
      button.classList.toggle('active', button.dataset.language === state.selectedLanguage);
    });

    const selectedLanguage = config.languageOptions.find((language) => language.code === state.selectedLanguage);
    if (selectedLanguage) {
      elements.supportMessage.textContent = `Listening in ${selectedLanguage.label}. Say skip, repeat, back, or open skills at any time.`;
    }
  }

  function matchesCommand(value, phrases) {
    return phrases.some((phrase) => value === phrase || value.startsWith(`${phrase} `));
  }

  function normalizeForCommand(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[?!.,]/g, '');
  }

  function selectVoice(languageCode) {
    if (!window.speechSynthesis || typeof window.speechSynthesis.getVoices !== 'function') {
      return null;
    }

    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) {
      return null;
    }

    return (
      voices.find((voice) => voice.lang === languageCode) ||
      voices.find((voice) => voice.lang.startsWith(languageCode.split('-')[0])) ||
      voices[0]
    );
  }

  function getPreset(resumeType) {
    if (resumeType === 'non-technical') {
      return {
        description:
          'The assistant asks business-focused questions, listens to each answer, and fills the form automatically while keeping manual editing available.',
        helperText:
          'One question at a time. The assistant speaks, listens, fills the correct field, and saves your transcript for review.',
        skillsFieldId: 'nontechnical-core-skills',
        steps: [
          createStep('fullName', 'nontechnical-full-name', 'basics', 'What is your full name?', formatHeadlineText),
          createStep('designation', 'nontechnical-designation', 'basics', 'What designation should appear on your resume?', formatHeadlineText),
          createStep('email', 'nontechnical-email', 'basics', 'What is your email address?', normalizeEmail),
          createStep('phone', 'nontechnical-phone', 'basics', 'What is your phone number?', normalizePhone),
          createStep('linkedin', 'nontechnical-linkedin', 'basics', 'Share your LinkedIn profile URL.', normalizeUrl),
          createStep('location', 'nontechnical-location', 'basics', 'Which city or location would you like to show?', formatHeadlineText),
          createStep(
            'summarySeed',
            '',
            'basics',
            'Briefly describe your leadership strengths, business impact, and the kind of role you are targeting.',
            normalizeSentence,
          ),
          createStep('experienceCompany', 'nontechnical-experience-company-1', 'experience', 'What is the company name for your latest management experience?', formatHeadlineText),
          createStep('experienceTitle', 'nontechnical-experience-designation-1', 'experience', 'What was your designation in that role?', formatHeadlineText),
          createStep('experienceStart', 'nontechnical-experience-start-1', 'experience', 'When did that role start? You can say a month and year like June 2021.', normalizeMonthValue),
          createStep('experienceEnd', 'nontechnical-experience-end-1', 'experience', 'When did that role end? Say skip if it is your current role.', normalizeMonthValue),
          createStep('kpis', 'nontechnical-experience-kpis-1', 'experience', 'Describe your management responsibilities, leadership experience, and KPI impact.', normalizeBulletText),
          createStep('coreSkills', 'nontechnical-core-skills', 'skills', 'List your core skills, separated naturally. I will format them for ATS.', normalizeCommaList),
          createStep('tools', 'nontechnical-tools', 'skills', 'Which tools or software platforms do you use most?', normalizeCommaList),
          createStep('leadershipSkills', 'nontechnical-leadership-skills', 'skills', 'What leadership or soft skills should be highlighted?', normalizeCommaList),
          createStep('languages', 'nontechnical-languages', 'skills', 'Which languages do you speak?', normalizeCommaList),
          createStep('certifications', 'nontechnical-certifications', 'skills', 'Do you want to add any certifications? Say skip if not.', normalizeCommaList),
          createStep('achievementTitle', 'nontechnical-achievement-title-1', 'achievements', 'What is one achievement or award you want to highlight?', formatHeadlineText),
          createStep('achievementContext', 'nontechnical-achievement-context-1', 'achievements', 'What organization or context is connected to that achievement?', formatHeadlineText),
          createStep('achievementImpact', 'nontechnical-achievement-impact-1', 'achievements', 'Describe the result, impact, or KPI outcome for that achievement.', normalizeBulletText),
          createStep('degree', 'nontechnical-degree', 'education', 'What degree or qualification should I add?', formatHeadlineText),
          createStep('university', 'nontechnical-university', 'education', 'Which university or institute did you attend?', formatHeadlineText),
          createStep('graduationYear', 'nontechnical-graduation-year', 'education', 'What is your graduation year?', normalizeYear),
          createStep('grade', 'nontechnical-grade', 'education', 'What grade, percentage, or distinction should I include?', normalizeSentence),
        ],
        summaryFieldId: 'nontechnical-summary',
        title: 'Business & leadership resume by voice',
        resumeType,
      };
    }

    return {
      description:
        'The assistant asks developer-focused questions, listens to each answer, fills the form, and keeps manual editing available throughout the flow.',
      helperText:
        'One question at a time. The assistant can generate a professional summary, refine ATS-style skills, and keep a transcript of your answers.',
      skillsFieldId: 'technical-skills',
      steps: [
        createStep('fullName', 'technical-full-name', 'basics', 'What is your full name?', formatHeadlineText),
        createStep('jobTitle', 'technical-job-title', 'basics', 'What job title are you targeting?', formatHeadlineText),
        createStep('email', 'technical-email', 'basics', 'What is your email address?', normalizeEmail),
        createStep('phone', 'technical-phone', 'basics', 'What is your phone number?', normalizePhone),
        createStep('linkedin', 'technical-linkedin', 'basics', 'Share your LinkedIn profile URL.', normalizeUrl),
        createStep('github', 'technical-github', 'basics', 'Share your GitHub profile URL.', normalizeUrl),
        createStep('portfolio', 'technical-portfolio', 'basics', 'Do you want to add a portfolio or personal website? Say skip if not.', normalizeUrl),
        createStep(
          'summarySeed',
          '',
          'basics',
          'Briefly describe your technical experience, strongest skills, and the impact you create.',
          normalizeSentence,
        ),
        createStep('experienceCompany', 'technical-experience-company-1', 'experience', 'What is the company name for your latest technical experience?', formatHeadlineText),
        createStep('experienceTitle', 'technical-experience-title-1', 'experience', 'What was your job title in that role?', formatHeadlineText),
        createStep('experienceStart', 'technical-experience-start-1', 'experience', 'When did that role start? You can say a month and year like June 2022.', normalizeMonthValue),
        createStep('experienceEnd', 'technical-experience-end-1', 'experience', 'When did that role end? Say skip if it is your current role.', normalizeMonthValue),
        createStep('experienceHighlights', 'technical-experience-highlights-1', 'experience', 'Describe your main experience, achievements, and technologies used in that role.', normalizeBulletText),
        createStep('skills', 'technical-skills', 'skills', 'List your technical skills. I will format them for ATS.', normalizeCommaList),
        createStep('tools', 'technical-tools', 'skills', 'Which tools or platforms do you use regularly?', normalizeCommaList),
        createStep('softSkills', 'technical-soft-skills', 'skills', 'Which soft skills should be highlighted?', normalizeCommaList),
        createStep('certifications', 'technical-certifications', 'skills', 'Do you want to add any certifications? Say skip if not.', normalizeCommaList),
        createStep('projectName', 'technical-project-name-1', 'projects', 'What is the name of one featured project you want to include?', formatHeadlineText),
        createStep('projectStack', 'technical-project-stack-1', 'projects', 'Which tech stack was used in that project?', normalizeCommaList),
        createStep('projectGithub', 'technical-project-github-1', 'projects', 'Share the GitHub link for that project. Say skip if not available.', normalizeUrl),
        createStep('projectDemo', 'technical-project-demo-1', 'projects', 'Share the live demo link if you have one. Say skip if not available.', normalizeUrl),
        createStep('projectDescription', 'technical-project-description-1', 'projects', 'Describe what the project does and the impact it had.', normalizeBulletText),
        createStep('degree', 'technical-degree', 'education', 'What degree should I add?', formatHeadlineText),
        createStep('university', 'technical-university', 'education', 'Which college or university did you attend?', formatHeadlineText),
        createStep('graduationYear', 'technical-graduation-year', 'education', 'What is your graduation year?', normalizeYear),
        createStep('grade', 'technical-grade', 'education', 'What grade, percentage, or CGPA should I include?', normalizeSentence),
      ],
      summaryFieldId: 'technical-summary',
      title: 'Technical resume by voice',
      resumeType,
    };
  }

  function createStep(key, fieldId, tab, question, formatter) {
    return { fieldId, formatter, key, question, tab };
  }

  function buildFallbackEnhancements(resumeType, answers) {
    const role = answers.jobTitle || answers.designation || 'professional';
    const summarySeed = answers.summarySeed || '';
    const skillSeed = answers.skills || answers.coreSkills || '';
    const experienceSeed = answers.experienceHighlights || answers.kpis || '';

    const summary =
      resumeType === 'non-technical'
        ? `${formatHeadlineText(role)} with a track record of leadership, execution, and measurable business results. ${normalizeSentence(
            summarySeed || experienceSeed || 'Known for driving teams, stakeholder alignment, and operational impact.',
          )}`
        : `${formatHeadlineText(role)} with hands-on experience delivering reliable software and measurable product impact. ${normalizeSentence(
            summarySeed || experienceSeed || 'Known for building scalable solutions, collaborating across teams, and solving complex technical problems.',
          )}`;

    return {
      atsSkills: normalizeCommaList(skillSeed).split(', ').filter(Boolean),
      summary,
    };
  }

  function mergeListValues(currentValue, incomingValue) {
    return Array.from(
      new Set(
        `${currentValue || ''}, ${incomingValue || ''}`
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    ).join(', ');
  }

  function formatHeadlineText(value) {
    return String(value || '')
      .trim()
      .split(/\s+/)
      .map((word) => {
        const normalizedWord = word.toLowerCase();
        if (KNOWN_CASE_MAP[normalizedWord]) {
          return KNOWN_CASE_MAP[normalizedWord];
        }

        if (/[A-Z]/.test(word.slice(1))) {
          return word;
        }

        return normalizedWord.charAt(0).toUpperCase() + normalizedWord.slice(1);
      })
      .join(' ');
  }

  function normalizeSentence(value) {
    const cleaned = String(value || '').trim().replace(/\s+/g, ' ');
    if (!cleaned) {
      return '';
    }

    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  function normalizeEmail(value) {
    return String(value || '')
      .toLowerCase()
      .trim()
      .replace(/\bat the rate\b/g, '@')
      .replace(/\battherate\b/g, '@')
      .replace(/\bat\b/g, '@')
      .replace(/\bdot\b/g, '.')
      .replace(/\bunderscore\b/g, '_')
      .replace(/\bdash\b/g, '-')
      .replace(/\s+/g, '');
  }

  function normalizePhone(value) {
    return String(value || '')
      .trim()
      .replace(/[^\d+\s-]/g, '')
      .replace(/\s{2,}/g, ' ');
  }

  function normalizeUrl(value) {
    const spokenValue = String(value || '')
      .toLowerCase()
      .trim()
      .replace(/\bdot\b/g, '.')
      .replace(/\bslash\b/g, '/')
      .replace(/\bunderscore\b/g, '_')
      .replace(/\bdash\b/g, '-')
      .replace(/\s+/g, '');

    if (!spokenValue) {
      return '';
    }

    if (spokenValue.startsWith('http://') || spokenValue.startsWith('https://')) {
      return spokenValue;
    }

    return `https://${spokenValue}`;
  }

  function normalizeCommaList(value) {
    return Array.from(
      new Set(
        String(value || '')
          .replace(/\band\b/gi, ',')
          .split(/[,\n/;]+/)
          .map((item) => item.trim())
          .filter(Boolean)
          .map(formatListItem),
      ),
    ).join(', ');
  }

  function normalizeBulletText(value) {
    const segments = String(value || '')
      .split(/\.(?:\s|$)|\n|;+/)
      .map((segment) => segment.trim())
      .filter(Boolean);

    if (!segments.length) {
      return '';
    }

    return segments.map((segment) => `- ${normalizeSentence(segment)}`).join('\n');
  }

  function normalizeYear(value) {
    const match = String(value || '').match(/(19|20)\d{2}/);
    return match ? match[0] : String(value || '').trim();
  }

  function normalizeMonthValue(value) {
    const text = String(value || '').trim().toLowerCase();
    if (!text || /(current|present|ongoing)/.test(text)) {
      return '';
    }

    const yearMatch = text.match(/(19|20)\d{2}/);
    if (!yearMatch) {
      return '';
    }

    const monthValue = resolveMonthNumber(text);
    if (!monthValue) {
      return '';
    }

    return `${yearMatch[0]}-${monthValue}`;
  }

  function resolveMonthNumber(text) {
    const months = {
      april: '04',
      aug: '08',
      august: '08',
      dec: '12',
      december: '12',
      feb: '02',
      february: '02',
      jan: '01',
      january: '01',
      jul: '07',
      july: '07',
      jun: '06',
      june: '06',
      march: '03',
      mar: '03',
      may: '05',
      nov: '11',
      november: '11',
      oct: '10',
      october: '10',
      sept: '09',
      september: '09',
    };

    const matchedMonth = Object.keys(months).find((month) => text.includes(month));
    if (matchedMonth) {
      return months[matchedMonth];
    }

    const numericMatch = text.match(/\b(0?[1-9]|1[0-2])\b/);
    if (numericMatch) {
      return numericMatch[0].padStart(2, '0');
    }

    return '';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatListItem(value) {
    const words = String(value || '').trim().split(/\s+/).filter(Boolean);
    return words
      .map((word) => {
        const normalizedWord = word.toLowerCase();
        if (KNOWN_CASE_MAP[normalizedWord]) {
          return KNOWN_CASE_MAP[normalizedWord];
        }

        if (/[A-Z]/.test(word.slice(1))) {
          return word;
        }

        if (/^[a-z]{1,4}$/.test(normalizedWord)) {
          return normalizedWord.toUpperCase();
        }

        return normalizedWord.charAt(0).toUpperCase() + normalizedWord.slice(1);
      })
      .join(' ');
  }

  const KNOWN_CASE_MAP = {
    agile: 'Agile',
    aws: 'AWS',
    azure: 'Azure',
    ci: 'CI',
    'ci/cd': 'CI/CD',
    crm: 'CRM',
    css: 'CSS',
    html: 'HTML',
    github: 'GitHub',
    git: 'Git',
    hubspot: 'HubSpot',
    java: 'Java',
    javascript: 'JavaScript',
    jira: 'Jira',
    kpi: 'KPI',
    kpis: 'KPIs',
    linkedin: 'LinkedIn',
    mongodb: 'MongoDB',
    mysql: 'MySQL',
    'next.js': 'Next.js',
    node: 'Node',
    'node.js': 'Node.js',
    php: 'PHP',
    postgresql: 'PostgreSQL',
    python: 'Python',
    react: 'React',
    rest: 'REST',
    sap: 'SAP',
    seo: 'SEO',
    sql: 'SQL',
    tableau: 'Tableau',
    typescript: 'TypeScript',
    ui: 'UI',
    ux: 'UX',
  };

  return {
    create,
  };
})();

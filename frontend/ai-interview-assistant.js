const ResumeVoiceAssistant = (() => {
  const Recognition =
    window.ResumeForgeMicSupport && typeof ResumeForgeMicSupport.getSpeechRecognition === 'function'
      ? ResumeForgeMicSupport.getSpeechRecognition()
      : window.SpeechRecognition || window.webkitSpeechRecognition || null;

  function create(userConfig) {
    const preset = getPreset(userConfig.resumeType || 'technical');
    const config = {
      launchLabel: 'Build Resume with AI',
      mountSelector: '#voiceAssistantMount',
      onSessionChange: null,
      ...preset,
      ...userConfig,
    };
    const mount = document.querySelector(config.mountSelector);
    if (!mount) {
      throw new Error(`AI interview mount point "${config.mountSelector}" was not found.`);
    }

    mount.innerHTML = buildMarkup(config);
    const modal = mount.querySelector('.voice-assistant-modal');
    document.body.appendChild(modal);

    const elements = getElements(mount, modal);
    const state = {
      answers: {},
      currentStepIndex: 0,
      formattedAnswers: {},
      generated: {},
      isOpen: false,
      inputMode: Recognition ? 'voice' : 'text',
      lastAiQuestionKey: '',
      lastQuestionKey: '',
      micBlocked: false,
      micStatus: 'Idle',
      recognition: null,
      sessionStatus: 'idle',
      speakToken: 0,
      transcript: [],
      typingTimer: null,
    };

    bindEvents(config, elements, state);
    renderAll(config, elements, state);
    addAiMessage(elements, config.welcomeMessage, true);

    if (!Recognition) {
      switchToTextMode(config, elements, state, 'Voice input is not available in this browser. You can continue by typing.');
    }

    return {
      close: () => closePanel(elements, state),
      exportSession: () => exportSession(config, state),
      importSession: (session) => importSession(config, elements, state, session),
      open: () => openPanel(elements, state),
      start: () => {
        openPanel(elements, state);
        beginFlow(config, elements, state, false);
      },
    };
  }

  function buildMarkup(config) {
    return `
      <section class="assistant-launch-card glass-card assistant-theme-${escapeHtml(config.resumeType)}">
        <div class="assistant-launch-copy">
          <span class="assistant-kicker">Guided AI interview</span>
          <h2>Build Resume with AI</h2>
          <p>${escapeHtml(config.description)}</p>
          <div class="assistant-mode-row">
            <div class="assistant-mode-pill"><strong>Voice</strong><span>Speak naturally</span></div>
            <div class="assistant-mode-pill assistant-mode-pill-voice"><strong>Text</strong><span>Type anytime</span></div>
          </div>
        </div>
        <button class="btn-primary assistant-launch-button" type="button">${escapeHtml(config.launchLabel)}</button>
      </section>

      <div class="voice-assistant-modal ai-interview-modal" role="dialog" aria-modal="true" aria-label="AI resume interview" hidden>
        <div class="voice-assistant-backdrop"></div>
        <section class="voice-assistant-panel ai-interview-panel glass-card assistant-theme-${escapeHtml(config.resumeType)}">
          <button class="voice-assistant-close" type="button" aria-label="Close AI interview">x</button>
          <div class="ai-toast" role="status" aria-live="polite"></div>

          <header class="ai-interview-header">
            <div class="voice-assistant-orb-shell">
              <div class="voice-assistant-orb"></div>
              <div class="voice-assistant-mic">
                <span class="voice-assistant-mic-ring"></span>
                <span class="voice-assistant-mic-ring voice-assistant-mic-ring-delay"></span>
                <span class="voice-assistant-mic-core"></span>
              </div>
              <div class="voice-assistant-waveform" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
            </div>
            <div class="ai-interview-title">
              <span class="assistant-kicker">ResumeForge AI</span>
              <h3>${escapeHtml(config.title)}</h3>
              <p>${escapeHtml(config.helperText)}</p>
            </div>
            <button class="ai-theme-toggle btn-secondary" type="button">Theme</button>
          </header>

          <div class="voice-assistant-meta ai-interview-meta">
            <div class="voice-assistant-status-chip">
              <span class="voice-assistant-status-dot"></span>
              <span class="voice-assistant-status-label">Idle</span>
            </div>
            <div class="voice-assistant-progress">
              <span class="voice-assistant-progress-text">Question 1 of ${config.steps.length}</span>
              <div class="voice-assistant-progress-track"><span class="voice-assistant-progress-bar"></span></div>
            </div>
          </div>

          <main class="ai-interview-main">
            <section class="ai-chat-shell">
              <div class="ai-chat-list" aria-live="polite"></div>
              <div class="voice-assistant-prompt-card ai-current-question">
                <span class="voice-assistant-label ai-current-label">Current question</span>
                <p class="voice-assistant-typing-text"></p>
              </div>
            </section>

            <aside class="ai-preview-shell">
              <div class="voice-assistant-transcript">
                <div class="voice-assistant-transcript-header">
                  <span class="assistant-kicker">Saved transcript</span>
                  <span class="voice-assistant-transcript-count">0 answers</span>
                </div>
                <div class="voice-assistant-transcript-list"></div>
              </div>
              <div class="ai-preview-card">
                <div class="voice-assistant-transcript-header">
                  <span class="assistant-kicker">ATS preview</span>
                  <span class="ai-preview-state">Draft</span>
                </div>
                <div class="ai-resume-preview"><div class="ai-skeleton"></div><div class="ai-skeleton short"></div><div class="ai-skeleton"></div></div>
              </div>
            </aside>
          </main>

          <footer class="voice-assistant-actions ai-control-bar">
            <div class="ai-manual-input">
              <textarea class="ai-answer-input" rows="2" placeholder="Type your answer, or use the microphone..."></textarea>
              <button class="btn-primary assistant-action-send" type="button">Send</button>
            </div>
            <div class="ai-action-row">
              <button class="btn-secondary assistant-action-mic" type="button">Start mic</button>
              <button class="btn-secondary assistant-action-repeat" type="button">Repeat</button>
              <button class="btn-secondary assistant-action-retry" type="button">Retry</button>
              <button class="btn-secondary assistant-action-skip" type="button">Skip</button>
              <button class="btn-secondary assistant-action-edit" type="button">Edit form</button>
              <button class="btn-secondary assistant-action-pdf" type="button">Download PDF</button>
              <button class="btn-primary assistant-action-save" type="button">Save Resume</button>
            </div>
          </footer>
        </section>
      </div>
    `;
  }

  function getElements(mount, modal) {
    return {
      answerInput: modal.querySelector('.ai-answer-input'),
      chatList: modal.querySelector('.ai-chat-list'),
      closeButton: modal.querySelector('.voice-assistant-close'),
      editButton: modal.querySelector('.assistant-action-edit'),
      launchButton: mount.querySelector('.assistant-launch-button'),
      micButton: modal.querySelector('.assistant-action-mic'),
      modal,
      panel: modal.querySelector('.voice-assistant-panel'),
      pdfButton: modal.querySelector('.assistant-action-pdf'),
      preview: modal.querySelector('.ai-resume-preview'),
      previewState: modal.querySelector('.ai-preview-state'),
      progressBar: modal.querySelector('.voice-assistant-progress-bar'),
      progressText: modal.querySelector('.voice-assistant-progress-text'),
      promptLabel: modal.querySelector('.ai-current-label'),
      promptText: modal.querySelector('.voice-assistant-typing-text'),
      repeatButton: modal.querySelector('.assistant-action-repeat'),
      retryButton: modal.querySelector('.assistant-action-retry'),
      saveButton: modal.querySelector('.assistant-action-save'),
      sendButton: modal.querySelector('.assistant-action-send'),
      skipButton: modal.querySelector('.assistant-action-skip'),
      statusLabel: modal.querySelector('.voice-assistant-status-label'),
      themeButton: modal.querySelector('.ai-theme-toggle'),
      toast: modal.querySelector('.ai-toast'),
      transcriptCount: modal.querySelector('.voice-assistant-transcript-count'),
      transcriptList: modal.querySelector('.voice-assistant-transcript-list'),
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
    elements.closeButton.addEventListener('click', () => closePanel(elements, state));
    elements.modal.querySelector('.voice-assistant-backdrop').addEventListener('click', () => closePanel(elements, state));
    elements.sendButton.addEventListener('click', () => submitTypedAnswer(config, elements, state));
    elements.answerInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        submitTypedAnswer(config, elements, state);
      }
    });
    elements.micButton.addEventListener('click', () => startListening(config, elements, state));
    elements.repeatButton.addEventListener('click', () => askCurrentStep(config, elements, state, true));
    elements.retryButton.addEventListener('click', () => retryCurrentStep(config, elements, state));
    elements.skipButton.addEventListener('click', () => skipCurrentStep(config, elements, state));
    elements.editButton.addEventListener('click', () => closePanel(elements, state));
    elements.pdfButton.addEventListener('click', () => downloadPreviewPdf(config, state));
    elements.saveButton.addEventListener('click', () => saveResumeFromInterview(elements));
    elements.themeButton.addEventListener('click', toggleTheme);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.isOpen) closePanel(elements, state);
    });
  }

  function openPanel(elements, state) {
    elements.modal.hidden = false;
    state.isOpen = true;
    document.body.classList.add('voice-assistant-lock');
    requestAnimationFrame(() => {
      elements.modal.classList.add('is-open');
      elements.answerInput.focus();
    });
  }

  function closePanel(elements, state) {
    stopSpeaking(state);
    stopListening(state);
    clearTyping(state);
    state.isOpen = false;
    elements.modal.classList.remove('is-open');
    document.body.classList.remove('voice-assistant-lock');
    window.setTimeout(() => {
      if (!state.isOpen) elements.modal.hidden = true;
    }, 180);
  }

  function beginFlow(config, elements, state, restart) {
    if (restart || state.sessionStatus === 'completed') {
      resetSession(config, elements, state);
    }
    if (state.currentStepIndex >= config.steps.length) state.currentStepIndex = 0;
    if (state.transcript.length && !restart) {
      showToast(elements, 'Restored your unfinished interview. Continuing from the next question.');
    }
    askCurrentStep(config, elements, state, false);
  }

  async function prepareVoiceInput(config, elements, state) {
    if (window.ResumeForgeMicSupport && typeof ResumeForgeMicSupport.requestMicrophone === 'function') {
      const status = await ResumeForgeMicSupport.requestMicrophone();
      if (!status.canUseVoice) {
        state.micBlocked = status.reason !== 'speech-recognition-missing';
        switchToTextMode(config, elements, state, `${status.message} Text mode is ready.`);
        return false;
      }

      state.micBlocked = false;
      state.inputMode = 'voice';
      elements.micButton.disabled = false;
      elements.micButton.textContent = 'Start mic';
      return true;
    }

    if (!Recognition) {
      switchToTextMode(config, elements, state, 'Voice input is not available in this browser. Text mode is ready.');
      return false;
    }

    return true;
  }

  function resetSession(config, elements, state) {
    stopSpeaking(state);
    stopListening(state);
    state.answers = {};
    state.currentStepIndex = 0;
    state.formattedAnswers = {};
    state.generated = {};
    state.lastAiQuestionKey = '';
    state.lastQuestionKey = '';
    state.sessionStatus = 'idle';
    state.transcript = [];
    elements.chatList.innerHTML = '';
    addAiMessage(elements, config.welcomeMessage, true);
    renderAll(config, elements, state);
    persistSession(config, state);
  }

  function askCurrentStep(config, elements, state, repeated) {
    const step = config.steps[state.currentStepIndex];
    if (!step) {
      completeFlow(config, elements, state);
      return;
    }
    stopListening(state);
    focusFormField(step);
    state.lastQuestionKey = step.key;
    const prompt = repeated ? `Let's try that one again. ${step.question}` : step.question;
    state.sessionStatus = 'active';
    setMicState(elements, state, 'Idle');
    renderProgress(config, elements, state);
    typePrompt(elements, state, prompt);
    const messageKey = `${step.key}:${repeated ? 'repeat' : 'ask'}`;
    if (repeated || state.lastAiQuestionKey !== messageKey) {
      addAiMessage(elements, prompt);
      state.lastAiQuestionKey = messageKey;
    }
    persistSession(config, state);

    speakPrompt(state, prompt).then(() => {
      if (state.isOpen && state.inputMode === 'voice') startListening(config, elements, state);
    });
  }

  function focusFormField(step) {
    if (step.tab) ResumeBuilderPage.switchTabByName(step.tab);
    if (step.containerId) ResumeBuilderPage.ensureRepeaterCount(step.containerId, step.requiredEntries || 1, step.entryClassName);
    if (step.fieldId) ResumeBuilderPage.highlightField(step.fieldId);
  }

  function startListening(config, elements, state) {
    if (!state.isOpen) return;
    if (!Recognition) {
      switchToTextMode(config, elements, state, 'Voice input is not available here. Text mode is ready.');
      return;
    }
    if (state.micBlocked) {
      switchToTextMode(config, elements, state, 'Microphone is blocked for this site. Text mode is ready.');
      return;
    }

    stopListening(state);
    const recognition = new Recognition();
    state.recognition = recognition;
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalTranscript = '';
    let hadRecognitionError = false;
    recognition.onstart = () => {
      state.inputMode = 'voice';
      elements.micButton.textContent = 'Listening...';
      setAssistantState(elements, 'listening');
      setMicState(elements, state, 'Listening...');
    };
    recognition.onresult = (event) => {
      let interim = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const text = String(event.results[index][0].transcript || '').trim();
        if (event.results[index].isFinal) finalTranscript += `${text} `;
        else interim += `${text} `;
      }
      elements.answerInput.value = (finalTranscript || interim).trim();
    };
    recognition.onerror = (event) => {
      hadRecognitionError = true;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        state.micBlocked = true;
        switchToTextMode(config, elements, state, 'Microphone permission was blocked. I switched you to text mode.');
      } else {
        showToast(elements, "I couldn't hear that clearly. You can retry or type the answer.");
        setAssistantState(elements, 'idle');
        setMicState(elements, state, 'Idle');
      }
    };
    recognition.onend = () => {
      state.recognition = null;
      elements.micButton.textContent = 'Start mic';
      if (hadRecognitionError || state.inputMode !== 'voice') return;
      const text = finalTranscript.trim() || elements.answerInput.value.trim();
      if (text) {
        processAnswer(config, elements, state, text);
      } else {
        setAssistantState(elements, 'idle');
        setMicState(elements, state, 'Idle');
      }
    };

    try {
      recognition.start();
    } catch (error) {
      switchToTextMode(config, elements, state, 'Microphone could not start. Text mode is ready.');
    }
  }



  function stopListening(state) {
    if (!state.recognition) return;
    try {
      state.recognition.onend = null;
      state.recognition.stop();
    } catch (error) {
      state.recognition.abort && state.recognition.abort();
    }
    state.recognition = null;
  }

  function switchToTextMode(config, elements, state, message) {
    stopListening(state);
    state.inputMode = 'text';
    elements.micButton.textContent = state.micBlocked ? 'Mic blocked' : 'Use text mode';
    elements.micButton.disabled = state.micBlocked || !Recognition;
    setAssistantState(elements, 'idle');
    setMicState(elements, state, 'Idle');
    showToast(elements, message);
    elements.answerInput.focus();
    persistSession(config, state);
  }

  function submitTypedAnswer(config, elements, state) {
    processAnswer(config, elements, state, elements.answerInput.value);
  }

  function processAnswer(config, elements, state, rawAnswer) {
    const answer = String(rawAnswer || '').trim();
    if (!answer) {
      showToast(elements, 'Add an answer or skip this question.');
      elements.answerInput.focus();
      return;
    }
    if (handleCommand(config, elements, state, answer)) return;
    const step = config.steps[state.currentStepIndex];
    if (!step) {
      completeFlow(config, elements, state);
      return;
    }
    setAssistantState(elements, 'processing');
    setMicState(elements, state, 'Processing...');
    const formattedValue = typeof step.formatter === 'function' ? step.formatter(answer, state.answers) : answer;
    state.answers[step.key] = answer;
    state.formattedAnswers[step.key] = formattedValue;
    if (step.fieldId && formattedValue !== undefined && formattedValue !== null) {
      ResumeBuilderPage.fillField(step.fieldId, formattedValue);
    }

    state.transcript = state.transcript.filter((item) => item.key !== step.key);
    state.transcript.push({
      answer,
      fieldId: step.fieldId || '',
      formattedValue: formattedValue || '',
      key: step.key,
      question: step.question,
      recordedAt: new Date().toISOString(),
    });
    addUserMessage(elements, answer);
    elements.answerInput.value = '';
    state.currentStepIndex += 1;
    state.lastAiQuestionKey = '';
    renderAll(config, elements, state);
    persistSession(config, state);
    window.setTimeout(() => askCurrentStep(config, elements, state, false), 450);
  }

  function handleCommand(config, elements, state, value) {
    const normalized = normalizeForCommand(value);
    if (matchesCommand(normalized, ['repeat', 'say again', 'ask again'])) {
      askCurrentStep(config, elements, state, true);
      return true;
    }
    if (matchesCommand(normalized, ['skip', 'next'])) {
      skipCurrentStep(config, elements, state);
      return true;
    }
    if (matchesCommand(normalized, ['back', 'previous', 'go back'])) {
      goBack(config, elements, state);
      return true;
    }
    if (matchesCommand(normalized, ['restart', 'start over'])) {
      resetSession(config, elements, state);
      askCurrentStep(config, elements, state, false);
      return true;
    }
    return false;
  }

  function retryCurrentStep(config, elements, state) {
    const step = config.steps[state.currentStepIndex];
    if (step) {
      delete state.answers[step.key];
      delete state.formattedAnswers[step.key];
      state.transcript = state.transcript.filter((item) => item.key !== step.key);
      if (step.fieldId) ResumeBuilderPage.fillField(step.fieldId, '');
    }
    renderAll(config, elements, state);
    persistSession(config, state);
    askCurrentStep(config, elements, state, true);
  }

  function skipCurrentStep(config, elements, state) {
    const step = config.steps[state.currentStepIndex];
    if (!step) {
      completeFlow(config, elements, state);
      return;
    }
    state.answers[step.key] = '';
    state.formattedAnswers[step.key] = '';
    state.transcript = state.transcript.filter((item) => item.key !== step.key);
    state.transcript.push({
      answer: 'Skipped',
      fieldId: step.fieldId || '',
      formattedValue: '',
      key: step.key,
      question: step.question,
      recordedAt: new Date().toISOString(),
    });
    addUserMessage(elements, 'Skipped');
    state.currentStepIndex += 1;
    state.lastAiQuestionKey = '';
    renderAll(config, elements, state);
    persistSession(config, state);
    askCurrentStep(config, elements, state, false);
  }

  function goBack(config, elements, state) {
    if (state.currentStepIndex > 0) state.currentStepIndex -= 1;
    renderAll(config, elements, state);
    askCurrentStep(config, elements, state, true);
  }

  async function completeFlow(config, elements, state) {
    stopListening(state);
    state.sessionStatus = 'generating';
    setAssistantState(elements, 'processing');
    setMicState(elements, state, 'Processing...');
    typePrompt(elements, state, 'I have your answers. Building an ATS-friendly resume preview now.');
    addAiMessage(elements, 'I have your answers. Building an ATS-friendly resume preview now.');

    try {
      const response = await ResumeForgeApp.generateVoiceResumeEnhancements({
        answers: state.answers,
        language: 'en-IN',
        resumeType: config.resumeType,
        transcript: state.transcript,
      });
      state.generated = response.suggestions || {};
    } catch (error) {
      state.generated = buildFallbackEnhancements(config.resumeType, state.answers);
    }

    applyGeneratedFields(config, state);
    state.currentStepIndex = config.steps.length;
    state.sessionStatus = 'completed';
    setAssistantState(elements, 'completed');
    setMicState(elements, state, 'Idle');
    renderAll(config, elements, state);
    persistSession(config, state);
    const done = 'Your ATS resume preview is ready. You can edit the form, download a PDF, or save the resume.';
    typePrompt(elements, state, done);
    addAiMessage(elements, done);
    speakPrompt(state, done);
  }

  function applyGeneratedFields(config, state) {
    if (state.generated.summary && config.summaryFieldId) {
      ResumeBuilderPage.fillField(config.summaryFieldId, state.generated.summary);
    }
    if (Array.isArray(state.generated.atsSkills) && state.generated.atsSkills.length && config.skillsFieldId) {
      ResumeBuilderPage.fillField(
        config.skillsFieldId,
        mergeListValues(ResumeBuilderPage.getFieldValue(config.skillsFieldId), state.generated.atsSkills.join(', ')),
      );
    }
  }

  function renderAll(config, elements, state) {
    renderProgress(config, elements, state);
    renderTranscript(elements, state.transcript);
    renderPreview(config, elements, state);
  }

  function renderProgress(config, elements, state) {
    const total = config.steps.length;
    const current = Math.min(state.currentStepIndex + 1, total);
    const answered = Math.min(state.currentStepIndex, total);
    elements.progressText.textContent =
      state.sessionStatus === 'completed' ? `Question ${total} of ${total}` : `Question ${current} of ${total}`;
    elements.progressBar.style.width = `${total ? (answered / total) * 100 : 0}%`;
    if (elements.promptLabel) {
      elements.promptLabel.textContent =
        state.sessionStatus === 'completed' ? 'Interview complete' : `Question ${current} of ${total}`;
    }
  }

  function renderTranscript(elements, transcript) {
    const items = transcript
      .map(
        (item, index) => `
          <article class="voice-assistant-transcript-item">
            <span>Q${index + 1}. ${escapeHtml(item.question)}</span>
            <p>${escapeHtml(item.answer)}</p>
          </article>
        `,
      )
      .join('');
    elements.transcriptList.innerHTML = items || '<p class="voice-assistant-transcript-empty">Your answers will appear here.</p>';
    elements.transcriptCount.textContent = `${transcript.length} ${transcript.length === 1 ? 'answer' : 'answers'}`;
    elements.transcriptList.scrollTop = elements.transcriptList.scrollHeight;
  }

  function renderPreview(config, elements, state) {
    const resume = buildResumeJson(config, state);
    elements.previewState.textContent = state.sessionStatus === 'completed' ? 'Generated' : 'Live draft';
    elements.preview.innerHTML = `
      <article class="ai-resume-paper">
        <h4>${escapeHtml(resume.basics.name || 'Your Name')}</h4>
        <p class="ai-role">${escapeHtml(resume.basics.role || 'Target Role')}</p>
        <p>${escapeHtml(resume.summary || 'Your professional summary will appear here after the interview.')}</p>
        <h5>Skills</h5>
        <p>${escapeHtml(resume.skills.join(', ') || 'Skills will appear here.')}</p>
        <h5>Experience</h5>
        <p>${escapeHtml(resume.experience || 'Experience details will appear here.')}</p>
        <h5>Projects</h5>
        <p>${escapeHtml(resume.projects || 'Projects will appear here.')}</p>
        <h5>Certifications & Achievements</h5>
        <p>${escapeHtml([resume.extras.certifications, resume.achievements].filter(Boolean).join('\n') || 'Certifications and achievements will appear here.')}</p>
        <h5>Education</h5>
        <p>${escapeHtml(resume.education || 'Education will appear here.')}</p>
        <h5>Languages & Interests</h5>
        <p>${escapeHtml([resume.extras.languages, resume.extras.interests].filter(Boolean).join('\n') || 'Languages and interests will appear here.')}</p>
      </article>
    `;
  }

  function buildResumeJson(config, state) {
    const a = state.formattedAnswers;
    const raw = state.answers;
    const skills = Array.from(
      new Set(
        [
          ...(state.generated.atsSkills || []),
          ...(a.skills || a.coreSkills || '').split(','),
          ...(a.tools || '').split(','),
          ...(a.softSkills || a.leadershipSkills || '').split(','),
        ]
          .map((item) => item.trim())
          .filter(Boolean),
      ),
    );
    return {
      ats: true,
      basics: {
        name: a.fullName || '',
        role: a.jobTitle || a.designation || raw.role || '',
        links: [a.linkedin, a.github, a.portfolio].filter(Boolean),
      },
      summary: state.generated.summary || a.summarySeed || '',
      skills,
      experience: a.experienceHighlights || a.kpis || '',
      projects: a.projects || [a.projectName, a.projectStack, a.projectDescription].filter(Boolean).join(' - '),
      achievements: [a.achievementTitle, a.achievementImpact].filter(Boolean).join(' - '),
      education: a.education || [a.degree, a.university, a.graduationYear, a.grade].filter(Boolean).join(', '),
      extras: {
        certifications: a.certifications || '',
        interests: raw.interests || '',
        languages: a.languages || raw.languages || '',
      },
      resumeType: config.resumeType,
    };
  }

  function addAiMessage(elements, text, skipTyping) {
    addMessage(elements, 'ai', text, skipTyping);
  }

  function addUserMessage(elements, text) {
    addMessage(elements, 'user', text, true);
  }

  function addMessage(elements, type, text, skipTyping) {
    const item = document.createElement('div');
    item.className = `ai-chat-message ${type === 'user' ? 'is-user' : 'is-ai'}`;
    item.textContent = skipTyping ? text : '';
    elements.chatList.appendChild(item);
    scrollChatToLatest(elements);
    if (!skipTyping) {
      let index = 0;
      const timer = window.setInterval(() => {
        index += 2;
        item.textContent = text.slice(0, index);
        scrollChatToLatest(elements);
        if (index >= text.length) window.clearInterval(timer);
      }, 12);
    }
  }

  function scrollChatToLatest(elements) {
    requestAnimationFrame(() => {
      elements.chatList.scrollTop = elements.chatList.scrollHeight;
    });
  }

  function typePrompt(elements, state, text) {
    clearTyping(state);
    let index = 0;
    elements.promptText.textContent = '';
    state.typingTimer = window.setInterval(() => {
      index += 1;
      elements.promptText.textContent = String(text).slice(0, index);
      if (index >= String(text).length) clearTyping(state);
    }, 14);
  }

  function clearTyping(state) {
    if (state.typingTimer) window.clearInterval(state.typingTimer);
    state.typingTimer = null;
  }

  function setAssistantState(elements, nextState) {
    elements.panel.dataset.state = nextState;
  }

  function setMicState(elements, state, label) {
    state.micStatus = label;
    elements.statusLabel.textContent = label;
  }

  function speakPrompt(state, text) {
    if (!window.speechSynthesis || state.inputMode !== 'voice') return Promise.resolve();
    stopSpeaking(state);
    const token = state.speakToken + 1;
    state.speakToken = token;
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(String(text || ''));
      utterance.lang = 'en-IN';
      utterance.rate = 1;
      utterance.onend = () => token === state.speakToken && resolve();
      utterance.onerror = resolve;
      window.speechSynthesis.speak(utterance);
    });
  }

  function stopSpeaking(state) {
    state.speakToken += 1;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  }

  function showToast(elements, message) {
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    window.clearTimeout(elements.toastTimer);
    elements.toastTimer = window.setTimeout(() => elements.toast.classList.remove('show'), 3600);
  }

  function persistSession(config, state) {
    if (typeof config.onSessionChange === 'function') config.onSessionChange(exportSession(config, state));
  }

  function exportSession(config, state) {
    return {
      answers: { ...state.answers },
      currentStepIndex: state.currentStepIndex,
      formattedAnswers: { ...state.formattedAnswers },
      generated: { ...state.generated },
      inputMode: state.inputMode,
      micBlocked: state.micBlocked,
      resumeJson: buildResumeJson(config, state),
      sessionStatus: state.sessionStatus,
      transcript: state.transcript.slice(),
      updatedAt: new Date().toISOString(),
    };
  }

  function importSession(config, elements, state, session) {
    if (!session || typeof session !== 'object') return;
    state.answers = session.answers || {};
    state.currentStepIndex = Math.min(Number(session.currentStepIndex || 0), config.steps.length);
    state.formattedAnswers = session.formattedAnswers || {};
    state.generated = session.generated || {};
    state.inputMode = session.inputMode || state.inputMode;
    state.micBlocked = Boolean(session.micBlocked);
    state.sessionStatus = session.sessionStatus || 'idle';
    state.transcript = Array.isArray(session.transcript) ? session.transcript : [];
    if (state.micBlocked) {
      elements.micButton.textContent = 'Mic blocked';
      elements.micButton.disabled = true;
    }
    elements.chatList.innerHTML = '';
    addAiMessage(
      elements,
      state.sessionStatus === 'completed'
        ? 'I restored your completed interview. Your preview is ready.'
        : 'I restored your unfinished interview. Continue from the next question when you are ready.',
      true,
    );
    renderAll(config, elements, state);
    setAssistantState(elements, state.sessionStatus === 'completed' ? 'completed' : 'idle');
    setMicState(elements, state, 'Idle');
  }

  function downloadPreviewPdf(config, state) {
    const resume = buildResumeJson(config, state);
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!printWindow) return;
    printWindow.document.write(`
      <!doctype html><html><head><title>${escapeHtml(resume.basics.name || 'Resume')}</title>
      <style>body{font-family:Arial,sans-serif;color:#111;line-height:1.45;padding:32px}h1{margin:0}h2{font-size:15px;margin-top:22px;border-bottom:1px solid #ddd}p{white-space:pre-line}</style></head>
      <body><h1>${escapeHtml(resume.basics.name || 'Resume')}</h1><p>${escapeHtml(resume.basics.role || '')}</p>
      <h2>Summary</h2><p>${escapeHtml(resume.summary)}</p><h2>Skills</h2><p>${escapeHtml(resume.skills.join(', '))}</p>
      <h2>Experience</h2><p>${escapeHtml(resume.experience)}</p><h2>Projects / Achievements</h2><p>${escapeHtml(resume.projects || resume.achievements)}</p>
      <h2>Education</h2><p>${escapeHtml(resume.education)}</p><h2>Certifications</h2><p>${escapeHtml(resume.extras.certifications)}</p>
      <h2>Languages & Interests</h2><p>${escapeHtml([resume.extras.languages, resume.extras.interests].filter(Boolean).join('\n'))}</p></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function saveResumeFromInterview(elements) {
    ResumeBuilderPage.generateResume(elements.saveButton);
  }

  function toggleTheme() {
    const root = document.documentElement;
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('rf-theme', root.dataset.theme);
  }

  function matchesCommand(value, phrases) {
    return phrases.some((phrase) => value === phrase || value.startsWith(`${phrase} `));
  }

  function normalizeForCommand(value) {
    return String(value || '').trim().toLowerCase().replace(/[?!.,]/g, '');
  }

  function createStep(key, fieldId, tab, question, formatter, extra = {}) {
    return { fieldId, formatter, key, question, tab, ...extra };
  }

  function getPreset(resumeType) {
    const common = {
      description: 'A full-screen assistant asks one focused question at a time, supports voice or typing, saves progress, and creates an ATS-friendly draft.',
      helperText: 'Answer naturally. I will organize the details into resume sections while keeping the form editable.',
      welcomeMessage: 'Hi, I am your resume interview assistant. We will go step by step and turn your answers into a clean ATS resume.',
    };
    if (resumeType === 'non-technical') {
      return {
        ...common,
        resumeType,
        skillsFieldId: 'nontechnical-core-skills',
        summaryFieldId: 'nontechnical-summary',
        title: 'Guided business resume interview',
        steps: [
          createStep('fullName', 'nontechnical-full-name', 'basics', 'What is your full name?', formatHeadlineText),
          createStep('designation', 'nontechnical-designation', 'basics', 'What role or designation are you targeting?', formatHeadlineText),
          createStep('education', 'nontechnical-degree', 'education', 'Tell me your highest education, college, year, and grade if you want it included.', normalizeSentence),
          createStep('coreSkills', 'nontechnical-core-skills', 'skills', 'Which core professional skills should your resume highlight?', normalizeCommaList),
          createStep('kpis', 'nontechnical-experience-kpis-1', 'experience', 'Describe your recent experience, responsibilities, and measurable KPI impact.', normalizeBulletText),
          createStep('projects', 'nontechnical-achievement-impact-1', 'achievements', 'Share an important project, campaign, initiative, or achievement.', normalizeBulletText),
          createStep('certifications', 'nontechnical-certifications', 'skills', 'List any certifications or courses. Say skip if none.', normalizeCommaList),
          createStep('achievementTitle', 'nontechnical-achievement-title-1', 'achievements', 'What award, achievement, or result should stand out?', formatHeadlineText),
          createStep('languages', 'nontechnical-languages', 'skills', 'Which languages do you know?', normalizeCommaList),
          createStep('interests', '', 'skills', 'Any interests or extracurriculars you want to include?', normalizeCommaList),
        ],
      };
    }
    return {
      ...common,
      resumeType,
      skillsFieldId: 'technical-skills',
      summaryFieldId: 'technical-summary',
      title: 'Guided technical resume interview',
      steps: [
        createStep('fullName', 'technical-full-name', 'basics', 'What is your full name?', formatHeadlineText),
        createStep('jobTitle', 'technical-job-title', 'basics', 'What technical role are you targeting?', formatHeadlineText),
        createStep('education', 'technical-degree', 'education', 'Tell me your education: degree, college, graduation year, and grade if relevant.', normalizeSentence),
        createStep('skills', 'technical-skills', 'skills', 'List your strongest technologies, programming languages, frameworks, and tools.', normalizeCommaList),
        createStep('experienceHighlights', 'technical-experience-highlights-1', 'experience', 'Describe your technical experience, responsibilities, and measurable impact.', normalizeBulletText),
        createStep('projectDescription', 'technical-project-description-1', 'projects', 'Describe one strong project, including the problem solved and outcome.', normalizeBulletText),
        createStep('certifications', 'technical-certifications', 'skills', 'List certifications, courses, or technical training. Say skip if none.', normalizeCommaList),
        createStep('github', 'technical-github', 'basics', 'Share your GitHub, portfolio, deployment, or live demo links.', normalizeUrl),
        createStep('languages', '', 'skills', 'Which spoken or written languages do you know?', normalizeCommaList),
        createStep('interests', '', 'skills', 'Any interests, communities, hackathons, or open-source work to include?', normalizeCommaList),
      ],
    };
  }

  function buildFallbackEnhancements(resumeType, answers) {
    const role = answers.jobTitle || answers.designation || 'professional';
    const impact = answers.experienceHighlights || answers.kpis || answers.projectDescription || '';
    return {
      atsSkills: normalizeCommaList([answers.skills, answers.coreSkills, answers.tools, answers.certifications].filter(Boolean).join(', ')).split(', ').filter(Boolean),
      summary: `${formatHeadlineText(role)} with practical experience and a record of measurable impact. ${normalizeSentence(impact || 'Skilled at collaborating with teams, solving problems, and delivering reliable outcomes.')}`,
    };
  }

  function mergeListValues(currentValue, incomingValue) {
    return Array.from(new Set(`${currentValue || ''}, ${incomingValue || ''}`.split(',').map((item) => item.trim()).filter(Boolean))).join(', ');
  }

  function formatHeadlineText(value) {
    return String(value || '').trim().split(/\s+/).map(formatListItem).join(' ');
  }

  function normalizeSentence(value) {
    const cleaned = String(value || '').trim().replace(/\s+/g, ' ');
    return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : '';
  }

  function normalizeUrl(value) {
    const text = String(value || '').trim().replace(/\bdot\b/gi, '.').replace(/\bslash\b/gi, '/').replace(/\s+/g, '');
    if (!text || /^skip$/i.test(text)) return '';
    return /^https?:\/\//i.test(text) ? text : `https://${text}`;
  }

  function normalizeCommaList(value) {
    return Array.from(new Set(String(value || '').replace(/\band\b/gi, ',').split(/[,\n/;]+/).map((item) => item.trim()).filter(Boolean).map(formatListItem))).join(', ');
  }

  function normalizeBulletText(value) {
    const segments = String(value || '').split(/\.(?:\s|$)|\n|;+/).map((item) => item.trim()).filter(Boolean);
    return segments.map((item) => `- ${normalizeSentence(item)}`).join('\n');
  }

  function formatListItem(value) {
    const known = { aws: 'AWS', css: 'CSS', html: 'HTML', github: 'GitHub', javascript: 'JavaScript', mongodb: 'MongoDB', mysql: 'MySQL', 'node.js': 'Node.js', python: 'Python', react: 'React', sql: 'SQL', typescript: 'TypeScript', ui: 'UI', ux: 'UX' };
    return String(value || '').trim().split(/\s+/).map((word) => {
      const lower = word.toLowerCase();
      if (known[lower]) return known[lower];
      if (/^[a-z]{1,4}$/.test(lower)) return lower.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    }).join(' ');
  }

  function escapeHtml(value) {
    return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  return { create };
})();

const ResumeBuilderPage = (() => {
  const state = {
    config: null,
    voiceAssistant: null,
    restoredVoiceSession: null,
  };

  async function init(config) {
    state.config = {
      formSelector: '.builder-body',
      generateButtonSelector: '#tab-education .next-btn',
      repeaters: [],
      prefillMap: [],
      voiceStorageKey: '',
      ...config,
    };

    document.documentElement.dataset.resumeBuilder = state.config.resumeType || 'technical';

    hydrateRepeaters();
    await restoreLatestResume();
    return state;
  }

  function registerVoiceAssistant(assistant) {
    state.voiceAssistant = assistant;

    const savedSession = loadPersistedVoiceSession();
    if (savedSession && typeof assistant.importSession === 'function') {
      assistant.importSession(savedSession);
    }
  }

  function switchTab(buttonOrName, requestedTabName) {
    const tabName = typeof buttonOrName === 'string' ? buttonOrName : requestedTabName;
    const triggerButton =
      typeof buttonOrName === 'string' ? getTabButton(buttonOrName) : buttonOrName || getTabButton(tabName);
    const targetPanel = document.getElementById(`tab-${tabName}`);

    if (!tabName || !targetPanel) {
      return;
    }

    document.querySelectorAll('.btab').forEach((tabButton) => {
      tabButton.classList.remove('active');
    });

    document.querySelectorAll('.tab-content').forEach((panel) => {
      panel.classList.remove('active-tab');
    });

    if (triggerButton) {
      triggerButton.classList.add('active');
    }

    targetPanel.classList.add('active-tab');
  }

  function switchTabByName(tabName) {
    switchTab(tabName);
  }

  function addEntry(containerId, className) {
    const container = document.getElementById(containerId);
    if (!container) {
      return null;
    }

    const originalEntry = container.querySelector(`.${className}`);
    if (!originalEntry) {
      return null;
    }

    const clone = originalEntry.cloneNode(true);
    clearEntryFields(clone);
    container.appendChild(clone);
    reindexRepeater(containerId);

    const firstField = clone.querySelector('input, textarea, select');
    if (firstField) {
      firstField.focus();
    }

    return clone;
  }

  async function generateResume(eventOrButton) {
    const config = ensureConfig();
    const button = resolveButton(eventOrButton) || document.querySelector(config.generateButtonSelector);
    if (!button) {
      return;
    }

    const originalMarkup = button.innerHTML;
    const snapshot = ResumeForgeApp.captureFormHtml(config.formSelector);
    const voiceAssistantData =
      (state.voiceAssistant && typeof state.voiceAssistant.exportSession === 'function'
        ? state.voiceAssistant.exportSession()
        : null) || loadPersistedVoiceSession();

    button.innerHTML =
      '<span style="display:inline-block;animation:spin 0.8s linear infinite;border:3px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;width:18px;height:18px;"></span> Saving...';
    button.disabled = true;

    try {
      await ResumeForgeApp.saveResume(
        config.resumeType,
        {
          html: snapshot,
          savedAt: new Date().toISOString(),
          voiceAssistant: voiceAssistantData,
        },
        config.resumeTitle,
      );

      button.textContent = 'Resume Saved!';
      button.style.background = 'var(--accent-grad-2)';
    } catch (error) {
      alert(error.message);
      button.innerHTML = originalMarkup;
    } finally {
      button.disabled = false;
    }
  }

  async function logout() {
    await ResumeForgeApp.logout();
    window.location.href = 'index.html';
  }

  function saveVoiceSession(session) {
    const config = ensureConfig();
    if (!config.voiceStorageKey) {
      return;
    }

    try {
      localStorage.setItem(config.voiceStorageKey, JSON.stringify(session || {}));
    } catch (error) {
      console.warn('Unable to persist voice session.', error);
    }
  }

  function loadPersistedVoiceSession() {
    const config = state.config;
    if (!config || !config.voiceStorageKey) {
      return state.restoredVoiceSession;
    }

    const raw = localStorage.getItem(config.voiceStorageKey);
    if (!raw) {
      return state.restoredVoiceSession;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      localStorage.removeItem(config.voiceStorageKey);
      return state.restoredVoiceSession;
    }
  }

  function highlightField(fieldId) {
    document.querySelectorAll('.voice-field-active').forEach((field) => {
      field.classList.remove('voice-field-active');
    });

    const field = document.getElementById(fieldId);
    if (!field) {
      return null;
    }

    field.classList.add('voice-field-active');
    field.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return field;
  }

  function fillField(fieldId, value) {
    const field = document.getElementById(fieldId);
    if (!field) {
      return null;
    }

    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.dispatchEvent(new Event('change', { bubbles: true }));
    return field;
  }

  function getFieldValue(fieldId) {
    const field = document.getElementById(fieldId);
    return field ? field.value : '';
  }

  function ensureRepeaterCount(containerId, count, className = 'exp-entry') {
    const container = document.getElementById(containerId);
    if (!container) {
      return 0;
    }

    while (container.querySelectorAll(`.${className}`).length < count) {
      addEntry(containerId, className);
    }

    reindexRepeater(containerId);
    return container.querySelectorAll(`.${className}`).length;
  }

  function getTabButton(tabName) {
    return document.querySelector(`.btab[data-tab="${tabName}"]`);
  }

  function ensureConfig() {
    if (!state.config) {
      throw new Error('ResumeBuilderPage.init must be called before using page helpers.');
    }

    return state.config;
  }

  function clearEntryFields(entry) {
    entry.querySelectorAll('input, textarea, select').forEach((field) => {
      if (field.tagName === 'SELECT') {
        field.selectedIndex = 0;
        return;
      }

      if (field.type === 'checkbox' || field.type === 'radio') {
        field.checked = false;
        return;
      }

      field.value = '';
    });
  }

  function hydrateRepeaters() {
    const config = ensureConfig();
    config.repeaters.forEach((repeater) => {
      reindexRepeater(repeater.containerId);
    });
  }

  function reindexRepeater(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      return;
    }

    const entries = Array.from(container.children).filter((child) => child.classList.contains('exp-entry'));
    entries.forEach((entry, index) => {
      const entryNumber = index + 1;
      entry.dataset.entryIndex = String(entryNumber);

      entry.querySelectorAll('[data-field-base]').forEach((field) => {
        const nextId = `${field.dataset.fieldBase}-${entryNumber}`;
        field.id = nextId;
        field.name = nextId;
      });

      entry.querySelectorAll('label[data-for-base]').forEach((label) => {
        label.htmlFor = `${label.dataset.forBase}-${entryNumber}`;
      });
    });
  }

  async function restoreLatestResume() {
    const config = ensureConfig();
    ResumeForgeApp.setResumeType(config.resumeType);

    try {
      const response = await ResumeForgeApp.getLatestResume(config.resumeType);
      if (response.resume && response.resume.data && response.resume.data.html) {
        ResumeForgeApp.restoreFormHtml(config.formSelector, response.resume.data.html);
      }

      state.restoredVoiceSession =
        response.resume && response.resume.data ? response.resume.data.voiceAssistant || null : null;

      if (state.restoredVoiceSession) {
        saveVoiceSession(state.restoredVoiceSession);
      }
    } catch (error) {
      console.log(error.message);
    }

    hydrateRepeaters();
    prefillBasicsFromUser();
  }

  function prefillBasicsFromUser() {
    const config = ensureConfig();
    const user = ResumeForgeApp.getStoredUser();
    if (!user) {
      return;
    }

    config.prefillMap.forEach((mapping) => {
      const field = document.getElementById(mapping.id);
      if (!field || field.value) {
        return;
      }

      const nextValue = resolveValue(user, mapping.userKey);
      if (nextValue) {
        field.value = nextValue;
      }
    });
  }

  function resolveValue(source, path) {
    return String(path || '')
      .split('.')
      .filter(Boolean)
      .reduce((current, segment) => (current ? current[segment] : ''), source);
  }

  function resolveButton(eventOrButton) {
    if (eventOrButton && eventOrButton.target && eventOrButton.target.tagName) {
      return eventOrButton.target;
    }

    if (eventOrButton && eventOrButton.tagName) {
      return eventOrButton;
    }

    if (window.event && window.event.target && window.event.target.tagName) {
      return window.event.target;
    }

    return null;
  }

  return {
    addEntry,
    ensureRepeaterCount,
    fillField,
    generateResume,
    getFieldValue,
    highlightField,
    init,
    loadPersistedVoiceSession,
    logout,
    registerVoiceAssistant,
    saveVoiceSession,
    switchTab,
    switchTabByName,
  };
})();

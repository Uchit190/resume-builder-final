const ResumeForgeApp = (() => {
  const TOKEN_KEY = 'rf-auth-token';
  const USER_KEY = 'rf-user';
  const GUEST_KEY = 'rf-guest-id';
  const RESUME_TYPE_KEY = 'resumeType';
  const FALLBACK_API_BASE = 'https://YOUR_RENDER_BACKEND_URL';
  const API_BASE = String(window.RESUMEFORGE_API_BASE || FALLBACK_API_BASE).replace(/\/$/, '');

  function apiUrl(path) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    // This keeps local development easy until the Render URL is added in config.js.
    if (!API_BASE || API_BASE.includes('YOUR_RENDER_BACKEND_URL')) {
      return normalizedPath;
    }

    return `${API_BASE}${normalizedPath}`;
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function getStoredUser() {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (error) {
      localStorage.removeItem(USER_KEY);
      return null;
    }
  }

  function setStoredUser(user) {
    if (!user) {
      localStorage.removeItem(USER_KEY);
      return;
    }

    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function setSession(payload) {
    if (payload.token) {
      localStorage.setItem(TOKEN_KEY, payload.token);
    }

    if (payload.user) {
      setStoredUser(payload.user);
    }
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  function getGuestId() {
    let guestId = localStorage.getItem(GUEST_KEY);
    if (!guestId) {
      guestId = createGuestId();
      localStorage.setItem(GUEST_KEY, guestId);
    }

    return guestId;
  }

  function clearGuest() {
    localStorage.removeItem(GUEST_KEY);
  }

  function createGuestId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return `guest-${window.crypto.randomUUID()}`;
    }

    return `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  async function request(url, options = {}) {
    const requestOptions = { ...options };
    const headers = { Accept: 'application/json', ...(requestOptions.headers || {}) };
    const token = getToken();

    if (requestOptions.auth !== false && token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (requestOptions.includeGuest !== false && !token) {
      headers['x-guest-id'] = getGuestId();
    }

    if (requestOptions.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      requestOptions.body = JSON.stringify(requestOptions.body);
    }

    delete requestOptions.auth;
    delete requestOptions.includeGuest;
    requestOptions.headers = headers;

    const response = await fetch(apiUrl(url), requestOptions);
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : null;

    if (!response.ok) {
      throw new Error((payload && payload.error) || `Request failed with status ${response.status}.`);
    }

    return payload;
  }

  async function signup(payload) {
    const response = await request('/api/auth/signup', {
      method: 'POST',
      auth: false,
      includeGuest: false,
      body: payload,
    });

    setSession(response);
    setResumeType(payload.resumeType);
    return response;
  }

  async function login(payload) {
    const response = await request('/api/auth/login', {
      method: 'POST',
      auth: false,
      includeGuest: false,
      body: payload,
    });

    setSession(response);
    if (response.user && response.user.resumeType) {
      setResumeType(response.user.resumeType);
    }

    return response;
  }

  async function me() {
    const response = await request('/api/auth/me', {
      method: 'GET',
      includeGuest: false,
    });

    if (response.user) {
      setStoredUser(response.user);
    }

    return response;
  }

  async function logout() {
    try {
      await request('/api/auth/logout', {
        method: 'POST',
        includeGuest: false,
      });
    } catch (error) {
      // Ignore logout errors so local cleanup still happens.
    }

    clearSession();
    clearGuest();
  }

  async function saveResume(type, data, title) {
    return request('/api/resumes', {
      method: 'POST',
      body: {
        type,
        title: title || `${type} resume`,
        guestId: getGuestId(),
        data,
      },
    });
  }

  async function getLatestResume(type) {
    const query = new URLSearchParams({
      type,
      guestId: getGuestId(),
    });

    return request(`/api/resumes/latest?${query.toString()}`, {
      method: 'GET',
    });
  }

  async function generateVoiceResumeEnhancements(payload) {
    return request('/api/voice-assistant/enrich', {
      method: 'POST',
      body: payload,
    });
  }

  function setResumeType(type) {
    if (type) {
      localStorage.setItem(RESUME_TYPE_KEY, type);
    }
  }

  function getResumeType() {
    return localStorage.getItem(RESUME_TYPE_KEY) || 'technical';
  }

  function getInitials(user) {
    if (!user) {
      return 'RF';
    }

    const parts = [user.firstName, user.lastName]
      .filter(Boolean)
      .flatMap((value) => String(value).trim().split(/\s+/));

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    if (user.name) {
      const nameParts = String(user.name).trim().split(/\s+/);
      if (nameParts.length >= 2) {
        return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
      }
      if (nameParts[0]) {
        return nameParts[0].slice(0, 2).toUpperCase();
      }
    }

    if (user.email) {
      return user.email.slice(0, 2).toUpperCase();
    }

    return 'RF';
  }

  function updateAvatar(selector = '.user-avatar') {
    const avatar = document.querySelector(selector);
    if (!avatar) {
      return;
    }

    const user = getStoredUser();
    avatar.textContent = getInitials(user);

    if (user && user.name) {
      avatar.title = user.name;
    } else if (user && user.email) {
      avatar.title = user.email;
    }
  }

  function captureFormHtml(selector) {
    const source = document.querySelector(selector);
    if (!source) {
      return '';
    }

    const clone = source.cloneNode(true);
    clone.querySelectorAll('.voice-field-active').forEach((field) => {
      field.classList.remove('voice-field-active');
    });
    const sourceFields = source.querySelectorAll('input, textarea, select');
    const cloneFields = clone.querySelectorAll('input, textarea, select');

    sourceFields.forEach((field, index) => {
      const clonedField = cloneFields[index];
      if (!clonedField) {
        return;
      }

      if (field.tagName === 'TEXTAREA') {
        clonedField.textContent = field.value;
        return;
      }

      if (field.tagName === 'SELECT') {
        Array.from(clonedField.options).forEach((option, optionIndex) => {
          option.selected = field.options[optionIndex].selected;
        });
        return;
      }

      if (field.type === 'checkbox' || field.type === 'radio') {
        if (field.checked) {
          clonedField.setAttribute('checked', 'checked');
        } else {
          clonedField.removeAttribute('checked');
        }
        return;
      }

      clonedField.setAttribute('value', field.value);
    });

    return clone.innerHTML;
  }

  function restoreFormHtml(selector, html) {
    const target = document.querySelector(selector);
    if (!target || !html) {
      return;
    }

    target.innerHTML = html;
  }

  return {
    captureFormHtml,
    clearGuest,
    clearSession,
    getGuestId,
    getLatestResume,
    getResumeType,
    getStoredUser,
    generateVoiceResumeEnhancements,
    login,
    logout,
    me,
    request,
    restoreFormHtml,
    saveResume,
    setResumeType,
    setSession,
    setStoredUser,
    signup,
    updateAvatar,
  };
})();

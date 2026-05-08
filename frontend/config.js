// Set this to your deployed Render backend URL before deploying the frontend.
// Example: window.RESUMEFORGE_API_BASE = 'https://resumeforge-api.onrender.com';
(function configureResumeForgeApi() {
  const productionApiBase = 'https://YOUR_RENDER_BACKEND_URL';
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const isLanHost = /^10\.|^172\.(1[6-9]|2\d|3[0-1])\.|^192\.168\./.test(hostname);
  const params = new URLSearchParams(window.location.search);
  const configuredApiBase = params.get('apiBase') || localStorage.getItem('rf-api-base');

  if (window.RESUMEFORGE_API_BASE) {
    return;
  }

  if (configuredApiBase) {
    localStorage.setItem('rf-api-base', configuredApiBase);
    window.RESUMEFORGE_API_BASE = configuredApiBase;
    return;
  }

  if (isLocalhost) {
    window.RESUMEFORGE_API_BASE = 'http://localhost:3000';
    return;
  }

  if (isLanHost) {
    window.RESUMEFORGE_API_BASE = `http://${hostname}:3000`;
    return;
  }

  window.RESUMEFORGE_API_BASE = productionApiBase;
})();

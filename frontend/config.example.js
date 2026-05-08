// Copy to config.js for local/static deployments.
// Production frontend must call an HTTPS backend for mobile microphone flows.
(function configureResumeForgeApi() {
  window.RESUMEFORGE_API_BASE = 'https://your-render-backend.onrender.com';
})();
